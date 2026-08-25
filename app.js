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
  videoInput.files = makeFileList(file);
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

function makeFileList(file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  return dt.files;
}

videoInput.addEventListener('change', () => selectFile(videoInput.files[0]));

drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('drag');
  selectFile(e.dataTransfer.files[0]);
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

async function loadEngine() {
  if (engineLoaded) return;
  if (!window.FFmpegWASM || !window.FFmpegUtil) {
    throw new Error('The browser FFmpeg library could not be loaded. Check your internet connection and refresh the page.');
  }

  setProgress(2, 'Loading video engine for the first time…');
  const { FFmpeg } = FFmpegWASM;
  const { toBlobURL } = FFmpegUtil;
  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    if (Number.isFinite(progress)) setProgress(10 + progress * 85, 'Converting video on your device…');
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
  });
  engineLoaded = true;
  setProgress(8, 'Video engine ready.');
}

function buildVideoFilter(pixelSize, colors, fps, preset) {
  let style = 'eq=contrast=1.08:saturation=1.10';
  if (preset === 'arcade') style = 'eq=contrast=1.16:saturation=1.35';
  if (preset === 'gameboy') style = 'eq=contrast=1.12:saturation=0.25';
  if (preset === 'extreme') style = 'eq=contrast=1.25:saturation=1.15';

  return [
    `fps=${fps}`,
    style,
    `scale=max(2,trunc(iw/${pixelSize}/2)*2):max(2,trunc(ih/${pixelSize}/2)*2):flags=neighbor`,
    `scale=iw*${pixelSize}:ih*${pixelSize}:flags=neighbor`,
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    'split[v1][v2]',
    `[v1]palettegen=max_colors=${colors}:stats_mode=diff[p]`,
    '[v2][p]paletteuse=dither=bayer:bayer_scale=4'
  ].join(',').replace(',[v1]', ';[v1]');
}

function buildAudioFilter(mode, rate) {
  if (mode === 'original') return `aresample=${rate}`;
  if (mode === 'clean8') return `aresample=${rate},aformat=sample_fmts=u8:channel_layouts=mono,aresample=${rate}`;
  return `aresample=${rate},aformat=sample_fmts=u8:channel_layouts=mono,acrusher=bits=8:mode=lin:aa=1,lowpass=f=4200,aresample=${rate}`;
}

async function safeDelete(name) {
  try { await ffmpeg.deleteFile(name); } catch (_) {}
}

convertBtn.addEventListener('click', async () => {
  const file = videoInput.files[0];
  if (!file) { alert('Choose a video first.'); return; }

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
    const { fetchFile } = FFmpegUtil;
    await safeDelete(inputName);
    await safeDelete(outputName);
    setProgress(9, 'Reading your video…');
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const pixelSize = Number($('pixelSize').value);
    const colors = Number($('colors').value);
    const fps = Number($('fps').value);
    const preset = $('preset').value;
    const audioMode = $('audioMode').value;
    const audioRate = Number($('audioRate').value);
    const vf = buildVideoFilter(pixelSize, colors, fps, preset);
    const af = buildAudioFilter(audioMode, audioRate);

    const argsWithAudio = [
      '-i', inputName,
      '-filter_complex', `[0:v]${vf}[v]`,
      '-map', '[v]', '-map', '0:a?',
      '-af', af,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25',
      '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-ar', String(audioRate),
      '-movflags', '+faststart', '-shortest', outputName
    ];

    let code = await ffmpeg.exec(argsWithAudio);
    if (code !== 0) {
      await safeDelete(outputName);
      setProgress(18, 'Retrying without audio processing…');
      code = await ffmpeg.exec([
        '-i', inputName,
        '-filter_complex', `[0:v]${vf}[v]`,
        '-map', '[v]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25',
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart', '-shortest', outputName
      ]);
    }
    if (code !== 0) throw new Error('FFmpeg could not convert this file. Try a shorter MP4/WebM clip or a smaller resolution.');

    setProgress(96, 'Preparing your download…');
    const data = await ffmpeg.readFile(outputName);
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

    await safeDelete(inputName);
    await safeDelete(outputName);
  } catch (err) {
    console.error(err);
    setProgress(0, 'Conversion failed.');
    alert(err?.message || 'Conversion failed.');
  } finally {
    convertBtn.disabled = false;
  }
});
