import type {
  FlatLithophaneSettings,
  MeshDensity,
  PreviewResult,
} from "../features/editor/types";
import { debugLog } from "./logger";

type PreviewFallbackRequest = {
  imageBytes: Uint8Array;
  settings: FlatLithophaneSettings;
};

const MAX_PREVIEW_EDGE = 900;

function clampPreviewAxis(value: number) {
  if (!Number.isFinite(value)) {
    return 40;
  }

  return Math.max(40, Math.round(value));
}

function meshDensityToSamplesPerMm(meshDensity: MeshDensity) {
  switch (meshDensity) {
    case "draft":
      return 2;
    case "fine":
      return 5;
    case "balanced":
    default:
      return 3.5;
  }
}

function estimateTriangleCount(columns: number, rows: number) {
  const frontAndBack = 4 * (columns - 1) * (rows - 1);
  const sideWalls = 4 * (columns + rows - 2);
  return frontAndBack + sideWalls;
}

function constrainPreviewGrid(columns: number, rows: number) {
  const longestEdge = Math.max(columns, rows);

  if (longestEdge <= MAX_PREVIEW_EDGE) {
    return {
      previewColumns: columns,
      previewRows: rows,
    };
  }

  const scale = MAX_PREVIEW_EDGE / longestEdge;
  return {
    previewColumns: clampPreviewAxis(columns * scale),
    previewRows: clampPreviewAxis(rows * scale),
  };
}

function smoothingPasses(smoothing: number) {
  if (smoothing <= 0) {
    return 0;
  }

  if (smoothing < 25) {
    return 1;
  }

  if (smoothing < 60) {
    return 2;
  }

  return 3;
}

async function loadImageFromBytes(imageBytes: Uint8Array) {
  const objectUrl = URL.createObjectURL(new Blob([imageBytes]));

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Browser preview fallback could not read the image."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function applyBoxBlur(
  input: Float32Array,
  width: number,
  height: number,
  passes: number,
) {
  let current = input;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(current.length);

    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        let sum = 0;
        let count = 0;

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          const nextRow = row + rowOffset;

          if (nextRow < 0 || nextRow >= height) {
            continue;
          }

          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            const nextColumn = column + columnOffset;

            if (nextColumn < 0 || nextColumn >= width) {
              continue;
            }

            sum += current[nextRow * width + nextColumn];
            count += 1;
          }
        }

        next[row * width + column] = sum / count;
      }
    }

    current = next;
  }

  return current;
}

function renderScalarFieldToDataUrl(
  scalarField: Float32Array,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D preview context is not available.");
  }

  canvas.width = width;
  canvas.height = height;

  const imageData = context.createImageData(width, height);

  for (let index = 0; index < scalarField.length; index += 1) {
    const byteValue = Math.round(Math.min(1, Math.max(0, scalarField[index])) * 255);
    const pixelOffset = index * 4;
    imageData.data[pixelOffset] = byteValue;
    imageData.data[pixelOffset + 1] = byteValue;
    imageData.data[pixelOffset + 2] = byteValue;
    imageData.data[pixelOffset + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function generatePreviewFallback({
  imageBytes,
  settings,
}: PreviewFallbackRequest): Promise<PreviewResult> {
  if (imageBytes.byteLength === 0) {
    throw new Error("The selected image was empty, so a preview could not be generated.");
  }

  const image = await loadImageFromBytes(imageBytes);
  const safeWidthMm = Number.isFinite(settings.widthMm) ? Math.max(20, settings.widthMm) : 150;
  const safeHeightMm = Number.isFinite(settings.heightMm)
    ? Math.max(20, settings.heightMm)
    : 100;
  const samplesPerMm = meshDensityToSamplesPerMm(settings.meshDensity);
  const meshColumns = Math.max(40, Math.round(safeWidthMm * samplesPerMm) + 1);
  const meshRows = Math.max(40, Math.round(safeHeightMm * samplesPerMm) + 1);
  const { previewColumns, previewRows } = constrainPreviewGrid(meshColumns, meshRows);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D preview context is not available.");
  }

  canvas.width = previewColumns;
  canvas.height = previewRows;
  context.drawImage(image, 0, 0, previewColumns, previewRows);

  const imageData = context.getImageData(0, 0, previewColumns, previewRows);
  const grayscale = new Float32Array(previewColumns * previewRows);

  for (let index = 0; index < grayscale.length; index += 1) {
    const pixelOffset = index * 4;
    const red = imageData.data[pixelOffset] / 255;
    const green = imageData.data[pixelOffset + 1] / 255;
    const blue = imageData.data[pixelOffset + 2] / 255;
    grayscale[index] = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }

  const smoothed = applyBoxBlur(
    grayscale,
    previewColumns,
    previewRows,
    smoothingPasses(settings.smoothing),
  );

  const depth = new Float32Array(smoothed.length);

  for (let index = 0; index < smoothed.length; index += 1) {
    const luminance = smoothed[index];
    depth[index] = settings.invert ? luminance : 1 - luminance;
  }

  debugLog("preview", "Browser preview completed.", {
    previewColumns,
    previewRows,
    meshColumns,
    meshRows,
    smoothing: settings.smoothing,
  });

  return {
    grayscaleDataUrl: renderScalarFieldToDataUrl(
      smoothed,
      previewColumns,
      previewRows,
    ),
    depthDataUrl: renderScalarFieldToDataUrl(depth, previewColumns, previewRows),
    sourceWidthPx: image.naturalWidth,
    sourceHeightPx: image.naturalHeight,
    meshColumns,
    meshRows,
    estimatedTriangles: estimateTriangleCount(meshColumns, meshRows),
    runtime: "browser",
  };
}
