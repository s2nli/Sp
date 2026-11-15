// Cloudflare Worker: serves static files from ./public (ASSETS) and handles /api/proxy and /api/audio.
const json=(o,s=200,h={})=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','x-content-type-options':'nosniff',...h}});

/* ---- /api/proxy : allow-listed GET proxy (CORS fallback), no credentials forwarded ---- */
const ALLOW=new Set(['kilpy-api.vercel.app','jiosvvnn.vercel.app','api.audius.co','modvault-music.vercel.app','hulkmusic.vercel.app','saaz-next.vercel.app','lrclib.net','www.jiosaavn.com','lyrics.kugou.com','mobileservice.kugou.com','lyrics-api.boidu.dev','all.api.radio-browser.info','de1.api.radio-browser.info']);
const PMAX=2*1024*1024,phits=new Map();
async function proxy(request){
  const ip=request.headers.get('cf-connecting-ip')||'x',now=Date.now(),h=(phits.get(ip)||[]).filter(t=>now-t<60000);
  if(h.length>=300)return json({error:'rate limited'},429);h.push(now);phits.set(ip,h);if(phits.size>5000)phits.clear();
  try{
    const raw=String(new URL(request.url).searchParams.get('u')||'');if(!raw||raw.length>2000)return json({error:'bad url'},400);
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!ALLOW.has(u.hostname))return json({error:'host not allowed'},403);
    const r=await fetch(u,{redirect:'manual',headers:{accept:'application/json','user-agent':'Mozilla/5.0 CODELYNX'},signal:AbortSignal.timeout(10000)});
    if(r.status>=300&&r.status<400)return json({error:'redirect blocked'},502);
    const ct=r.headers.get('content-type')||'';if(!/json|text/i.test(ct))return json({error:'unsupported type'},415);
    const t=await r.text();if(t.length>PMAX)return json({error:'response too large'},502);
    return new Response(t,{status:r.status,headers:{'content-type':ct,'cache-control':'s-maxage=60','x-content-type-options':'nosniff'}});
  }catch{return json({error:'upstream failed'},502)}
}

/* ---- /api/audio : allow-listed audio proxy for offline saving ---- */
const OK=[/(^|\.)saavncdn\.com$/,/(^|\.)jiosaavn\.com$/,/^kilpy-api\.vercel\.app$/,/^jiosvvnn\.vercel\.app$/,/^hulkmusic\.vercel\.app$/,/^saaz-next\.vercel\.app$/,/^modvault-music\.vercel\.app$/];
const AMAX=40*1024*1024,ahits=new Map();
const allowed=u=>u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&OK.some(r=>r.test(u.hostname));
async function audio(request){
  const ip=request.headers.get('cf-connecting-ip')||'x',now=Date.now(),h=(ahits.get(ip)||[]).filter(t=>now-t<60000);
  if(h.length>=60)return json({error:'rate limited'},429);h.push(now);ahits.set(ip,h);if(ahits.size>5000)ahits.clear();
  try{
    const raw=String(new URL(request.url).searchParams.get('u')||'');if(!raw||raw.length>2000)return json({error:'bad url'},400);
    let u=new URL(raw),r;
    for(let i=0;i<4;i++){
      if(!allowed(u))return json({error:'host not allowed'},403);
      r=await fetch(u,{redirect:'manual',headers:{'user-agent':'Mozilla/5.0 CODELYNX'},signal:AbortSignal.timeout(25000)});
      if(r.status>=300&&r.status<400&&r.headers.get('location')){u=new URL(r.headers.get('location'),u);continue}
      break;
    }
    if(!r.ok||!r.body)return json({error:'upstream failed'},502);
    const ct=r.headers.get('content-type')||'';if(!/^(audio|video)\/|octet-stream|mpegurl/i.test(ct))return json({error:'not audio'},415);
    const len=+r.headers.get('content-length')||0;if(len>AMAX)return json({error:'too large'},413);
    const hd={'content-type':ct,'cache-control':'private, max-age=0','x-content-type-options':'nosniff'};if(len)hd['content-length']=String(len);
    let n=0;
    const cap=new TransformStream({transform(c,ctl){n+=c.byteLength;if(n>AMAX){ctl.terminate();return}ctl.enqueue(c)}});
    return new Response(r.body.pipeThrough(cap),{headers:hd});
  }catch{return json({error:'upstream failed'},502)}
}

/* ---- /api/nz : Nazriya Music API (audio / video / search). The key stays on the server. ---- */
const NZ_HOST='nazriya.teamgod.online',NZ_KEY_DEFAULT='ak_90a9b88be6a7c0a48cb5ccd33319d4e61870',nhits=new Map();
const findUrl=(o,d=0)=>{if(d>4||o==null)return '';if(typeof o==='string')return /^https:\/\//i.test(o)?o:'';if(Array.isArray(o)){for(const x of o){const r=findUrl(x,d+1);if(r)return r}return ''}
  if(typeof o==='object'){for(const k of ['url','link','stream','stream_url','streamUrl','download','download_url','audio','video','src','file','direct_url'])if(o[k]){const r=findUrl(o[k],d+1);if(r)return r}for(const k in o){const r=findUrl(o[k],d+1);if(r)return r}}return ''};
async function nz(request,env){
  const ip=request.headers.get('cf-connecting-ip')||'x',now=Date.now(),h=(nhits.get(ip)||[]).filter(t=>now-t<60000);
  if(h.length>=120)return json({error:'rate limited'},429);h.push(now);nhits.set(ip,h);if(nhits.size>5000)nhits.clear();
  const sp=new URL(request.url).searchParams,kind=sp.get('kind'),q=String(sp.get('q')||'').trim().slice(0,200);
  if(!['audio','video','search'].includes(kind)||!q)return json({error:'bad request'},400);
  const key=env.NAZRIYA_KEY||NZ_KEY_DEFAULT,scrub=t=>t.split(key).join('');
  const head={'user-agent':'Mozilla/5.0 CODELYNX',accept:'*/*'},rg=request.headers.get('range');if(rg&&kind!=='search')head.range=rg;
  try{
    let u=new URL(`https://${NZ_HOST}/api/${kind}`);u.searchParams.set('q',q);u.searchParams.set('key',key);
    let r;
    for(let i=0;i<6;i++){
      r=await fetch(u,{redirect:'manual',headers:head,signal:AbortSignal.timeout(kind==='search'?15000:45000)});
      if(r.status>=300&&r.status<400&&r.headers.get('location')){const n=new URL(r.headers.get('location'),u);if(n.protocol!=='https:'||n.username||n.password)return json({error:'bad redirect'},502);u=n;continue}
      const ct=r.headers.get('content-type')||'';
      /* some builds answer with JSON that holds the media link: follow it */
      if(kind!=='search'&&r.ok&&/json/i.test(ct)){const d=await r.json().catch(()=>null),l=findUrl(d);if(!l)return json({error:'no media link'},502);const n=new URL(l);if(n.protocol!=='https:'||n.username||n.password)return json({error:'bad link'},502);u=n;continue}
      break;
    }
    if(!r.ok&&r.status!==206)return json({error:'upstream failed',status:r.status},502);
    const ct=r.headers.get('content-type')||'';
    if(kind==='search'){const t=scrub(await r.text());if(t.length>PMAX)return json({error:'response too large'},502);return new Response(t,{headers:{'content-type':ct||'application/json','cache-control':'private, max-age=300','x-content-type-options':'nosniff'}})}
    if(!r.body||!/^(audio|video)\/|octet-stream|mpegurl|mp4|webm/i.test(ct))return json({error:'not media'},415);
    const hd={'content-type':/octet-stream/i.test(ct)?(kind==='video'?'video/mp4':'audio/mpeg'):ct,'cache-control':'private, max-age=0','x-content-type-options':'nosniff','accept-ranges':r.headers.get('accept-ranges')||'bytes'};
    for(const k of ['content-length','content-range'])if(r.headers.get(k))hd[k]=r.headers.get(k);
    return new Response(r.body,{status:r.status,headers:hd});
  }catch{return json({error:'upstream failed'},502)}
}

export default {
  async fetch(request,env){
    const {pathname}=new URL(request.url);
    if(pathname==='/api/proxy'||pathname==='/api/audio'){
      if(request.method!=='GET')return json({error:'method not allowed'},405);
      return pathname==='/api/proxy'?proxy(request):audio(request);
    }
    if(pathname==='/api/nz'){
      if(request.method!=='GET')return json({error:'method not allowed'},405);
      return nz(request,env);
    }
    if(pathname.startsWith('/api/'))return json({error:'not found'},404);
    return env.ASSETS.fetch(request);
  }
};
