import type { FlatLithophaneSettings } from "./types";

export interface LithophaneProjectV1 {
  schemaVersion: 1;
  projectName: string;
  printerId: string;
  mode: "flat";
  sourceImageFileName?: string;
  settings: FlatLithophaneSettings;
}

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;
