# Retro8 Video Converter — Browser Edition

A static web app that converts video to a retro pixel/8-bit style directly in the user's browser using FFmpeg WebAssembly.

## Why this version

- No Node server required.
- No Render/Docker deployment required.
- Videos stay on the user's device instead of being uploaded to an app server.
- Can be hosted with GitHub Pages or another static host.

## Files

- `index.html`
- `style.css`
- `app.js`
- `.nojekyll`

## GitHub Pages deployment

1. Put these files in the root of the repository.
2. Commit and push them to the `main` branch.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site.

## Notes

FFmpeg WebAssembly downloads its browser engine from a public CDN on first use. Conversion uses device CPU/RAM. Large 4K files may be slow or exceed mobile-browser memory; shorter clips and 720p/1080p inputs work better.
