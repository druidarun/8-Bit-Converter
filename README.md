# Retro8 Video Converter

A web app that converts uploaded videos into a retro 8-bit style using FFmpeg.

## Features
- NES, Game Boy, Arcade and Extreme Pixel presets
- Adjustable pixel size, colour count and frame rate
- Lo-fi 8-bit-style mono audio
- MP4 output
- Uploaded files removed after processing/download

## Run with Docker
```bash
docker build -t retro8 .
docker run -p 3000:3000 retro8
```
Open http://localhost:3000

## Deploy on Render
1. Create a new GitHub repository and upload these files.
2. In Render choose **New > Web Service** and connect the repo.
3. Render should detect the Dockerfile. Use Docker runtime.
4. Deploy.

Note: Video conversion is CPU-intensive. Very large 4K files may hit memory/time limits on low-cost hosting plans.
