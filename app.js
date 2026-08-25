const $ = id => document.getElementById(id);
const input = $('video');
const preview = $('preview');
const previewWrap = $('previewWrap');
const fileLabel = $('fileLabel');
const fileMeta = $('fileMeta');
const drop = $('drop');
const convertBtn = $('convert');
const status = $('status');
const statusText = $('statusText');
const percent = $('percent');
const progressBar = $('progressBar');
const result = $('result');
const resultPreview = $('resultPreview');
const download = $('download');
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { alpha: false });

let inputURL = null;
let resultURL = null;

function formatBytes(bytes) {
  const u=['B','KB','MB','GB']; let n=bytes,i=0;
  while(n>=1024&&i<u.length-1){n/=1024;i++}
  return `${n.toFixed(i?1:0)} ${u[i]}`;
}
function setProgress(v,t){
  const p=Math.max(0,Math.min(100,Math.round(v)));
  progressBar.style.width=p+'%'; percent.textContent=p+'%';
  if(t) statusText.textContent=t;
}
function selectFile(file){
  if(!file)return;
  if(!file.type.startsWith('video/')&&!/\.(mp4|mov|m4v|webm)$/i.test(file.name)){
    alert('Please choose a video file.'); return;
  }
  if(inputURL) URL.revokeObjectURL(inputURL);
  inputURL=URL.createObjectURL(file);
  preview.src=inputURL;
  previewWrap.classList.remove('hidden');
  fileLabel.textContent=file.name;
  fileMeta.textContent=`${formatBytes(file.size)} • processed locally on this device`;
  result.classList.add('hidden');
  setProgress(0,'Ready.');
}
input.addEventListener('change',()=>selectFile(input.files[0]));
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');selectFile(e.dataTransfer?.files?.[0])});

const presets={
  arcade:{pixelSize:'6',colors:'64',fps:'20',audioMode:'retro',audioRate:'16000'},
  retroaction:{pixelSize:'5',colors:'32',fps:'20',audioMode:'retro',audioRate:'16000'},
  comicpixel:{pixelSize:'4',colors:'48',fps:'20',audioMode:'retro',audioRate:'16000'},
  goldenbattle:{pixelSize:'6',colors:'24',fps:'18',audioMode:'retro',audioRate:'11025'},
  nes:{pixelSize:'8',colors:'32',fps:'15',audioMode:'retro',audioRate:'11025'},
  gameboy:{pixelSize:'12',colors:'8',fps:'15',audioMode:'clean8',audioRate:'8000'},
  extreme:{pixelSize:'24',colors:'8',fps:'10',audioMode:'retro',audioRate:'8000'}
};
$('preset').addEventListener('change',e=>{
  const p=presets[e.target.value];
  for(const [k,v] of Object.entries(p)) $(k).value=v;
});

function waitEvent(el,name){
  return new Promise((resolve,reject)=>{
    const ok=()=>{cleanup();resolve()};
    const bad=()=>{cleanup();reject(new Error('Could not load the video'))};
    const cleanup=()=>{el.removeEventListener(name,ok);el.removeEventListener('error',bad)};
    el.addEventListener(name,ok,{once:true}); el.addEventListener('error',bad,{once:true});
  });
}
function chooseMime(){
  const types=[
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return types.find(t=>window.MediaRecorder?.isTypeSupported?.(t)) || '';
}
function makeQuantCurve(levels){
  const len=65536, curve=new Float32Array(len);
  for(let i=0;i<len;i++){
    const x=i/(len-1)*2-1;
    curve[i]=Math.round(x*(levels-1))/(levels-1);
  }
  return curve;
}
function drawRetro(source,w,h,pixelSize,colors,preset){
  const sw=Math.max(2,Math.floor(w/pixelSize));
  const sh=Math.max(2,Math.floor(h/pixelSize));
  const off=document.createElement('canvas'); off.width=sw; off.height=sh;
  const o=off.getContext('2d',{alpha:false});
  o.imageSmoothingEnabled=false;
  o.drawImage(source,0,0,sw,sh);

  const img=o.getImageData(0,0,sw,sh);
  const d=img.data;
  const levels=Math.max(2,Math.round(Math.cbrt(colors)));
  const step=255/(levels-1);

  function clamp(x){ return Math.max(0,Math.min(255,x)); }
  function q(x,s=step){ return Math.round(clamp(x)/s)*s; }

  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    const lum=.299*r+.587*g+.114*b;

    if(preset==='gameboy'){
      const qv=Math.round(lum/85)*85;
      r=qv*.55; g=qv*.75; b=qv*.45;
    } else if(preset==='retroaction'){
      // Warm, high-contrast cinematic pixel look:
      // crush shadows, lift golds, mute cool colors, posterize hard.
      const contrast=1.45;
      r=(r-128)*contrast+128;
      g=(g-128)*contrast+128;
      b=(b-128)*contrast+128;

      // Warm grade
      r=r*1.18+18;
      g=g*1.02+5;
      b=b*.72-8;

      // Push bright regions toward yellow/gold
      if(lum>145){ r+=24; g+=15; b-=12; }
      if(lum<72){ r*=.58; g*=.48; b*=.42; }

      // Coarse palette
      const s=42;
      r=q(r,s); g=q(g,s); b=q(b,s);

    } else if(preset==='comicpixel'){
      const contrast=1.55;
      r=(r-128)*contrast+128;
      g=(g-128)*contrast+128;
      b=(b-128)*contrast+128;

      const sat=1.45;
      const y=.299*r+.587*g+.114*b;
      r=y+(r-y)*sat; g=y+(g-y)*sat; b=y+(b-y)*sat;

      // Ink-like shadow crush
      if(y<78){ r*=.38; g*=.38; b*=.38; }
      r=q(r,34); g=q(g,34); b=q(b,34);

    } else if(preset==='goldenbattle'){
      // Restrained amber/brown battlefield palette
      const y=lum;
      r=y*1.18+34;
      g=y*.82+20;
      b=y*.40+5;

      if(y<80){ r*=.62; g*=.52; b*=.45; }
      if(y>175){ r+=22; g+=15; }
      r=q(r,38); g=q(g,38); b=q(b,38);

    } else {
      const sat=preset==='arcade'?1.25:(preset==='extreme'?1.1:1.0);
      const y=.299*r+.587*g+.114*b;
      r=y+(r-y)*sat; g=y+(g-y)*sat; b=y+(b-y)*sat;
      r=q(r); g=q(g); b=q(b);
    }

    // Lightweight ordered dithering for cinematic presets.
    if(preset==='retroaction'||preset==='comicpixel'||preset==='goldenbattle'){
      const px=(i/4)%sw;
      const py=Math.floor((i/4)/sw);
      const matrix=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
      const threshold=(matrix[py%4][px%4]-7.5)*2.2;
      r=clamp(r+threshold); g=clamp(g+threshold); b=clamp(b+threshold);
    }

    d[i]=r; d[i+1]=g; d[i+2]=b;
  }

  o.putImageData(img,0,0);

  // Simple dark edge pass for the cinematic/comic presets.
  if(preset==='retroaction'||preset==='comicpixel'||preset==='goldenbattle'){
    const base=o.getImageData(0,0,sw,sh);
    const out=new ImageData(new Uint8ClampedArray(base.data),sw,sh);
    const bd=base.data, od=out.data;
    for(let y=1;y<sh-1;y++){
      for(let x=1;x<sw-1;x++){
        const idx=(y*sw+x)*4;
        const l0=.299*bd[idx]+.587*bd[idx+1]+.114*bd[idx+2];
        const ir=(y*sw+x+1)*4;
        const id=((y+1)*sw+x)*4;
        const lr=.299*bd[ir]+.587*bd[ir+1]+.114*bd[ir+2];
        const ld=.299*bd[id]+.587*bd[id+1]+.114*bd[id+2];
        const edge=Math.abs(l0-lr)+Math.abs(l0-ld);
        if(edge>(preset==='comicpixel'?48:62)){
          const strength=preset==='comicpixel'?.38:.55;
          od[idx]*=strength; od[idx+1]*=strength; od[idx+2]*=strength;
        }
      }
    }
    o.putImageData(out,0,0);
  }

  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(off,0,0,sw,sh,0,0,w,h);
}

async function convertNative(file){
  if(!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream){
    throw new Error('This browser does not support local video recording. Please use a recent Chrome or Edge browser.');
  }
  const mime=chooseMime();
  if(!mime) throw new Error('This browser cannot create a WebM video.');

  const v=document.createElement('video');
  v.src=URL.createObjectURL(file);
  v.playsInline=true; v.preload='auto'; v.muted=false;
  await waitEvent(v,'loadedmetadata');

  const maxWidth=960;
  const scale=Math.min(1,maxWidth/v.videoWidth);
  const w=Math.max(2,Math.floor(v.videoWidth*scale/2)*2);
  const h=Math.max(2,Math.floor(v.videoHeight*scale/2)*2);
  canvas.width=w; canvas.height=h;

  const fps=Number($('fps').value);
  const pixelSize=Number($('pixelSize').value);
  const colors=Number($('colors').value);
  const preset=$('preset').value;
  const audioMode=$('audioMode').value;
  const audioRate=Number($('audioRate').value);

  const canvasStream=canvas.captureStream(fps);
  const tracks=[...canvasStream.getVideoTracks()];

  let audioCtx=null, sourceNode=null, dest=null;
  try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    await audioCtx.resume();
    sourceNode=audioCtx.createMediaElementSource(v);
    dest=audioCtx.createMediaStreamDestination();

    let node=sourceNode;
    if(audioMode!=='original'){
      const low=audioCtx.createBiquadFilter();
      low.type='lowpass';
      low.frequency.value=Math.min(6500,Math.max(2500,audioRate*.36));
      node.connect(low); node=low;

      const shaper=audioCtx.createWaveShaper();
      shaper.curve=makeQuantCurve(audioMode==='retro'?16:32);
      shaper.oversample='none';
      node.connect(shaper); node=shaper;

      if(audioMode==='retro'){
        const comp=audioCtx.createDynamicsCompressor();
        comp.threshold.value=-22; comp.ratio.value=5;
        node.connect(comp); node=comp;
      }
    }
    node.connect(dest);
    dest.stream.getAudioTracks().forEach(t=>tracks.push(t));
  }catch(e){
    console.warn('Audio processing unavailable, continuing without processed audio',e);
  }

  const outStream=new MediaStream(tracks);
  const chunks=[];
  const rec=new MediaRecorder(outStream,{mimeType:mime,videoBitsPerSecond:2200000,audioBitsPerSecond:64000});
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};

  let stopResolve;
  const stopped=new Promise(r=>stopResolve=r);
  rec.onstop=stopResolve;

  const duration=v.duration || 1;
  let raf=0, stoppedFlag=false;
  function frame(){
    if(stoppedFlag)return;
    drawRetro(v,w,h,pixelSize,colors,preset);
    const p=Math.min(99,(v.currentTime/duration)*100);
    setProgress(p,`Converting on your device… ${Math.floor(v.currentTime)}s / ${Math.ceil(duration)}s`);
    raf=requestAnimationFrame(frame);
  }

  v.currentTime=0;
  rec.start(500);
  await v.play();
  frame();

  await new Promise((resolve,reject)=>{
    v.addEventListener('ended',resolve,{once:true});
    v.addEventListener('error',()=>reject(new Error('Playback failed during conversion')),{once:true});
  });

  stoppedFlag=true;
  cancelAnimationFrame(raf);
  try{rec.stop()}catch(_){}
  await stopped;

  try{v.pause()}catch(_){}
  URL.revokeObjectURL(v.src);
  outStream.getTracks().forEach(t=>t.stop());
  try{await audioCtx?.close()}catch(_){}

  if(!chunks.length) throw new Error('The browser did not produce an output video.');
  return new Blob(chunks,{type:mime});
}

convertBtn.addEventListener('click',async()=>{
  const file=input.files[0];
  if(!file){alert('Choose a video first.');return}
  if(file.size>300*1024*1024){
    if(!confirm('This is a large video. Browser conversion may use a lot of memory. Continue?'))return;
  }
  convertBtn.disabled=true;
  status.classList.remove('hidden');
  result.classList.add('hidden');
  setProgress(1,'Preparing browser-native converter…');
  try{
    const blob=await convertNative(file);
    if(resultURL) URL.revokeObjectURL(resultURL);
    resultURL=URL.createObjectURL(blob);
    resultPreview.src=resultURL;
    download.href=resultURL;
    download.download='retro8-video.webm';
    result.classList.remove('hidden');
    setProgress(100,'Finished.');
    result.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){
    console.error(e);
    setProgress(0,'Conversion failed.');
    alert(e?.message||'Conversion failed in this browser.');
  }finally{
    convertBtn.disabled=false;
  }
});
