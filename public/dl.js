// Spotify: in-app downloads. Saves any song into the Downloads page (IndexedDB), playable offline.
const CL=window.CL,$=s=>document.querySelector(s),{all,put,strip,toast,au,S}=CL;
const lsj=(k,d)=>{try{return JSON.parse(localStorage[k])??d}catch{return d}};
const have=new Set(),busy=new Set();
const refresh=async()=>{try{have.clear();(await all('offline')).forEach(x=>have.add(x.id))}catch{}icon()};
const SVG=(c,p)=>`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const DL='<path d="M12 4v11m0 0-5-5m5 5 5-5M5 20h14"/>',OKI='<circle cx="12" cy="12" r="10" fill="#1ed760" stroke="none"/><path d="M7.5 12.5l3 3L16.5 9" stroke="#000"/>';
function icon(){const b=$('#npdl');if(!b)return;const t=S.q[S.i],d=t&&have.has(t.id),w=t&&busy.has(t.id);b.innerHTML=d?SVG('currentColor',OKI):SVG('currentColor',DL);b.style.opacity=t?(w?.5:1):.4;b.setAttribute('aria-label',d?'Downloaded':'Download')}
async function grab(url,lim,used,prog){
 const r=await fetch(url);if(!r.ok||!r.body)throw 0;
 const tot=+r.headers.get('content-length')||0;if(tot&&used+tot>lim)throw 'quota';
 const rd=r.body.getReader(),ch=[];let n=0;
 for(;;){const{done,value}=await rd.read();if(done)break;ch.push(value);n+=value.length;if(used+n>lim)throw 'quota';prog(n,tot)}
 const blob=new Blob(ch,{type:(r.headers.get('content-type')||'audio/mpeg').split(';')[0]});
 if(blob.size<20000)throw 0;return blob}
CL.download=async t=>{
 if(!t)return toast('Nothing to download');
 if(t.live)return toast('Live radio can\'t be downloaded');
 if(t.local)return toast('Already on your device');
 if(have.has(t.id))return toast('Already in Downloads');
 if(busy.has(t.id))return toast('Already downloading…');
 const urls=[...new Set([t.dl,...(t.streams||[]),...((t.alts||[]).flatMap(a=>[a.dl,...(a.streams||[])]))].filter(u=>/^https?:/.test(u||'')))].slice(0,4);
 if(!urls.length)return toast('No download link for this song');
 busy.add(t.id);icon();toast('Downloading…');
 const lim=lsj('cl_quota',500)*1048576;let blob=null,why='';
 try{
  const used=(await all('offline')).reduce((a,x)=>a+x.size,0);
  const prog=(n,tot)=>toast(tot?`Downloading ${Math.round(n/tot*100)}%`:`Downloading ${(n/1048576).toFixed(1)} MB`);
  for(const u of urls){
   for(const via of [u,'/api/audio?u='+encodeURIComponent(u)]){
    try{blob=await grab(via,lim,used,prog);break}catch(e){if(e==='quota'){why='quota';break}}
   }
   if(blob||why)break;
  }
  if(blob){await put('offline',{id:t.id,track:strip(t),blob,size:blob.size,at:Date.now()});have.add(t.id);toast('Downloaded · see Downloads tab');if(location.hash==='#downloads')CL.route()}
  else if(why==='quota')toast('Over your offline storage limit (Settings)');
  else toast('Couldn\'t download this song. The provider blocked it; try another version of the song.');
 }catch{toast('Download failed')}
 busy.delete(t.id);icon();
};
// now-playing download button
const top=$('#np .top');
if(top&&!$('#npdl')){const b=document.createElement('button');b.id='npdl';b.type='button';b.innerHTML=SVG('currentColor',DL);top.insertBefore(b,$('#npmore'));b.onclick=()=>CL.download(S.q[S.i])}
['loadstart','emptied','playing'].forEach(e=>au.addEventListener(e,icon));
new MutationObserver(icon).observe($('#tt'),{childList:true});
refresh();
addEventListener('hashchange',refresh);
CL.dlRefresh=refresh;

// Save a song as a real audio file on the phone (goes to the browser's Downloads folder)
const saving=new Set();
const EXT={'audio/mpeg':'mp3','audio/mp3':'mp3','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/aac':'aac','audio/ogg':'ogg','audio/webm':'webm','audio/wav':'wav','audio/x-wav':'wav','audio/flac':'flac','video/mp4':'m4a','video/webm':'webm'};
const fname=(t,type)=>((t.artist?t.artist+' - ':'')+(t.title||'song')).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/\s+/g,' ').trim().slice(0,120)+'.'+(EXT[(type||'').toLowerCase()]||'mp3');
CL.saveFile=async t=>{
 if(!t)return toast('Nothing to save');
 if(t.live)return toast('Live radio can\'t be saved');
 if(saving.has(t.id))return toast('Already saving…');
 saving.add(t.id);toast('Preparing file…');
 try{
  let blob=null;
  // 1) already downloaded in the app
  try{const rec=(await all('offline')).find(x=>x.id===t.id);if(rec&&rec.blob)blob=rec.blob}catch{}
  // 2) local file / blob url
  if(!blob&&t.streams?.[0]&&/^blob:/.test(t.streams[0])){try{blob=await (await fetch(t.streams[0])).blob()}catch{}}
  // 3) fetch from the provider (direct, then through the proxy); no app-storage limit applies
  if(!blob){
   const urls=[...new Set([t.dl,...(t.streams||[]),...((t.alts||[]).flatMap(a=>[a.dl,...(a.streams||[])]))].filter(u=>/^https?:/.test(u||'')))].slice(0,4);
   if(!urls.length){toast('No download link for this song');saving.delete(t.id);return}
   const prog=(n,tot)=>toast(tot?`Saving ${Math.round(n/tot*100)}%`:`Saving ${(n/1048576).toFixed(1)} MB`);
   outer:for(const u of urls){for(const via of [u,'/api/audio?u='+encodeURIComponent(u)]){try{blob=await grab(via,Infinity,0,prog);break outer}catch{}}}
  }
  if(!blob){toast('Couldn\'t save this song. The provider blocked it; try another version of the song.');saving.delete(t.id);return}
  const name=fname(t,blob.type),u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},60000);
  toast('Saved to your Downloads folder: '+name);
 }catch{toast('Save failed')}
 saving.delete(t.id);
};
const FILE='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5"/>';
CL.saveIcon=FILE;
const topEl=$('#np .top');
if(topEl&&!$('#npsv')){const b=document.createElement('button');b.id='npsv';b.type='button';b.setAttribute('aria-label','Save as file');b.innerHTML=SVG('currentColor',FILE);topEl.insertBefore(b,$('#npdl')||$('#npmore'));b.onclick=()=>CL.saveFile(S.q[S.i])}
// Downloads page: per-row "Save file" button
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-sv]');if(!b)return;e.preventDefault();e.stopPropagation();(async()=>{try{const rec=(await all('offline')).find(x=>x.id===b.dataset.sv);if(rec)CL.saveFile({...rec.track,id:rec.id})}catch{toast('Save failed')}})()},true);
