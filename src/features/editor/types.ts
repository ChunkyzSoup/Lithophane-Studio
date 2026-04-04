export type ThemeMode = "light" | "dark";
export type ViewMode = "simple" | "pro";
export type PreviewKind = "original" | "grayscale" | "depth";
export type MeshDensity = "draft" | "balanced" | "fine";

export interface FlatLithophaneSettings {
  widthMm: number;
  heightMm: number;
  aspectLock: boolean;
  minThicknessMm: number;
  maxThicknessMm: number;
  invert: boolean;
  smoothing: number;
  meshDensity: MeshDensity;
}

export interface ImportedImage {
  fileName: string;
  bytes: Uint8Array;
  objectUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  aspectRatio: number;
}

export interface PreviewResult {
  grayscaleDataUrl: string;
  depthDataUrl: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  meshColumns: number;
  meshRows: number;
  estimatedTriangles: number;
  runtime: "tauri" | "browser";
}

export interface ExportResult {
  outputPath: string;
  meshColumns: number;
  meshRows: number;
  triangleCount: number;
}
