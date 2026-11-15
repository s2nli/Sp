// Video mode (Nazriya /api/video, 1080p). The audio element stays the master clock; a muted <video> follows it.
const CL=window.CL,{S,au,toast}=CL,$=s=>document.querySelector(s);
document.head.insertAdjacentHTML('beforeend','<style>'
+'#nzbox{position:relative;width:min(100%,440px);aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;margin:auto 0;box-shadow:0 24px 60px rgba(0,0,0,.5);display:none}'
+'#nzbox video{width:100%;height:100%;object-fit:contain;display:block;background:#000}'
+'#nzbox .nzb{position:absolute;top:6px;right:6px;display:flex;gap:6px}'
+'#nzbox .nzb button{width:34px;height:34px;border-radius:99px;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:16px;cursor:pointer}'
+'#nzbox .nzs{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#fff;font-size:13px;background:rgba(0,0,0,.35);pointer-events:none}'
+'#nzbox.ld .nzs{display:flex}'
+'#np.vid #npart{display:none}#np.vid #nzbox{display:block}'
+'#nzbox.fl{position:fixed;right:16px;bottom:106px;width:min(420px,60vw);margin:0;z-index:70;display:block}'
+'#vdbtn.on,#npvid.on{color:var(--a,#1ed760)}'
+'</style>');
const box=document.createElement('div');box.id='nzbox';
box.innerHTML='<video id="nzv" muted playsinline preload="auto"></video><div class="nzs">Loading video…</div><div class="nzb"><button id="nzfs" aria-label="Fullscreen" title="Fullscreen">⛶</button><button id="nzx" aria-label="Close video" title="Close video">✕</button></div>';
const v=box.querySelector('video');v.setAttribute('playsinline','');v.muted=true;
let on=false;
const cur=()=>S.q[S.i];
const query=t=>t?.nzq||((t?.title||'')+' '+(t?.artist||'')).trim();
const vurl=t=>t.video||`${location.origin}/api/nz?kind=video&q=${encodeURIComponent(query(t))}`;
const floating=()=>getComputedStyle($('#np')).display==='none';
function place(){
 if(floating()){box.classList.add('fl');$('#np').classList.remove('vid');document.body.append(box)}
 else{box.classList.remove('fl');$('.npartw').append(box);$('#np').classList.add('vid')}
}
function mark(){for(const id of['#vdbtn','#npvid']){const b=$(id);if(b)b.classList.toggle('on',on)}}
function sync(force){
 if(!on||!v.src)return;
 if(v.readyState>=2&&(force||Math.abs(au.currentTime-v.currentTime)>.5)){try{v.currentTime=au.currentTime}catch{}}
 if(v.playbackRate!==au.playbackRate)v.playbackRate=au.playbackRate||1;
 if(au.paused&&!v.paused)v.pause();
 else if(!au.paused&&v.paused&&v.readyState>=2)v.play().catch(()=>{});
}
function load(){
 const t=cur();if(!on)return;
 if(!t||t.live||t.local){stop();toast('Video is not available for this item');return}
 const u=vurl(t);if(v.dataset.u===u)return;
 v.dataset.u=u;box.classList.add('ld');v.src=u;v.load();
}
function start(){
 const t=cur();if(!t)return toast('Play a song first');
 if(t.live||t.local)return toast('Video is not available for this item');
 on=true;place();mark();load();
}
function stop(){
 on=false;v.pause();v.removeAttribute('src');delete v.dataset.u;v.load();box.classList.remove('ld','fl');box.style.display='';$('#np').classList.remove('vid');box.remove();mark();
}
const toggle=()=>on?stop():start();
$('#vdbtn')?.addEventListener('click',toggle);
$('#npvid')?.addEventListener('click',toggle);
box.querySelector('#nzx').onclick=stop;
box.querySelector('#nzfs').onclick=()=>{const f=v.requestFullscreen||v.webkitRequestFullscreen;if(document.fullscreenElement){document.exitFullscreen?.()}else if(f)f.call(box.requestFullscreen?box:v);else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen()};
v.addEventListener('loadedmetadata',()=>{try{v.currentTime=au.currentTime}catch{}});
v.addEventListener('canplay',()=>{box.classList.remove('ld');sync(true)});
v.addEventListener('playing',()=>box.classList.remove('ld'));
v.addEventListener('waiting',()=>box.classList.add('ld'));
v.addEventListener('error',()=>{if(!on||!v.getAttribute('src'))return;toast('Video not available for this song');stop()});
/* follow the audio */
au.addEventListener('loadstart',()=>{if(on)load()});
au.addEventListener('play',()=>sync(true));
au.addEventListener('playing',()=>sync(true));
au.addEventListener('pause',()=>{if(on)v.pause()});
au.addEventListener('waiting',()=>{if(on)v.pause()});
au.addEventListener('seeked',()=>sync(true));
au.addEventListener('ratechange',()=>sync());
au.addEventListener('ended',()=>{if(on)v.pause()});
setInterval(()=>{if(on&&!document.hidden)sync()},500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync(true)});
/* switching between phone and desktop layout while the video is open */
addEventListener('resize',()=>{if(on)place()});
