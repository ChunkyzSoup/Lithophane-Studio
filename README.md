# Lithophane Studio

Windows-first Tauri + React + Rust scaffold for an original, legitimate lithophane maker.

## What this scaffold includes

- polished desktop UI shell with light and dark themes
- Simple and Pro workspace toggle
- single-image flat lithophane workflow
- grayscale preview
- depth-map preview
- width and height controls with aspect lock
- minimum and maximum thickness controls
- invert toggle
- smoothing control
- mesh density presets
- local STL export path
- Rust core split into image, height-map, mesh, and export modules

## Verified printer preset

The first built-in printer-aware preset uses the official ELEGOO Centauri Carbon values:

- build volume: `256 x 256 x 256 mm`
- standard nozzle: `0.4 mm`

This scaffold intentionally keeps `3MF` out of the first stable vertical slice so STL reliability can land first.

## Run on Windows

1. Install Rust if it is not already on your machine.

```powershell
winget install Rustlang.Rustup
rustup default stable
```

2. Install JavaScript dependencies.

```powershell
cd C:\Users\johna\Documents\Playground\lithophane-maker
npm install
```

3. Start the desktop app.

```powershell
npm run tauri dev
```

## Browser-only fallback

If you want to smoke-test the UI before Rust is ready, you can run the frontend alone:

```powershell
npm run dev
```

That fallback still imports an image and shows local previews, but native STL export only works in the Tauri desktop runtime.
