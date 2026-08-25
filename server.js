const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const workDir = path.join(__dirname, 'work');
fs.mkdirSync(workDir, { recursive: true });

const upload = multer({
  dest: workDir,
  limits: { fileSize: 1024 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function safeUnlink(file) {
  if (file && fs.existsSync(file)) {
    try { fs.unlinkSync(file); } catch (_) {}
  }
}

function presetFilters(preset, pixelSize, colors, fps) {
  const p = Math.max(2, Math.min(32, Number(pixelSize) || 8));
  const f = Math.max(8, Math.min(30, Number(fps) || 15));
  const c = Math.max(4, Math.min(256, Number(colors) || 32));

  let width = 320;
  let saturation = 1.0;
  let contrast = 1.0;
  let brightness = 0.0;

  if (preset === 'gameboy') {
    width = 240; saturation = 0.18; contrast = 1.15; brightness = 0.02;
  } else if (preset === 'nes') {
    width = 256; saturation = 1.15; contrast = 1.08;
  } else if (preset === 'arcade') {
    width = 320; saturation = 1.35; contrast = 1.12;
  } else if (preset === 'extreme') {
    width = 192; saturation = 1.45; contrast = 1.22;
  }

  // Pixelate using a small internal resolution, then restore with nearest-neighbour.
  // Palette generation/splitting keeps the color count intentionally limited.
  const vf = [
    `fps=${f}`,
    `scale=${Math.max(64, Math.floor(width / p) * p)}:-2:flags=area`,
    `scale=iw/${p}:ih/${p}:flags=area`,
    `scale=iw*${p}:ih*${p}:flags=neighbor`,
    `eq=saturation=${saturation}:contrast=${contrast}:brightness=${brightness}`,
    `split[a][b]`,
    `[a]palettegen=max_colors=${c}:stats_mode=diff[p]`,
    `[b][p]paletteuse=dither=bayer:bayer_scale=3`
  ].join(',');

  return { vf, fps: f };
}

app.post('/api/convert', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video uploaded.' });

  const id = uuidv4();
  const input = req.file.path;
  const output = path.join(workDir, `${id}.mp4`);

  const preset = req.body.preset || 'nes';
  const pixelSize = req.body.pixelSize || 8;
  const colors = req.body.colors || 32;
  const fps = req.body.fps || 15;
  const audioRate = Math.max(8000, Math.min(44100, Number(req.body.audioRate) || 11025));
  const audioMode = req.body.audioMode || 'retro';

  const { vf } = presetFilters(preset, pixelSize, colors, fps);

  // "8-bit sound" here means deliberately lo-fi: low sample rate, mono, and quantization-like distortion.
  const audioFilter = audioMode === 'clean8'
    ? `aresample=${audioRate},aformat=sample_fmts=u8:channel_layouts=mono`
    : `aresample=${audioRate},aformat=sample_fmts=u8:channel_layouts=mono,acrusher=bits=8:mode=log:mix=1`;

  const args = [
    '-y',
    '-i', input,
    '-vf', vf,
    '-af', audioFilter,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    output
  ];

  const ff = spawn('ffmpeg', args);
  let stderr = '';
  ff.stderr.on('data', d => { stderr += d.toString(); });

  ff.on('error', err => {
    safeUnlink(input);
    return res.status(500).json({ error: 'FFmpeg is not installed on the server.', details: err.message });
  });

  ff.on('close', code => {
    safeUnlink(input);
    if (code !== 0 || !fs.existsSync(output)) {
      safeUnlink(output);
      return res.status(500).json({ error: 'Conversion failed.', details: stderr.slice(-1500) });
    }
    res.json({ download: `/api/download/${id}`, filename: `retro8-${Date.now()}.mp4` });
  });
});

app.get('/api/download/:id', (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9-]/g, '');
  const file = path.join(workDir, `${id}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).send('File not found or expired.');

  res.download(file, 'retro8-video.mp4', () => {
    setTimeout(() => safeUnlink(file), 10_000);
  });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Retro8 running on port ${PORT}`));
