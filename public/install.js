// Spotify: install popup (24 h snooze) + permanent install banner on Home. One tap = native install dialog, no browser menu steps on Android.
const $=s=>document.querySelector(s);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
const KEY='cl_ipx',DAY=24*3600*1000;
const done=()=>localStorage.cl_installed==='1';
const gone=()=>{localStorage.cl_installed='1';$('#ipop')?.remove();document.querySelectorAll('.ibn').forEach(x=>x.remove())};
addEventListener('appinstalled',gone);
// browser fires this once the app is installable; keep the latest event
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__dip=e;try{localStorage.removeItem('cl_installed')}catch{}window.dispatchEvent(new Event('cl-dip'))});
const waitDip=ms=>new Promise(r=>{if(window.__dip)return r(window.__dip);let t;const f=()=>{clearTimeout(t);removeEventListener('cl-dip',f);r(window.__dip||null)};addEventListener('cl-dip',f);t=setTimeout(f,ms)});
// returns true (installed), false (dismissed), 'ios' (needs Share menu), 'wait' (browser not ready)
async function install(wait=0){
 if(ios)return 'ios';
 const e=window.__dip||(wait?await waitDip(wait):null);
 if(!e)return 'wait';
 try{e.prompt();const r=await e.userChoice;window.__dip=null;if(r.outcome==='accepted'){localStorage.cl_installed='1';return true}return false}catch(err){window.__dipErr=String(err);window.__dip=null;return 'wait'}
}
// shown when the browser did not give an install prompt (already installed, in-app browser, Chrome cooldown...)
function manual(){
 const inapp=/FBAN|FBAV|Instagram|Telegram|; wv\)/i.test(navigator.userAgent);
 if(inapp)return 'Ye in-app browser hai. Link ko <b>Chrome</b> me kholo, phir <b>⋮ → Install app</b> dabao.';
 return 'Chrome ka install dialog abhi ready nahi hai. <b>⋮ menu → Install app</b> dabao. Agar option nahi dikh raha to app pehle se installed hai, ya 10 sec baad dubara <b>Install App</b> dabao.';
}
// device-side check: shows exactly what blocks Chrome's install prompt
async function diag(){
 const L=[],ok=(b,t)=>L.push((b?'✅ ':'❌ ')+t);
 try{const rs=await navigator.serviceWorker.getRegistrations();ok(rs.some(r=>r.active),'service worker active')}catch{ok(false,'service worker')}
 try{const l=document.querySelector('link[rel=manifest]');const r=await fetch(l.href,{cache:'no-store'});const j=await r.json();ok(r.ok&&j.name,'manifest '+r.status+' '+(r.headers.get('content-type')||'no type'));
  for(const i of(j.icons||[]).filter(x=>x.purpose!=='maskable')){const q=await fetch(i.src,{cache:'no-store'});ok(q.ok&&/image\/png/.test(q.headers.get('content-type')||''),'icon '+i.sizes+' '+q.status+' '+(q.headers.get('content-type')||''))}}catch(e){ok(false,'manifest fetch/parse')}
 ok(location.protocol==='https:','https');
 ok(!standalone(),'browser tab (not installed window)');
 ok(!!(window.__dip||window.__dipSeen),'install event received'+(window.__dipErr?' | prompt error: '+window.__dipErr:''));
 return '<small style="display:block;margin-top:8px;opacity:.8;line-height:1.5">'+L.join('<br>')+'</small>';
}
function popup(){
 if($('#ipop')||standalone()||done())return;
 const d=document.createElement('div');d.id='ipop';
 d.innerHTML=`<div class="ipb"></div><div class="ips" role="dialog" aria-label="Install app"><button class="ipx" id="ipx" aria-label="Close">×</button><img src="/logo-96.png" alt="" width="64" height="64"><h3>Install Spotify 📲</h3><p>Add Spotify to your home screen for a faster, app-like experience — works offline too.</p><div class="ipm" hidden></div><button class="ipg" id="ipgo">Install App</button><button class="ipl" id="ipno">Don't show again for 24 hours</button></div>`;
 document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('on'));
 const close=snooze=>{if(snooze)localStorage[KEY]=Date.now();d.classList.remove('on');setTimeout(()=>d.remove(),250)};
 d.querySelector('.ipb').onclick=()=>close(false);$('#ipx').onclick=()=>close(false);$('#ipno').onclick=()=>close(true);
 const btn=$('#ipgo'),msg=d.querySelector('.ipm');
 btn.onclick=async()=>{
  msg.hidden=true;btn.disabled=true;btn.textContent='Installing…';
  const r=await install(6000);
  btn.disabled=false;btn.textContent='Install App';
  if(r===true)d.remove();
  else if(r==='ios'){msg.innerHTML='Safari me <b>Share</b> dabao, phir <b>Add to Home Screen</b>.';msg.hidden=false}
  else if(r==='wait'){msg.innerHTML=manual();msg.hidden=false;if(/[?&]diag=1/.test(location.search)||localStorage.cl_diag==='1')diag().then(h=>{msg.innerHTML+=h});try{const a=await navigator.getInstalledRelatedApps?.();if(a&&a.length)msg.innerHTML='Spotify is device par <b>pehle se installed</b> hai. Home screen / app drawer me dekho. Hata diya ho to Chrome <b>⋮ → Settings → Site settings → All sites</b> me is site ka data clear karke page reload karo.'}catch{}}
 };
}
// permanent banner on Home
function banner(){
 if(standalone()||done())return;const m=$('#main');if(!m||document.querySelector('.ibn'))return;
 const h=m.querySelectorAll('.chd');if(h.length<2)return;
 const b=document.createElement('button');b.className='ibn';b.type='button';
 b.innerHTML='<span class="ii"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-5-5m5 5 5-5M5 20h14"/></svg></span><span class="it"><b>Download the app</b><small>Install Spotify on your phone</small></span><span class="ia">Install</span>';
 b.onclick=async()=>{const r=await install();if(r!==true&&r!==false){localStorage.removeItem(KEY);popup();$('#ipgo')?.click()}};
 h[1].after(b);
}
// Settings / navbar Install buttons call this
addEventListener('cl-install',async()=>{const r=await install();if(r!==true&&r!==false){localStorage.removeItem(KEY);popup();$('#ipgo')?.click()}});
new MutationObserver(banner).observe($('#main'),{childList:true});banner();
// popup on open (once per 24 h unless snoozed)
const last=+localStorage[KEY]||0;
if(!standalone()&&!done()&&Date.now()-last>DAY)setTimeout(popup,1800);
