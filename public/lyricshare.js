/* Lyrics share card (idea from Aelokia's "share lyrics as quote cards"; written from scratch, no code copied).
   Open the lyrics panel, tap up to 6 lines, press "Share card": a 1080x1350 PNG is drawn on a canvas
   (blurred artwork + dark gradient + the quote + song/artist) and shared via the system share sheet,
   or downloaded when sharing files is not supported. Everything stays on this device. */
const MAXL=6,W=1080,H=1350;
const $=s=>document.querySelector(s);
const pn=$('#panel');
if(pn){
  const st=document.createElement('style');
  st.textContent=`
  .lsbar{position:sticky;top:-16px;z-index:2;display:flex;align-items:center;gap:8px;margin:-16px -16px 12px;padding:max(12px,env(safe-area-inset-top)) 16px 10px;background:linear-gradient(var(--bg) 82%,transparent);font:600 14px/1.2 system-ui,sans-serif}
  .lsbar .lsn{flex:1;color:var(--m);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .lsbar button{min-height:40px;padding:0 14px;border-radius:20px;background:var(--s2);color:var(--t);font:600 14px system-ui,sans-serif}
  .lsbar button.go{background:var(--a);color:#000}
  .lsbar button[disabled]{opacity:.4}
  .ly p[data-sel]{color:var(--t);background:color-mix(in srgb,var(--a) 22%,transparent);border-radius:10px;box-shadow:-10px 0 0 color-mix(in srgb,var(--a) 22%,transparent),10px 0 0 color-mix(in srgb,var(--a) 22%,transparent)}
  .ly p{cursor:pointer;-webkit-tap-highlight-color:transparent}`;
  document.head.appendChild(st);

  const sel=()=>[...pn.querySelectorAll('.ly p[data-sel]')];
  const upd=()=>{const b=pn.querySelector('.lsbar');if(!b)return;const n=sel().length;b.querySelector('.lsn').textContent=n?`${n} of ${MAXL} lines selected`:'Tap lines to pick a quote';b.querySelector('.go').disabled=!n;b.querySelector('.cl').disabled=!n};

  /* Plain (non-synced) lyrics arrive as one <pre>; split into tappable lines (plain lyrics are never re-highlighted, so this is safe). */
  const prep=()=>{
    const ly=pn.querySelector('.ly');
    if(!ly||ly.querySelector('.lsbar'))return;
    const pre=ly.querySelector('pre');
    if(pre){const txt=pre.textContent.split('\n').map(x=>x.trim()).filter(Boolean);pre.replaceWith(...txt.map(x=>{const p=document.createElement('p');p.textContent=x;return p}))}
    if(!ly.querySelector('p'))return;
    const bar=document.createElement('div');bar.className='lsbar';
    bar.innerHTML='<span class="lsn"></span><button class="cl" type="button">Clear</button><button class="go" type="button">Share card</button>';
    ly.prepend(bar);upd();
  };
  new MutationObserver(()=>{if(pn.classList.contains('show'))prep()}).observe(pn,{childList:true,subtree:false,attributes:true,attributeFilter:['class']});

  pn.addEventListener('click',e=>{
    const p=e.target.closest('.ly p'),go=e.target.closest('.lsbar .go'),cl=e.target.closest('.lsbar .cl');
    if(cl){sel().forEach(x=>x.removeAttribute('data-sel'));upd();return}
    if(go){make();return}
    if(p&&!p.closest('.lsbar')){
      if(p.hasAttribute('data-sel'))p.removeAttribute('data-sel');
      else if(sel().length>=MAXL){window.CL?.toast?.(`Up to ${MAXL} lines per card`);return}
      else p.setAttribute('data-sel','');
      upd();
    }
  });

  const loadImg=u=>new Promise(r=>{if(!u)return r(null);const i=new Image();i.crossOrigin='anonymous';i.referrerPolicy='no-referrer';i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u;setTimeout(()=>r(null),6000)});
  const rr=(c,x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()};
  const wrap=(c,text,maxW)=>{const out=[];for(const para of text.split('\n')){let line='';for(const w of para.split(/\s+/)){const t=line?line+' '+w:w;if(c.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t}out.push(line)}return out};

  /* average colour of the cover (tiny canvas); falls back to the app accent */
  function tone(img){
    try{const k=document.createElement('canvas');k.width=k.height=8;const c=k.getContext('2d');c.drawImage(img,0,0,8,8);const d=c.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}const n=d.length/4;return[r/n|0,g/n|0,b/n|0]}catch{return null}
  }

  async function render(lines,t){
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
    const img=await loadImg(t.artwork);
    const col=(img&&tone(img))||[29,185,84];
    /* background: cover scaled down to a few pixels and back up = cheap blur that works in every browser */
    c.fillStyle=`rgb(${col.map(v=>v*.45|0)})`;c.fillRect(0,0,W,H);
    if(img){
      const s=document.createElement('canvas');s.width=24;s.height=30;s.getContext('2d').drawImage(img,0,0,24,30);
      c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.globalAlpha=.9;c.drawImage(s,0,0,W,H);c.globalAlpha=1;
    }
    const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(0,0,0,.25)');g.addColorStop(1,'rgba(0,0,0,.72)');c.fillStyle=g;c.fillRect(0,0,W,H);

    /* quote: biggest font that fits the area */
    const text=lines.join('\n'),px=88,py=150,maxW=W-px*2,maxH=H-py-360;
    c.fillStyle='#fff';c.textBaseline='top';
    let fs=84,rows;
    for(;fs>=34;fs-=4){c.font=`800 ${fs}px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;rows=wrap(c,text,maxW);if(rows.length*fs*1.28<=maxH)break}
    const lh=fs*1.28,bh=rows.length*lh;
    c.font=`900 ${fs*1.6}px Georgia,serif`;c.fillStyle='rgba(255,255,255,.35)';c.fillText('\u201C',px-6,py-fs*.9);
    c.font=`800 ${fs}px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;c.fillStyle='#fff';
    c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=18;
    rows.forEach((r,i)=>c.fillText(r,px,py+Math.max(0,(maxH-bh)/2)+i*lh));
    c.shadowBlur=0;

    /* footer: cover thumb + title + artist */
    const fy=H-250,sz=150;
    if(img){c.save();rr(c,px,fy,sz,sz,22);c.clip();c.drawImage(img,px,fy,sz,sz);c.restore()}
    else{rr(c,px,fy,sz,sz,22);c.fillStyle='rgba(255,255,255,.15)';c.fill()}
    const tx=px+sz+34,tw=W-px-tx;
    const fit=(s,font,w)=>{c.font=font;let x=s;while(c.measureText(x).width>w&&x.length>3)x=x.slice(0,-2);return x===s?s:x.trimEnd()+'\u2026'};
    c.fillStyle='#fff';c.fillText(fit(t.title||'',`800 46px system-ui,sans-serif`,tw),tx,fy+22);
    c.fillStyle='rgba(255,255,255,.75)';c.fillText(fit(t.artist||'',`600 36px system-ui,sans-serif`,tw),tx,fy+82);
    c.fillStyle=`rgb(${col.map(v=>Math.min(255,v+90)).join(',')})`;c.font='700 26px system-ui,sans-serif';
    c.fillText('\u266A  '+(document.title||'Spotify'),tx,fy+124);
    return new Promise(r=>cv.toBlob(r,'image/png'));
  }

  let busy=false;
  async function make(){
    if(busy)return;const lines=sel().map(p=>p.textContent.trim()).filter(Boolean);if(!lines.length)return;
    const t=window.CL?.S?.q?.[window.CL.S.i];if(!t){window.CL?.toast?.('Play a song first');return}
    busy=true;const go=pn.querySelector('.lsbar .go');if(go){go.disabled=true;go.textContent='Making…'}
    try{
      const blob=await render(lines,t);if(!blob)throw new Error('no image');
      const name=`${(t.title||'lyrics').replace(/[^\w\- ]+/g,'').trim().slice(0,40)||'lyrics'}.png`,f=new File([blob],name,{type:'image/png'});
      if(navigator.canShare?.({files:[f]})){try{await navigator.share({files:[f],title:t.title||'Lyrics'});return}catch(e){if(e&&e.name==='AbortError')return}}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
      window.CL?.toast?.('Card saved as image');
    }catch{window.CL?.toast?.('Could not make the card')}
    finally{busy=false;const g=pn.querySelector('.lsbar .go');if(g){g.textContent='Share card';upd()}}
  }
}
