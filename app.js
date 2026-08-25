const $ = (id) => document.getElementById(id);
const videoInput = $('video');
const fileLabel = $('fileLabel');
const fileMeta = $('fileMeta');
const preview = $('preview');
const previewWrap = $('previewWrap');
const convertBtn = $('convert');
const status = $('status');
const statusText = $('statusText');
const percent = $('percent');
const progressBar = $('progressBar');
const spinner = $('spinner');
const result = $('result');
const resultPreview = $('resultPreview');
const download = $('download');
const drop = $('drop');

let inputURL = null;
let resultURL = null;
let ffmpeg = null;
let engineLoaded = false;
let fetchFileFn = null;

function formatBytes(bytes) {
  const units = ['B','KB','MB','GB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function setProgress(value, text) {
  const p = Math.max(0, Math.min(100, Math.round(value)));
  progressBar.style.width = `${p}%`;
  percent.textContent = `${p}%`;
  if (text) statusText.textContent = text;
}

function selectFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|mkv|avi|webm|m4v)$/i.test(file.name)) {
    alert('Please choose a video file.');
    return;
  }
  fileLabel.textContent = file.name;
  fileMeta.textContent = `${formatBytes(file.size)} • processed locally on this device`;
  fileMeta.classList.remove('hidden');
  if (inputURL) URL.revokeObjectURL(inputURL);
  inputURL = URL.createObjectURL(file);
  preview.src = inputURL;
  previewWrap.classList.remove('hidden');
  result.classList.add('hidden');
  setProgress(0, 'Ready.');
}

videoInput.addEventListener('change', () => selectFile(videoInput.files[0]));
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('drag');
  const file = e.dataTransfer?.files?.[0];
  if (file) selectFile(file);
});

const presetValues = {
  nes: { pixelSize: '8', colors: '32', fps: '15', audioMode: 'retro', audioRate: '11025' },
  gameboy: { pixelSize: '12', colors: '8', fps: '15', audioMode: 'clean8', audioRate: '8000' },
  arcade: { pixelSize: '6', colors: '64', fps: '20', audioMode: 'retro', audioRate: '16000' },
  extreme: { pixelSize: '24', colors: '8', fps: '10', audioMode: 'retro', audioRate: '8000' }
};

$('preset').addEventListener('change', (e) => {
  const p = presetValues[e.target.value];
  Object.entries(p).forEach(([id, value]) => $(id).value = value);
});

function loadScript(src, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      s.remove();
      reject(new Error(`Timed out loading ${src}`));
    }, timeoutMs);
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    s.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      s.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(s);
  });
}

async function ensureLegacyFFmpegLibrary() {
  if (window.FFmpeg?.createFFmpeg) return;
  const candidates = [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'
  ];
  let lastError;
  for (const src of candidates) {
    try {
      await loadScript(src);
      if (window.FFmpeg?.createFFmpeg) return;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error('FFmpeg could not be loaded in this browser. Please use an up-to-date Chrome or Edge browser and reload the page.');
}

async function loadEngine() {
  if (engineLoaded) return;
  setProgress(2, 'Loading the video engine…');
  await ensureLegacyFFmpegLibrary();

  const { createFFmpeg, fetchFile } = window.FFmpeg;
  fetchFileFn = fetchFile;
  const coreCandidates = [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
  ];

  let lastError;
  for (const corePath of coreCandidates) {
    try {
      ffmpeg = createFFmpeg({
        log: false,
        corePath,
        progress: ({ ratio }) => {
          if (Number.isFinite(ratio)) setProgress(10 + ratio * 84, 'Converting video on your device…');
        }
      });
      await ffmpeg.load();
      engineLoaded = true;
      setProgress(8, 'Video engine ready.');
      return;
    } catch (e) {
      lastError = e;
      ffmpeg = null;
    }
  }
  console.error(lastError);
  throw new Error('The FFmpeg engine could not start. Check your internet connection, then reload the page.');
}

function buildVideoFilter(pixelSize, colors, fps, preset) {
  let style = 'eq=contrast=1.08:saturation=1.10';
  if (preset === 'arcade') style = 'eq=contrast=1.16:saturation=1.35';
  if (preset === 'gameboy') style = 'eq=contrast=1.12:saturation=0.25';
  if (preset === 'extreme') style = 'eq=contrast=1.25:saturation=1.15';

  const down = `scale=max(2,trunc(iw/${pixelSize}/2)*2):max(2,trunc(ih/${pixelSize}/2)*2):flags=neighbor`;
  const up = `scale=iw*${pixelSize}:ih*${pixelSize}:flags=neighbor`;
  return `[0:v]fps=${fps},${style},${down},${up},scale=trunc(iw/2)*2:trunc(ih/2)*2,split[v1][v2];` +
         `[v1]palettegen=max_colors=${colors}:stats_mode=diff[p];` +
         `[v2][p]paletteuse=dither=bayer:bayer_scale=4[v]`;
}

function buildAudioFilter(mode, rate) {
  if (mode === 'original') return `aresample=${rate}`;
  if (mode === 'clean8') return `aresample=${rate},aformat=sample_fmts=u8:channel_layouts=mono`;
  // "8-bit" character without relying on optional acrusher builds.
  return `aresample=${rate},aformat=sample_fmts=u8:channel_layouts=mono,lowpass=f=4200`;
}

function safeUnlink(name) {
  if (!ffmpeg) return;
  try { ffmpeg.FS('unlink', name); } catch (_) {}
}

async function runFFmpeg(args) {
  await ffmpeg.run(...args);
}

convertBtn.addEventListener('click', async () => {
  const file = videoInput.files[0];
  if (!file) { alert('Choose a video first.'); return; }
  if (file.size > 350 * 1024 * 1024) {
    const ok = confirm('This video is quite large for browser conversion and may run out of memory. Continue anyway?');
    if (!ok) return;
  }

  convertBtn.disabled = true;
  status.classList.remove('hidden');
  result.classList.add('hidden');
  spinner.classList.remove('done');
  setProgress(1, 'Preparing converter…');

  const ext = (file.name.split('.').pop() || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const inputName = `input.${ext || 'mp4'}`;
  const outputName = 'retro8-output.mp4';

  try {
    await loadEngine();
    safeUnlink(inputName);
    safeUnlink(outputName);
    setProgress(9, 'Reading your video…');
    ffmpeg.FS('writeFile', inputName, await fetchFileFn(file));

    const pixelSize = Number($('pixelSize').value);
    const colors = Number($('colors').value);
    const fps = Number($('fps').value);
    const preset = $('preset').value;
    const audioMode = $('audioMode').value;
    const audioRate = Number($('audioRate').value);
    const filterGraph = buildVideoFilter(pixelSize, colors, fps, preset);
    const af = buildAudioFilter(audioMode, audioRate);

    const commonVideo = [
      '-filter_complex', filterGraph,
      '-map', '[v]',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart'
    ];

    try {
      await runFFmpeg([
        '-i', inputName,
        ...commonVideo,
        '-map', '0:a?', '-af', af,
        '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-ar', String(audioRate),
        '-shortest', outputName
      ]);
    } catch (audioErr) {
      console.warn('Audio processing retry:', audioErr);
      safeUnlink(outputName);
      setProgress(18, 'Retrying with simpler audio…');
      await runFFmpeg([
        '-i', inputName,
        ...commonVideo,
        '-map', '0:a?', '-c:a', 'aac', '-b:a', '96k',
        '-shortest', outputName
      ]);
    }

    setProgress(96, 'Preparing your download…');
    const data = ffmpeg.FS('readFile', outputName);
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    if (resultURL) URL.revokeObjectURL(resultURL);
    resultURL = URL.createObjectURL(blob);
    resultPreview.src = resultURL;
    download.href = resultURL;
    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    download.download = `${base}-retro8.mp4`;
    result.classList.remove('hidden');
    spinner.classList.add('done');
    setProgress(100, `Done — ${formatBytes(blob.size)}`);

    safeUnlink(inputName);
    safeUnlink(outputName);
  } catch (err) {
    console.error(err);
    setProgress(0, 'Conversion failed.');
    alert(err?.message || 'Conversion failed.');
  } finally {
    convertBtn.disabled = false;
  }
});
