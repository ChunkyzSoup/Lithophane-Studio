# Lithophane Studio

Lithophane Studio is a local-first desktop app for creating original lithophanes for 3D printing.
It uses `Tauri + React + TypeScript + Rust`, keeps image processing and mesh generation on-device,
and focuses on reliable STL export for real-world print workflows.

## Project status

This repository currently ships a first working vertical slice:

- polished desktop UI shell with light and dark themes
- Simple and Pro workspace toggle
- flat lithophane workflow
- image import
- grayscale preview
- depth-map preview
- width and height controls with aspect lock
- minimum and maximum thickness controls
- invert toggle
- surface cleanup and smoothing control
- mesh density presets
- local STL export path
- Rust core split into image, height-map, mesh, and export modules

`3MF` is intentionally deferred until STL export is solid and regression-tested.

## Compatibility

The app is best-tested on Windows 11 right now, but the codebase is not tied to Windows-only APIs.
It is designed to stay compatible with other desktop systems supported by Tauri:

- Windows
- macOS
- Linux

If you are only using the source code on GitHub, other people can clone the repository, review it,
run it locally, and contribute changes. The included MIT license also lets other people use and
modify the code in their own projects.

## Verified printer preset

The first built-in printer-aware preset uses the official ELEGOO Centauri Carbon values:

- build volume: `256 x 256 x 256 mm`
- standard nozzle: `0.4 mm`

## Prerequisites

Install these before running the desktop app:

- Node.js 20 or newer
- Rust stable toolchain
- Tauri system prerequisites for your operating system

Current Tauri prerequisite guide:

- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Quick start

```bash
git clone <your-repo-url>
cd lithophane-maker
npm install
npm run tauri dev
```

## Browser-only fallback

If you want to smoke-test the UI without the desktop shell:

```bash
npm run dev
```

That fallback still imports an image and shows local previews, but native STL export only works in
the Tauri desktop runtime.

## Verification

Frontend build:

```bash
npm run build
```

Rust and Tauri host check:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## GitHub and sharing

If you want other people to use the project, the usual setup is:

1. Put this folder in its own GitHub repository.
2. Push the current branch to that repository.
3. Keep the repository public if you want anyone to view and clone it.
4. Let GitHub Actions run the included CI workflow so Windows, macOS, and Linux builds are checked automatically.

## Notes

- Everything in this app is local-first and offline-first.
- No trial executable is inspected, unpacked, patched, or reused.
- The current product direction is beginner-friendly on the surface, with deeper controls available in Pro mode.
