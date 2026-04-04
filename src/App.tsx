import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { Panel } from "./components/Panel";
import { PreviewCard } from "./components/PreviewCard";
import { SegmentedControl } from "./components/SegmentedControl";
import { TooltipLabel } from "./components/TooltipLabel";
import {
  DEFAULT_SETTINGS,
  MESH_DENSITY_OPTIONS,
  PREVIEW_OPTIONS,
  PRO_COMING_SOON,
  SIMPLE_PRINT_GUIDANCE,
  THEME_OPTIONS,
  TOOLTIPS,
  VERIFIED_CENTAURI_CARBON,
  VIEW_MODE_OPTIONS,
} from "./features/editor/defaults";
import type {
  FlatLithophaneSettings,
  ImportedImage,
  PreviewKind,
  PreviewResult,
  ThemeMode,
  ViewMode,
} from "./features/editor/types";
import {
  exportFlatLithophaneStl,
  generateFlatLithophanePreview,
  requestStlSavePath,
} from "./lib/backend";
import { readFileBytes, readImageDimensionsFromFile } from "./lib/imageFile";
import { debugLog, warnLog } from "./lib/logger";

const WIDTH_LIMIT_MM = VERIFIED_CENTAURI_CARBON.buildVolumeMm.x;
const HEIGHT_LIMIT_MM = VERIFIED_CENTAURI_CARBON.buildVolumeMm.z;

function clampDimension(value: number, limit: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(limit, Math.max(20, value));
}

function clampThickness(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0.2, value);
}

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundToTenths(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function formatPixels(value: number) {
  return `${value.toLocaleString()} px`;
}

function formatTriangles(value: number | undefined) {
  if (!value) {
    return "Preview pending";
  }

  return `${value.toLocaleString()} triangles`;
}

function sanitizeSettings(candidate: FlatLithophaneSettings): FlatLithophaneSettings {
  const widthMm = clampDimension(
    candidate.widthMm,
    WIDTH_LIMIT_MM,
    DEFAULT_SETTINGS.widthMm,
  );
  const heightMm = clampDimension(
    candidate.heightMm,
    HEIGHT_LIMIT_MM,
    DEFAULT_SETTINGS.heightMm,
  );
  const minThicknessMm = clampThickness(
    candidate.minThicknessMm,
    DEFAULT_SETTINGS.minThicknessMm,
  );
  const rawMaxThicknessMm = clampThickness(
    candidate.maxThicknessMm,
    DEFAULT_SETTINGS.maxThicknessMm,
  );
  const maxThicknessMm = Math.max(minThicknessMm + 0.1, rawMaxThicknessMm);

  return {
    widthMm,
    heightMm,
    aspectLock: Boolean(candidate.aspectLock),
    minThicknessMm: roundToTenths(minThicknessMm),
    maxThicknessMm: roundToTenths(maxThicknessMm),
    invert: Boolean(candidate.invert),
    smoothing: clampPercent(candidate.smoothing, DEFAULT_SETTINGS.smoothing),
    meshDensity: candidate.meshDensity,
  };
}

function previewStatusMessage(preview: PreviewResult) {
  if (preview.runtime === "tauri") {
    return "Live preview is coming from the Rust core.";
  }

  return "Live preview is running in the local UI for smoother updates. STL export still uses the Rust core.";
}

function AppContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRequestIdRef = useRef(0);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [viewMode, setViewMode] = useState<ViewMode>("simple");
  const [previewKind, setPreviewKind] = useState<PreviewKind>("original");
  const [settings, setSettings] = useState<FlatLithophaneSettings>(
    sanitizeSettings(DEFAULT_SETTINGS),
  );
  const deferredSettings = useDeferredValue(settings);
  const [importedImage, setImportedImage] = useState<ImportedImage | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Import a photo to start the first flat lithophane workflow.",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activePreviewSrc =
    previewKind === "original"
      ? importedImage?.objectUrl ?? null
      : previewKind === "grayscale"
        ? preview?.grayscaleDataUrl ?? null
        : preview?.depthDataUrl ?? null;

  const settingsAreValid =
    settings.widthMm > 0 &&
    settings.heightMm > 0 &&
    settings.maxThicknessMm > settings.minThicknessMm;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    return () => {
      if (importedImage) {
        URL.revokeObjectURL(importedImage.objectUrl);
      }
    };
  }, [importedImage]);

  useEffect(() => {
    if (!importedImage || !settingsAreValid || importedImage.bytes.byteLength === 0) {
      return;
    }

    let cancelled = false;
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    const safeSettings = sanitizeSettings(deferredSettings);

    setIsGeneratingPreview(true);
    setErrorMessage(null);
    debugLog("preview", "Queued preview refresh.", {
      requestId,
      smoothing: safeSettings.smoothing,
      meshDensity: safeSettings.meshDensity,
      imageBytes: importedImage.bytes.byteLength,
    });

    const timeoutId = window.setTimeout(async () => {
      try {
        debugLog("preview", "Starting preview refresh.", {
          requestId,
          smoothing: safeSettings.smoothing,
        });

        const nextPreview = await generateFlatLithophanePreview(
          {
            imageBytes: importedImage.bytes,
            settings: safeSettings,
          },
          {
            mode: "browser",
          },
        );

        if (cancelled || requestId !== previewRequestIdRef.current) {
          debugLog("preview", "Ignored stale preview result.", {
            requestId,
          });
          return;
        }

        startTransition(() => {
          setPreview(nextPreview);
          setStatusMessage(previewStatusMessage(nextPreview));
        });
      } catch (error) {
        if (cancelled || requestId !== previewRequestIdRef.current) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Preview generation failed unexpectedly.";
        warnLog("preview", "Preview refresh failed.", {
          requestId,
          error: message,
        });
        setErrorMessage(message);
        setStatusMessage(
          "Preview refresh failed safely. Your last successful preview stays on screen.",
        );
      } finally {
        if (!cancelled && requestId === previewRequestIdRef.current) {
          setIsGeneratingPreview(false);
          debugLog("preview", "Preview refresh finished.", {
            requestId,
          });
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      debugLog("preview", "Cancelled queued preview refresh.", {
        requestId,
      });
    };
  }, [deferredSettings, importedImage, settingsAreValid]);

  async function handleImportChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      debugLog("ui", "Import started.", {
        fileName: file.name,
        fileSize: file.size,
      });
      const [bytes, dimensions] = await Promise.all([
        readFileBytes(file),
        readImageDimensionsFromFile(file),
      ]);
      const aspectRatio = dimensions.width / dimensions.height;

      if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
        throw new Error("The selected image has invalid dimensions.");
      }

      const objectUrl = URL.createObjectURL(file);

      startTransition(() => {
        setImportedImage((current) => {
          if (current) {
            URL.revokeObjectURL(current.objectUrl);
          }

          return {
            fileName: file.name,
            bytes,
            objectUrl,
            pixelWidth: dimensions.width,
            pixelHeight: dimensions.height,
            aspectRatio,
          };
        });
        setPreview(null);
        setPreviewKind("original");
        setSettings((current) =>
          sanitizeSettings({
            ...current,
            widthMm: DEFAULT_SETTINGS.widthMm,
            heightMm: roundToTenths(DEFAULT_SETTINGS.widthMm / aspectRatio),
          }),
        );
        setStatusMessage(
          `Loaded ${file.name}. Adjust the size and thickness, then export when the preview looks right.`,
        );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image import failed.";
      warnLog("ui", "Import failed.", {
        error: message,
      });
      setErrorMessage(message);
    } finally {
      event.target.value = "";
    }
  }

  function updateWidth(nextWidth: number) {
    setSettings((current) => {
      const widthMm = clampDimension(
        nextWidth,
        WIDTH_LIMIT_MM,
        current.widthMm,
      );

      if (!current.aspectLock || !importedImage) {
        return sanitizeSettings({ ...current, widthMm });
      }

      return sanitizeSettings({
        ...current,
        widthMm,
        heightMm: clampDimension(
          roundToTenths(widthMm / importedImage.aspectRatio),
          HEIGHT_LIMIT_MM,
          current.heightMm,
        ),
      });
    });
  }

  function updateHeight(nextHeight: number) {
    setSettings((current) => {
      const heightMm = clampDimension(
        nextHeight,
        HEIGHT_LIMIT_MM,
        current.heightMm,
      );

      if (!current.aspectLock || !importedImage) {
        return sanitizeSettings({ ...current, heightMm });
      }

      return sanitizeSettings({
        ...current,
        heightMm,
        widthMm: clampDimension(
          roundToTenths(heightMm * importedImage.aspectRatio),
          WIDTH_LIMIT_MM,
          current.widthMm,
        ),
      });
    });
  }

  function updateSettings(
    updater: (current: FlatLithophaneSettings) => FlatLithophaneSettings,
  ) {
    setSettings((current) => sanitizeSettings(updater(current)));
  }

  async function handleExportClick() {
    if (!importedImage || !settingsAreValid) {
      return;
    }

    try {
      setErrorMessage(null);
      const defaultFileName = importedImage.fileName.replace(/\.[^.]+$/, "");
      const outputPath = await requestStlSavePath(
        `${defaultFileName}-flat-lithophane.stl`,
      );

      if (!outputPath) {
        return;
      }

      setIsExporting(true);
      debugLog("export", "Starting STL export.", {
        outputPath,
      });

      const result = await exportFlatLithophaneStl({
        imageBytes: importedImage.bytes,
        settings: sanitizeSettings(settings),
        outputPath,
      });

      setStatusMessage(
        `STL exported to ${result.outputPath}. The current mesh used ${result.meshColumns} by ${result.meshRows} sample points.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "STL export failed.";
      warnLog("export", "STL export failed.", {
        error: message,
      });
      setErrorMessage(message);
    } finally {
      setIsExporting(false);
    }
  }

  const buildVolumeWarning =
    settings.widthMm > WIDTH_LIMIT_MM || settings.heightMm > HEIGHT_LIMIT_MM
      ? "This panel exceeds the verified 256 x 256 x 256 mm Centauri Carbon build volume."
      : settings.widthMm > 245 || settings.heightMm > 245
        ? "You are close to the Centauri Carbon limit. Leave room for a brim and handling."
        : null;

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/bmp"
        className="visually-hidden"
        onChange={handleImportChange}
        type="file"
      />

      <header className="app-header">
        <div className="app-title-block">
          <p className="eyebrow">Windows desktop prototype</p>
          <h1>Lithophane Studio</h1>
          <p className="subtitle">
            Local-first flat lithophane workflow with verified Centauri Carbon
            defaults.
          </p>
        </div>

        <div className="header-controls">
          <div className="header-group">
            <span className="header-label">Workspace</span>
            <SegmentedControl
              onChange={setViewMode}
              options={VIEW_MODE_OPTIONS}
              value={viewMode}
            />
          </div>

          <div className="header-group">
            <span className="header-label">Theme</span>
            <SegmentedControl
              onChange={(value) => setTheme(value as ThemeMode)}
              options={THEME_OPTIONS}
              value={theme}
            />
          </div>
        </div>
      </header>

      <div className="status-bar">
        <span className="status-pill">{statusMessage}</span>
        <span className="status-pill subtle">
          Verified printer preset: {VERIFIED_CENTAURI_CARBON.displayName}
        </span>
      </div>

      <main className="workspace">
        <aside className="rail left-rail">
          <Panel
            description="Start with a single photo. The first working slice stays focused on a dependable flat panel export."
            title="Project"
          >
            <div className="button-row">
              <button
                className="primary-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Import image
              </button>
              <button
                className="secondary-button"
                disabled={!importedImage}
                onClick={handleExportClick}
                type="button"
              >
                {isExporting ? "Exporting STL..." : "Export STL"}
              </button>
            </div>

            {importedImage ? (
              <div className="meta-grid">
                <div>
                  <span className="meta-label">Current file</span>
                  <strong>{importedImage.fileName}</strong>
                </div>
                <div>
                  <span className="meta-label">Source image</span>
                  <strong>
                    {formatPixels(importedImage.pixelWidth)} x{" "}
                    {formatPixels(importedImage.pixelHeight)}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="empty-copy">
                Import a JPEG, PNG, WEBP, or BMP to unlock the live grayscale and
                depth previews.
              </p>
            )}
          </Panel>

          <Panel
            description="Original shows the photo. Grayscale shows the image after prep. Depth shows thicker areas brighter."
            title="Preview View"
          >
            <SegmentedControl
              onChange={(value) => setPreviewKind(value as PreviewKind)}
              options={PREVIEW_OPTIONS}
              value={previewKind}
            />
          </Panel>

          <Panel
            description="Keep aspect lock on unless you intentionally want to stretch the picture."
            title="Size"
          >
            <div className="field-grid">
              <label className="field">
                <TooltipLabel hint={TOOLTIPS.widthMm} label="Width" />
                <div className="input-wrap">
                  <input
                    min={20}
                    onChange={(event) =>
                      updateWidth(Number(event.currentTarget.value))
                    }
                    step={1}
                    type="number"
                    value={settings.widthMm}
                  />
                  <span className="unit-pill">mm</span>
                </div>
              </label>

              <label className="field">
                <TooltipLabel hint={TOOLTIPS.heightMm} label="Height" />
                <div className="input-wrap">
                  <input
                    min={20}
                    onChange={(event) =>
                      updateHeight(Number(event.currentTarget.value))
                    }
                    step={1}
                    type="number"
                    value={settings.heightMm}
                  />
                  <span className="unit-pill">mm</span>
                </div>
              </label>
            </div>

            <button
              className={`toggle-chip ${settings.aspectLock ? "active" : ""}`}
              onClick={() =>
                updateSettings((current) => {
                  if (!importedImage || current.aspectLock) {
                    return { ...current, aspectLock: !current.aspectLock };
                  }

                  return {
                    ...current,
                    aspectLock: true,
                    heightMm: clampDimension(
                      roundToTenths(current.widthMm / importedImage.aspectRatio),
                      HEIGHT_LIMIT_MM,
                      current.heightMm,
                    ),
                  };
                })
              }
              type="button"
            >
              {settings.aspectLock ? "Aspect lock is on" : "Aspect lock is off"}
            </button>

            {buildVolumeWarning ? (
              <p className="callout warning">{buildVolumeWarning}</p>
            ) : (
              <p className="callout">
                Verified Centauri Carbon build volume: 256 x 256 x 256 mm.
              </p>
            )}
          </Panel>

          <Panel
            description="Darker photo areas usually become thicker in a normal lithophane. Invert flips that mapping."
            title="Thickness"
          >
            <div className="field-grid">
              <label className="field">
                <TooltipLabel
                  hint={TOOLTIPS.minThicknessMm}
                  label="Minimum thickness"
                />
                <div className="input-wrap">
                  <input
                    min={0.4}
                    onChange={(event) =>
                      updateSettings((current) => ({
                        ...current,
                        minThicknessMm: Number(event.currentTarget.value),
                      }))
                    }
                    step={0.1}
                    type="number"
                    value={settings.minThicknessMm}
                  />
                  <span className="unit-pill">mm</span>
                </div>
              </label>

              <label className="field">
                <TooltipLabel
                  hint={TOOLTIPS.maxThicknessMm}
                  label="Maximum thickness"
                />
                <div className="input-wrap">
                  <input
                    min={0.8}
                    onChange={(event) =>
                      updateSettings((current) => ({
                        ...current,
                        maxThicknessMm: Number(event.currentTarget.value),
                      }))
                    }
                    step={0.1}
                    type="number"
                    value={settings.maxThicknessMm}
                  />
                  <span className="unit-pill">mm</span>
                </div>
              </label>
            </div>

            <button
              className={`toggle-chip ${settings.invert ? "active" : ""}`}
              onClick={() =>
                updateSettings((current) => ({
                  ...current,
                  invert: !current.invert,
                }))
              }
              type="button"
            >
              {settings.invert ? "Invert mapping is on" : "Invert mapping is off"}
            </button>

            {!settingsAreValid ? (
              <p className="callout warning">
                Maximum thickness must be greater than minimum thickness before
                export.
              </p>
            ) : (
              <p className="callout">
                Current overall range:{" "}
                {(settings.maxThicknessMm - settings.minThicknessMm).toFixed(1)}
                mm.
              </p>
            )}
          </Panel>

          <Panel
            description={
              viewMode === "simple"
                ? "Start with Balanced for most PLA prints, then move to Fine only when the photo really needs it."
                : "Quality changes the sample grid used for the height map. Higher values preserve more detail but create larger STL files."
            }
            title={viewMode === "simple" ? "Quality" : "Advanced Quality"}
          >
            <div className="stack-gap">
              <div className="field">
                <TooltipLabel
                  hint={
                    viewMode === "simple"
                      ? TOOLTIPS.meshDensitySimple
                      : TOOLTIPS.meshDensity
                  }
                  label={viewMode === "simple" ? "Detail level" : "Mesh density"}
                />
                <SegmentedControl
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      meshDensity: value as FlatLithophaneSettings["meshDensity"],
                    }))
                  }
                  options={MESH_DENSITY_OPTIONS}
                  value={settings.meshDensity}
                />
              </div>

              <label className="field">
                <TooltipLabel
                  hint={TOOLTIPS.smoothing}
                  label={viewMode === "simple" ? "Surface cleanup" : "Smoothing"}
                />
                <div className="slider-row">
                  <input
                    max={100}
                    min={0}
                    onChange={(event) => {
                      const nextSmoothing = clampPercent(
                        Number(event.currentTarget.value),
                        settings.smoothing,
                      );
                      debugLog("ui", "Surface cleanup slider changed.", {
                        value: nextSmoothing,
                      });
                      updateSettings((current) => ({
                        ...current,
                        smoothing: nextSmoothing,
                      }));
                    }}
                    type="range"
                    value={settings.smoothing}
                  />
                  <span className="slider-value">{settings.smoothing}%</span>
                </div>
              </label>
            </div>

            {viewMode === "pro" ? (
              <div className="meta-grid">
                <div>
                  <span className="meta-label">Preview mesh</span>
                  <strong>
                    {preview?.meshColumns ?? "?"} x {preview?.meshRows ?? "?"}
                  </strong>
                </div>
                <div>
                  <span className="meta-label">Estimated surface</span>
                  <strong>{formatTriangles(preview?.estimatedTriangles)}</strong>
                </div>
              </div>
            ) : null}
          </Panel>
        </aside>

        <section className="center-column">
          <Panel
            description="This is the currently selected preview. The first build keeps the focus on reliable 2D prep and STL output."
            title="Main Preview"
          >
            {activePreviewSrc ? (
              <div className="main-preview-wrap">
                <img
                  alt={`${previewKind} preview`}
                  className="main-preview-image"
                  src={activePreviewSrc}
                />
              </div>
            ) : (
              <div className="empty-state">
                <h2>Drop in a photo to begin</h2>
                <p>
                  This first scaffold handles one flat lithophane at a time, with
                  grayscale and depth prep before STL export.
                </p>
              </div>
            )}
          </Panel>

          <div className="preview-grid">
            <PreviewCard
              active={previewKind === "original"}
              label="Original"
              onClick={() => setPreviewKind("original")}
              src={importedImage?.objectUrl ?? null}
            />
            <PreviewCard
              active={previewKind === "grayscale"}
              label="Grayscale"
              onClick={() => setPreviewKind("grayscale")}
              src={preview?.grayscaleDataUrl ?? null}
            />
            <PreviewCard
              active={previewKind === "depth"}
              label="Depth"
              onClick={() => setPreviewKind("depth")}
              src={preview?.depthDataUrl ?? null}
            />
          </div>

          <Panel
            description="These notes stay in plain English so beginners are not forced to think like slicer experts on day one."
            title="Print Guidance"
          >
            <div className="guidance-list">
              {SIMPLE_PRINT_GUIDANCE.map((item) => (
                <article className="guidance-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        <aside className="rail right-rail">
          <Panel
            description="STL is the first stable export path. 3MF is intentionally held until it can land without slowing this reliable baseline."
            title="Export"
          >
            <div className="export-summary">
              <div>
                <span className="meta-label">Printer preset</span>
                <strong>{VERIFIED_CENTAURI_CARBON.displayName}</strong>
              </div>
              <div>
                <span className="meta-label">Standard nozzle</span>
                <strong>{VERIFIED_CENTAURI_CARBON.nozzleMm.toFixed(1)} mm</strong>
              </div>
              <div>
                <span className="meta-label">Build volume</span>
                <strong>
                  {VERIFIED_CENTAURI_CARBON.buildVolumeMm.x} x{" "}
                  {VERIFIED_CENTAURI_CARBON.buildVolumeMm.y} x{" "}
                  {VERIFIED_CENTAURI_CARBON.buildVolumeMm.z} mm
                </strong>
              </div>
            </div>

            <div className="button-row">
              <button
                className="primary-button"
                disabled={!importedImage || !settingsAreValid || isExporting}
                onClick={handleExportClick}
                type="button"
              >
                {isExporting ? "Writing STL..." : "Save STL"}
              </button>
            </div>

            <p className="callout">
              Export stays fully local and offline. No network services are used
              for image prep or mesh generation.
            </p>
          </Panel>

          <Panel
            description="This scaffold keeps a visible slot for 3D preview and richer project handling without pretending those are finished yet."
            title="What Works Now"
          >
            <ul className="plain-list">
              <li>Image import with local preview</li>
              <li>Live grayscale and depth preview with safe fallback handling</li>
              <li>Flat lithophane sizing and thickness controls</li>
              <li>Simple and Pro mode structure</li>
              <li>Binary STL export path</li>
            </ul>
          </Panel>

          <Panel
            description="These hooks are intentionally visible so the next iteration has a clear place to land."
            title={viewMode === "simple" ? "Next Up" : "Pro Workspace Stub"}
          >
            <ul className="plain-list">
              {PRO_COMING_SOON.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>

          {isGeneratingPreview ? (
            <p className="callout">Refreshing preview...</p>
          ) : null}

          {errorMessage ? <p className="callout warning">{errorMessage}</p> : null}
        </aside>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}

export default App;
