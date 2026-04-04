import type {
  ExportResult,
  FlatLithophaneSettings,
  PreviewResult,
} from "../features/editor/types";
import { debugLog, warnLog } from "./logger";
import { generatePreviewFallback } from "./webPreview";

type PreviewCommandRequest = {
  imageBytes: Uint8Array;
  settings: FlatLithophaneSettings;
};

type ExportCommandRequest = PreviewCommandRequest & {
  outputPath: string;
};

type TauriPreviewResponse = {
  grayscalePng: number[];
  depthPng: number[];
  sourceWidthPx: number;
  sourceHeightPx: number;
  meshColumns: number;
  meshRows: number;
  estimatedTriangles: number;
};

type TauriExportResponse = {
  outputPath: string;
  meshColumns: number;
  meshRows: number;
  triangleCount: number;
};

type GeneratePreviewOptions = {
  mode?: "auto" | "browser" | "tauri";
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function coerceByteArray(fieldName: string, value: unknown) {
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }

  if (!Array.isArray(value)) {
    throw new Error(`Preview response field "${fieldName}" was not a byte array.`);
  }

  const sanitized = value.map((entry, index) => {
    if (!Number.isFinite(entry)) {
      throw new Error(
        `Preview response field "${fieldName}" contained a non-finite value at ${index}.`,
      );
    }

    return Math.max(0, Math.min(255, Math.round(Number(entry))));
  });

  if (sanitized.length === 0) {
    throw new Error(`Preview response field "${fieldName}" was empty.`);
  }

  return sanitized;
}

function coercePositiveNumber(fieldName: string, value: unknown) {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    throw new Error(`Preview response field "${fieldName}" was invalid.`);
  }

  return Number(value);
}

function bytesToDataUrl(bytes: number[], mimeType: string) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function generateFlatLithophanePreview(
  request: PreviewCommandRequest,
  options: GeneratePreviewOptions = {},
): Promise<PreviewResult> {
  const mode = options.mode ?? "auto";
  const wantsBrowserPreview = mode === "browser";
  const canUseTauriPreview = mode === "tauri" || (mode === "auto" && isTauriRuntime());

  if (wantsBrowserPreview || !canUseTauriPreview) {
    debugLog("preview", "Running preview in the local browser pipeline.", {
      mode,
      imageBytes: request.imageBytes.byteLength,
      meshDensity: request.settings.meshDensity,
      smoothing: request.settings.smoothing,
    });
    return generatePreviewFallback(request);
  }

  try {
    debugLog("preview", "Running preview through the Tauri bridge.", {
      imageBytes: request.imageBytes.byteLength,
      meshDensity: request.settings.meshDensity,
      smoothing: request.settings.smoothing,
    });

    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<TauriPreviewResponse>(
      "preview_flat_lithophane",
      {
        request: {
          imageBytes: Array.from(request.imageBytes),
          settings: request.settings,
        },
      },
    );
    const grayscalePng = coerceByteArray("grayscalePng", response.grayscalePng);
    const depthPng = coerceByteArray("depthPng", response.depthPng);
    const preview = {
      grayscaleDataUrl: bytesToDataUrl(grayscalePng, "image/png"),
      depthDataUrl: bytesToDataUrl(depthPng, "image/png"),
      sourceWidthPx: coercePositiveNumber("sourceWidthPx", response.sourceWidthPx),
      sourceHeightPx: coercePositiveNumber(
        "sourceHeightPx",
        response.sourceHeightPx,
      ),
      meshColumns: coercePositiveNumber("meshColumns", response.meshColumns),
      meshRows: coercePositiveNumber("meshRows", response.meshRows),
      estimatedTriangles: coercePositiveNumber(
        "estimatedTriangles",
        response.estimatedTriangles,
      ),
      runtime: "tauri" as const,
    };

    debugLog("preview", "Tauri preview completed.", {
      meshColumns: preview.meshColumns,
      meshRows: preview.meshRows,
      estimatedTriangles: preview.estimatedTriangles,
    });

    return preview;
  } catch (error) {
    if (mode === "tauri") {
      throw error;
    }

    warnLog("preview", "Tauri preview failed. Falling back to browser preview.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return generatePreviewFallback(request);
  }
}

export async function requestStlSavePath(defaultName: string) {
  if (!isTauriRuntime()) {
    throw new Error(
      "STL export needs the Tauri desktop runtime. Once Rust is installed, run `npm run tauri dev` instead of plain Vite.",
    );
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const selectedPath = await save({
    defaultPath: defaultName,
    filters: [
      {
        name: "STL mesh",
        extensions: ["stl"],
      },
    ],
  });

  return typeof selectedPath === "string" ? selectedPath : null;
}

export async function exportFlatLithophaneStl(
  request: ExportCommandRequest,
): Promise<ExportResult> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Native STL export only runs inside the Tauri desktop shell.",
    );
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const response = await invoke<TauriExportResponse>(
    "export_flat_lithophane_stl",
    {
      request: {
        imageBytes: Array.from(request.imageBytes),
        settings: request.settings,
        outputPath: request.outputPath,
      },
    },
  );

  return {
    outputPath: response.outputPath,
    meshColumns: response.meshColumns,
    meshRows: response.meshRows,
    triangleCount: response.triangleCount,
  };
}
