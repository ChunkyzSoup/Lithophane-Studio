import type { FlatLithophaneSettings } from "./types";

export const VERIFIED_CENTAURI_CARBON = {
  id: "elegoo-centauri-carbon",
  displayName: "Elegoo Centauri Carbon",
  buildVolumeMm: {
    x: 256,
    y: 256,
    z: 256,
  },
  nozzleMm: 0.4,
  note: "Verified against the official ELEGOO Centauri Carbon manual and official product page.",
} as const;

export const DEFAULT_SETTINGS: FlatLithophaneSettings = {
  widthMm: 150,
  heightMm: 100,
  aspectLock: true,
  minThicknessMm: 0.8,
  maxThicknessMm: 3,
  invert: false,
  smoothing: 16,
  meshDensity: "balanced",
};

export const VIEW_MODE_OPTIONS = [
  { label: "Simple", value: "simple" },
  { label: "Pro", value: "pro" },
] as const;

export const THEME_OPTIONS = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
] as const;

export const PREVIEW_OPTIONS = [
  { label: "Original", value: "original" },
  { label: "Grayscale", value: "grayscale" },
  { label: "Depth", value: "depth" },
] as const;

export const MESH_DENSITY_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Balanced", value: "balanced" },
  { label: "Fine", value: "fine" },
] as const;

export const TOOLTIPS = {
  widthMm:
    "This is the printed width of the panel. Wider panels keep more horizontal detail but also create larger meshes.",
  heightMm:
    "This is the printed height of the panel. Height affects how much vertical detail the export can hold.",
  minThicknessMm:
    "The thinnest part of the lithophane. Thinner areas pass more light but can become fragile if you go too low.",
  maxThicknessMm:
    "The thickest part of the lithophane. Thicker areas block more light and make dark photo regions read more strongly.",
  smoothing:
    "Smoothing softens harsh pixel-to-pixel changes so the printed surface looks cleaner.",
  meshDensity:
    "Higher mesh density samples the image more finely and usually improves detail, but it also increases STL size and export time.",
  meshDensitySimple:
    "Balanced is the safest starting point for most PLA lithophanes. Fine is best for very good source photos.",
} as const;

export const SIMPLE_PRINT_GUIDANCE = [
  {
    title: "Orientation",
    body: "Start by printing upright so the printer can draw the image detail layer by layer through the panel height.",
  },
  {
    title: "Layer height",
    body: "Use 0.08 mm for fine detail or 0.12 mm for a good balanced PLA print on a 0.4 mm nozzle.",
  },
  {
    title: "Speed",
    body: "Keep outer walls slower than the machine's headline speed. Lithophanes usually look better when detail beats raw speed.",
  },
];

export const PRO_COMING_SOON = [
  "True 3D preview with orbit controls",
  "Project save and load (.litho package)",
  "Crop and rotate tools",
  "Curved and framed variants",
  "3MF export once it matches STL quality",
];
