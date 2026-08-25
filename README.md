# Retro8 Browser-Native Converter

This build removes FFmpeg.wasm entirely.

It uses:
- Canvas for pixel-art video processing
- Web Audio API for 8-bit-style audio quantization
- MediaRecorder for local WebM export

No backend, no Render, and no external video-processing library are required.

For best results use a recent Chrome or Edge browser. Conversion runs approximately in real time.


## Added cinematic pixel themes
- Retro Action / 16-bit Cinematic
- Comic Pixel
- Golden Battlefield

## Sunset Noir Pixel
A fixed 16-colour orange/navy cinematic palette with:
- deep navy shadows
- burnt orange and gold mid-tones
- pale yellow highlights
- strong dark contours
- ordered dithering
- crisp nearest-neighbour pixel scaling

This preset is designed to resemble the supplied orange/navy pixel-animation reference. Exact results vary with the lighting and colours of the source video.
