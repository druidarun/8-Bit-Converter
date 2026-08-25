# Retro8 Browser-Native Converter

This build removes FFmpeg.wasm entirely.

It uses:
- Canvas for pixel-art video processing
- Web Audio API for 8-bit-style audio quantization
- MediaRecorder for local WebM export

No backend, no Render, and no external video-processing library are required.

For best results use a recent Chrome or Edge browser. Conversion runs approximately in real time.
