const videoInput=document.getElementById('video');
const fileLabel=document.getElementById('fileLabel');
const preview=document.getElementById('preview');
const previewWrap=document.getElementById('previewWrap');
const convert=document.getElementById('convert');
const status=document.getElementById('status');
const statusText=document.getElementById('statusText');
const download=document.getElementById('download');
let localUrl=null;

videoInput.addEventListener('change',()=>{
  const f=videoInput.files[0]; if(!f)return;
  fileLabel.textContent=f.name;
  if(localUrl) URL.revokeObjectURL(localUrl);
  localUrl=URL.createObjectURL(f);
  preview.src=localUrl;
  previewWrap.classList.remove('hidden');
  download.classList.add('hidden');
});

convert.addEventListener('click',async()=>{
  const f=videoInput.files[0];
  if(!f){alert('Choose a video first.');return;}
  const fd=new FormData();
  fd.append('video',f);
  ['preset','pixelSize','colors','fps','audioMode','audioRate'].forEach(id=>fd.append(id,document.getElementById(id).value));
  convert.disabled=true; status.classList.remove('hidden'); download.classList.add('hidden');
  statusText.textContent='Converting your video…';
  try{
    const r=await fetch('/api/convert',{method:'POST',body:fd});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error+(data.details?' — '+data.details:''));
    download.href=data.download;
    download.download=data.filename || 'retro8-video.mp4';
    download.classList.remove('hidden');
    statusText.textContent='Conversion complete.';
  }catch(e){
    statusText.textContent='Conversion failed.';
    alert(e.message);
  }finally{convert.disabled=false;}
});
