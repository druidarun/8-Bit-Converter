# Retro8 Video Converter — GitHub Pages build

Browser-only 8-bit style video converter. No backend is required.

## Fix in this build
- Replaced the failing ffmpeg.wasm 0.12 UMD loader with a mobile-friendly 0.11.6 loader.
- Uses the single-thread FFmpeg core, which does not require SharedArrayBuffer/cross-origin isolation.
- Tries jsDelivr first and unpkg as a fallback.
- Keeps processing on the user's device.

## GitHub Pages
Deploy the `main` branch from `/ (root)`.

For best results on mobile, test first with a short MP4 clip (5–10 seconds).
