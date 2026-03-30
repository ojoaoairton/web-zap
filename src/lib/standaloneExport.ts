import { Flow } from '@/types/flow';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateStandaloneHTML(flow: Flow): Promise<string> {
  const flowJSON = JSON.stringify(flow);
  const themeAttr = flow.theme !== 'auto' ? ` data-theme="${flow.theme}"` : '';
  const [soundDataUrl, patternDataUrl, avatarDataUrl] = await Promise.all([
    fetchAsDataUrl('/sounds/message.mp3'),
    fetchAsDataUrl('/pattern.png'),
    flow.avatarUrl
      ? (flow.avatarUrl.startsWith('data:')
        ? Promise.resolve(flow.avatarUrl)
        : fetchAsDataUrl(flow.avatarUrl))
      : Promise.resolve(null),
  ]);
  const pixLogoDataUrl = await fetchAsDataUrl('/pix-logo.png');

  const patternFallback = svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#0b141a"/>
      <g stroke="rgba(255,255,255,0.07)" stroke-width="2" fill="none">
        <path d="M60 80c20-18 44-18 64 0s44 18 64 0 44-18 64 0 44 18 64 0"/>
        <path d="M40 220c18-12 38-12 56 0s38 12 56 0 38-12 56 0 38 12 56 0 38-12 56 0"/>
        <circle cx="86" cy="140" r="16"/><circle cx="314" cy="120" r="14"/>
        <circle cx="140" cy="300" r="12"/><circle cx="300" cy="290" r="18"/>
        <path d="M110 180l18 18 30-30"/><path d="M260 250l18 18 30-30"/>
      </g>
    </svg>`
  );

  const patternUrl = patternDataUrl || patternFallback;
  const audioUrl = soundDataUrl || '';
  const avatarHTML = avatarDataUrl
    ? `<img src="${avatarDataUrl}" alt="avatar" class="avatar" />`
    : `<div class="avatar">🤖</div>`;
  const pixLogoUrl = pixLogoDataUrl || '';

  const integrations = Array.isArray(flow.integrations) ? flow.integrations : [];
  const integrationsHeadInject = integrations
    .map((integration) => {
      const value = (integration.value || '').trim();
      if (!value) return '';

      switch (integration.type) {
        case 'utmify':
          return `<script>
  window.pixelId = ${JSON.stringify(value)};
  var a = document.createElement("script");
  a.setAttribute("async", "");
  a.setAttribute("defer", "");
  a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
  document.head.appendChild(a);
</script>
<script
  src="https://cdn.utmify.com.br/scripts/utms/latest.js"
  data-utmify-prevent-xcod-sck
  data-utmify-prevent-subids
  async
  defer
></script>`;
        case 'meta':
          return `<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${value}');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=${value}&ev=PageView&noscript=1" />
</noscript>`;
        case 'gtm':
          return `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${value}');</script>`;
        case 'tiktok':
          return `<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track",
  "identify","instances","debug","on","off","once","ready","alias","group","enableCookie",
  "disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(
  Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)
  ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],
  n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},
  ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
  ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,
  ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");
  o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
  var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${value}');ttq.page();
}(window, document, 'ttq');
</script>`;
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');

  const scripts = Array.isArray(flow.customScripts) ? flow.customScripts : [];
  const headCustom = scripts.filter(s => s.position === 'head').map(s => s.code).join('\n');
  const bodyInject = scripts.filter(s => s.position === 'body').map(s => s.code).join('\n');
  const footerCustom = scripts.filter(s => s.position === 'footer').map(s => s.code).join('\n');

  const headInject = [integrationsHeadInject, headCustom].filter(Boolean).join('\n');

  const verifiedSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><circle cx="12" cy="12" r="10" fill="#53bdeb"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${flow.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;height:100vh;overflow:hidden}
#chat-root{display:flex;flex-direction:column;height:100vh;max-width:100%;margin:0 auto;color:var(--text-primary);background:linear-gradient(var(--bg-overlay),var(--bg-overlay)),url("${patternUrl}");background-repeat:repeat;background-size:400px auto;background-attachment:fixed;--bg-overlay:rgba(11,20,26,0.85);--bubble-received:#202c33;--bubble-sent:#005c4b;--text-primary:#e9edef;--text-secondary:rgba(233,237,239,0.7);--header-bg:#202c33;--input-bg:#2a3942;--audio-wave-unplayed:rgba(255,255,255,0.35);--audio-wave-played:rgba(255,255,255,0.85)}
@media (prefers-color-scheme: light){#chat-root:not([data-theme]){--bg-overlay:rgba(229,221,213,0.85);--bubble-received:#ffffff;--bubble-sent:#d9fdd3;--text-primary:#111b21;--text-secondary:rgba(17,27,33,0.7);--header-bg:#f0f2f5;--input-bg:#ffffff;--audio-wave-unplayed:rgba(0,0,0,0.35);--audio-wave-played:rgba(0,0,0,0.75)}}
#chat-root[data-theme="dark"]{--bg-overlay:rgba(11,20,26,0.85);--bubble-received:#202c33;--bubble-sent:#005c4b;--text-primary:#e9edef;--text-secondary:rgba(233,237,239,0.7);--header-bg:#202c33;--input-bg:#2a3942;--audio-wave-unplayed:rgba(255,255,255,0.35);--audio-wave-played:rgba(255,255,255,0.85)}
#chat-root[data-theme="light"]{--bg-overlay:rgba(229,221,213,0.85);--bubble-received:#ffffff;--bubble-sent:#d9fdd3;--text-primary:#111b21;--text-secondary:rgba(17,27,33,0.7);--header-bg:#f0f2f5;--input-bg:#ffffff;--audio-wave-unplayed:rgba(0,0,0,0.35);--audio-wave-played:rgba(0,0,0,0.75)}
.header{background:var(--header-bg);border-bottom:1px solid rgba(255,255,255,.08);padding:10px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}
.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover}
div.avatar{background:rgba(0,168,132,.2);display:flex;align-items:center;justify-content:center;font-size:20px}
.header-info h3{font-size:14px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:4px}
.header-info p{font-size:12px;color:rgba(0,168,132,.8)}
.business-banner{text-align:center;padding:6px;font-size:11px;color:rgba(255,255,255,.4)}
.business-banner span{background:var(--bubble-received);padding:4px 12px;border-radius:6px}
.messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:4px;background:transparent}
.msg{max-width:80%;padding:6px 12px;border-radius:8px;font-size:14.5px;line-height:19px;position:relative;animation:fadeIn .2s ease-out;overflow:visible}
.msg-bot{align-self:flex-start;background:var(--bubble-received);border-top-left-radius:3px}
.msg-user{align-self:flex-end;background:var(--bubble-sent);border-top-right-radius:3px}
.msg-bot:before{content:"";position:absolute;top:0;left:-8px;width:0;height:0;border-top:8px solid var(--bubble-received);border-left:8px solid transparent}
.msg-user:before{content:"";position:absolute;top:0;right:-8px;width:0;height:0;border-top:8px solid var(--bubble-sent);border-right:8px solid transparent}
.msg img{max-width:100%;border-radius:8px}
.msg iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:8px}
.msg video{max-width:280px;border-radius:8px}
.msg audio{max-width:240px}
.time{font-size:11px;color:rgba(255,255,255,.25);float:right;margin:4px 0 0 8px}
.buttons-row{display:flex;flex-direction:column;gap:6px;align-self:flex-start;max-width:80%}
.btn-option{width:100%;padding:10px 16px;background:transparent;color:#25D366;border:none;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .15s}
.btn-option:hover{opacity:.75}
.btn-option:disabled{opacity:.4;cursor:not-allowed}
.typing{align-self:flex-start;background:var(--bubble-received);border-radius:8px;border-top-left-radius:3px;padding:10px 14px;display:flex;gap:4px}
.typing-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);animation:typingDot 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:.2s}
.typing-dot:nth-child(3){animation-delay:.4s}
.input-bar{background:var(--header-bg);border-top:1px solid rgba(255,255,255,.08);padding:8px;flex-shrink:0;display:flex;gap:8px;align-items:center}
.input-bar input{flex:1;background:var(--input-bg);border:0;border-radius:20px;padding:8px 16px;color:var(--text-primary);font-size:14px;outline:none}
.input-bar input::placeholder{color:rgba(255,255,255,.3)}
.input-bar input:disabled{opacity:.3}
.send-btn{width:40px;height:40px;border-radius:50%;background:#00a884;border:0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px}
.send-btn:disabled{opacity:.3;cursor:not-allowed}
.file-card{display:flex;align-items:center;gap:10px;padding:6px 0;min-width:180px}
.file-icon{width:36px;height:36px;border-radius:8px;background:rgba(239,68,68,.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.file-dl{width:28px;height:28px;border-radius:50%;background:rgba(0,168,132,.15);display:flex;align-items:center;justify-content:center;text-decoration:none;color:#00a884;font-size:14px;flex-shrink:0}
.pix-head{display:flex;gap:8px;align-items:flex-start}
.pix-icon{width:32px;height:32px;flex-shrink:0;margin-top:2px}
.pix-name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pix-key{font-size:13.5px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;word-break:break-all;margin-top:4px}
.pix-copy{width:100%;background:transparent;border:0;border-top:1px solid rgba(255,255,255,0.1);color:#25D366;cursor:pointer;padding:10px 12px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes typingDot{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}}
.messages::-webkit-scrollbar{width:6px}
.messages::-webkit-scrollbar-track{background:transparent}
.messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
</style>
${headInject}
</head>
<body>
${bodyInject}
<div id="chat-root"${themeAttr}>
  <div class="header" id="header" style="display:none">
    ${avatarHTML}
    <div class="header-info">
      <h3>${flow.contactName || flow.name} ${verifiedSVG}</h3>
      <p id="status">online</p>
    </div>
  </div>
  <div id="start-screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;flex:1">
    ${flow.avatarUrl
      ? `<img src=${JSON.stringify(flow.avatarUrl)} style="width:80px;height:80px;border-radius:50%;object-fit:cover"/>`
      : `<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,168,132,0.2);display:flex;align-items:center;justify-content:center;font-size:36px">🤖</div>`
    }
    <span style="color:var(--text-primary);font-size:18px;font-weight:600">${flow.contactName || flow.name}</span>
    <button id="start-btn" style="width:64px;height:64px;border-radius:50%;background:#25D366;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M7 4v16l14-8-14-8Z"/>
      </svg>
    </button>
    <span style="color:rgba(255,255,255,0.6);font-size:13px">Toque para iniciar</span>
  </div>
  <div class="messages" id="messages" style="display:none">
    <div class="business-banner"><span>Esta é uma conta comercial. Toque para saber mais</span></div>
  </div>
  <div class="input-bar" id="input-bar" style="display:none">
    <input type="text" id="chatInput" placeholder="Aguardando..." disabled />
    <button class="send-btn" id="sendBtn" disabled>➤</button>
  </div>
</div>
<script>
(function(){
const FLOW=${flowJSON};
const header=document.getElementById('header');
const startScreen=document.getElementById('start-screen');
const startBtn=document.getElementById('start-btn');
const msgs=document.getElementById('messages');
const inputBar=document.getElementById('input-bar');
const input=document.getElementById('chatInput');
const sendBtn=document.getElementById('sendBtn');
const status=document.getElementById('status');
const vars={};
let audioUnlocked=false;
let lastSoundTime=0;
let userReplied=false;
let started=false;

const PIX_LOGO_URL=${JSON.stringify(pixLogoUrl)};

const sndUrl=${JSON.stringify(audioUrl)};
let sndEl=null;
let audioCtx=null;
function getSound(){if(!sndUrl)return null;if(!sndEl){sndEl=new Audio(sndUrl);sndEl.volume=0.3}return sndEl}
function ensureAudioCtx(){if(audioCtx)return audioCtx;audioCtx=new (window.AudioContext||window.webkitAudioContext)();return audioCtx}
function beep(){
  const ctx=ensureAudioCtx();
  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type='sine';
  osc.frequency.setValueAtTime(880,now);
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(0.08,now+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now+0.14);
}
document.addEventListener('click',function(){
  if(audioUnlocked)return;
  audioUnlocked=true;
  if(sndUrl){
    const a=getSound();
    if(a){
      a.volume=0;
      a.play().then(()=>{a.pause();a.volume=0.3}).catch(()=>{});
    }
  }else{
    const ctx=ensureAudioCtx();
    ctx.resume().catch(()=>{});
  }
},{once:false});
function playSound(){
  if(!audioUnlocked)return;
  const now=Date.now();
  if(now-lastSoundTime<400)return;
  lastSoundTime=now;
  const a=getSound();
  if(a){
    a.currentTime=0;
    a.play().catch(()=>{});
    return;
  }
  try{beep()}catch{}
}

// UTM capture
const utms={};
new URLSearchParams(location.search).forEach((v,k)=>{if(k.startsWith('utm_'))utms[k]=v});

const NAME_PATTERNS=[
  /^(?:(?:eu )?(?:sou|me chamo|meu nome [eé]|pode me chamar de?|chamo))\\s+(.+)$/i,
  /^(?:é|eh|e)\\s+(.+)$/i,
];

function normalizeInput(val,type){
  let t=val.trim().replace(/\\s+/g,' ');
  if(type==='nome'){
    for(const p of NAME_PATTERNS){const m=t.match(p);if(m){t=m[1].trim();break}}
    t=t.toLowerCase().split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  }else if(type==='email'){t=t.toLowerCase()}
  else if(type==='texto'){t=t.charAt(0).toUpperCase()+t.slice(1)}
  return t;
}

function replaceVars(text){return text.replace(/\\{\\{(\\w+)\\}\\}/g,(_,k)=>vars[k]||'{{'+k+'}}')}
function time(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function timeWithTicks(side,style){
  const t=time();
  const st=style?(' style="'+style+'"'):'';
  if(side !== 'user') return '<span class="time"' + st + '>' + t + '</span>';
  
  const singleCheck = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5L4.5 9L10 1.5" stroke="rgba(255,255,255,0.5)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const doubleCheck = '<svg width="18" height="11" viewBox="0 0 18 11" fill="none"><path d="M1 5.5L5 9.5L13 1.5" stroke="#53BDEB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 5.5L9 9.5L17 1.5" stroke="#53BDEB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  
  const mark = userReplied ? doubleCheck : singleCheck;
  return '<span class="time"' + st + ' style="display:inline-flex;align-items:center;gap:3px">' + t + mark + '</span>';
}
function updateBotTicks(){ 
  const singleCheck = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5L4.5 9L10 1.5" stroke="rgba(255,255,255,0.5)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; 
  const doubleCheck = '<svg width="18" height="11" viewBox="0 0 18 11" fill="none"><path d="M1 5.5L5 9.5L13 1.5" stroke="#53BDEB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 5.5L9 9.5L17 1.5" stroke="#53BDEB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; 
  document.querySelectorAll('.msg-user .time').forEach(el => { 
    const existing = el.querySelector('svg'); 
    if(existing) existing.remove(); 
    const span = document.createElement('span'); 
    span.style.display = 'inline-flex'; 
    span.style.alignItems = 'center'; 
    span.style.marginLeft = '3px'; 
    span.innerHTML = userReplied ? doubleCheck : singleCheck; 
    el.appendChild(span); 
  }); 
} 
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function scroll(){msgs.scrollTo({top:msgs.scrollHeight,behavior:'smooth'})}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function applyMarkdown(text){
  return text
    .replace(/\\*(.*?)\\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .replace(/\`\`\`(.*?)\`\`\`/g, '<code style="font-family:monospace">$1</code>');
}
function hash32(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function waveHeights(seedStr){
  let seed=hash32(seedStr||'');
  function rnd(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
  const out=[];
  for(let i=0;i<35;i++){out.push(Math.floor(4+rnd()*(20-4)));}
  return out;
}

function addMsg(side,content,type,extra){
  const d=document.createElement('div');
  d.className='msg msg-'+side;
  if(type==='image'){d.innerHTML='<img src="'+content+'" loading="lazy"/>'+timeWithTicks(side)}
  else if(type==='video'){
    const yt=content.match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/)|youtu\\.be\\/)([a-zA-Z0-9_-]+)/);
    const drv=content.match(/drive\\.google\\.com\\/file\\/d\\/([a-zA-Z0-9_-]+)/);
    if(yt)d.innerHTML='<iframe src="https://www.youtube.com/embed/'+yt[1]+'" allowfullscreen loading="lazy"></iframe>'+timeWithTicks(side);
    else if(drv)d.innerHTML='<iframe src="https://drive.google.com/file/d/'+drv[1]+'/preview" allowfullscreen loading="lazy"></iframe>'+timeWithTicks(side);
    else d.innerHTML='<video src="'+content+'" controls preload="metadata"></video>'+timeWithTicks(side);
  }
  else if(type==='recording'){
    d.innerHTML='<div style="display:flex;align-items:center;gap:8px;color:#25D366;font-size:14px;font-weight:600"><span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px">🎤</span><span>'+esc(content)+'</span></div>'+timeWithTicks(side);
  }
  else if(type==='audio'){
    const forwarded=!!extra?.forwarded;
    const duration=esc(extra?.duration||'0:00');
    const waves=waveHeights(String(content||''));
    d.style.padding='10px 12px 8px 12px';
    d.style.minWidth='280px';
    d.innerHTML=
      (forwarded
        ? '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);margin-bottom:6px">' +
            '<span aria-hidden="true">↪</span>' +
            '<em>Encaminhada</em>' +
          '</div>'
        : '') +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:42px;height:42px;border-radius:9999px;background:#F97316;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18v3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<button type="button" class="wa-audio-play" style="background:transparent;border:0;padding:0;cursor:pointer;opacity:.85;flex-shrink:0">' +
          '<svg class="wa-audio-play-ico" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4v16l14-8-14-8Z" fill="currentColor"/></svg>' +
        '</button>' +
        '<div style="flex:1;min-width:0;display:flex;align-items:center">' +
          '<div class="wa-audio-waves" style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:1.5px;width:100%">' +
            waves.map((h,i)=>'<div class="wa-audio-wave" data-i="'+i+'" style="width:2px;height:'+h+'px;background:var(--audio-wave-unplayed);border-radius:2px"></div>').join('') +
            '<div class="wa-audio-dot" style="position:absolute;left:calc(0% - 5px);top:50%;transform:translateY(-50%);width:10px;height:10px;border-radius:9999px;background:#53BDEB;transition:left 0.1s linear"></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">' +
            '<span class="wa-audio-elapsed" style="font-size:11px;opacity:.75">0:00</span>' +
            timeWithTicks(side,'float:none;margin:0') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<audio class="wa-audio-el" src="'+content+'" preload="metadata" style="display:none"></audio>';

    const audio=d.querySelector('.wa-audio-el');
    const btn=d.querySelector('.wa-audio-play');
    const ico=d.querySelector('.wa-audio-play-ico');
    const dot=d.querySelector('.wa-audio-dot');
    const bars=[...d.querySelectorAll('.wa-audio-wave')];
    const elapsedEl=d.querySelector('.wa-audio-elapsed');
    btn.addEventListener('click',async function(){
      try{
        if(audio.paused){await audio.play();}
        else{audio.pause();}
      }catch{}
      if(audio.paused){
        ico.innerHTML='<path d="M7 4v16l14-8-14-8Z" fill="currentColor"/>';
      }else{
        ico.innerHTML='<path d="M6 4h4v16H6z" fill="currentColor"/><path d="M14 4h4v16h-4z" fill="currentColor"/>';
      }
    });
    audio.addEventListener('ended',function(){
      ico.innerHTML='<path d="M7 4v16l14-8-14-8Z" fill="currentColor"/>';
      if(dot)dot.style.left='calc(0% - 5px)';
      if(elapsedEl)elapsedEl.textContent='0:00';
      for(const b of bars){b.style.backgroundColor='var(--audio-wave-unplayed)';}
    });
    audio.addEventListener('timeupdate',function(){
      if(!audio.duration)return;
      const p=audio.currentTime/audio.duration;
      const clamped=Math.max(0,Math.min(1,p));
      if(dot)dot.style.left='calc('+(clamped*100)+'% - 5px)';
      const cutoff=Math.floor(clamped*bars.length);
      for(let i=0;i<bars.length;i++){
        if(i<cutoff){bars[i].style.backgroundColor='var(--audio-wave-played)';}
        else{bars[i].style.backgroundColor='var(--audio-wave-unplayed)';}
      }
      if(elapsedEl){
        const t=Math.max(0,Math.floor(audio.currentTime||0));
        const m=Math.floor(t/60);
        const s=t%60;
        elapsedEl.textContent=m+':'+String(s).padStart(2,'0');
      }
    });
  }
  else if(type==='file'){
    d.innerHTML='<div class="file-card"><div class="file-icon">📄</div><div style="flex:1;min-width:0"><p style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(extra?.fileName||'Arquivo')+'</p>'+(extra?.fileSize?'<p style="font-size:11px;opacity:.5">'+extra.fileSize+'</p>':'')+'</div><a href="'+content+'" target="_blank" rel="noopener" class="file-dl">⬇</a></div>'+timeWithTicks(side);
  }
  else if(type==='pix'){
    const receiver=esc(extra?.receiverName||'');
    const key=String(extra?.pixKey||'');
    const keyHtml=esc(key);
    const keyAttr=encodeURIComponent(key);
    d.style.padding='0';
    d.innerHTML=
      '<div style="padding:10px 12px 8px 12px">' +
        '<div class="pix-head">' +
          '<span class="pix-icon">' +
            '<img src="'+PIX_LOGO_URL+'" alt="Pix" width="32" height="32" style="border-radius:4px" />' +
          '</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="pix-name">'+receiver+'</div>' +
            '<div class="pix-key">'+keyHtml+'</div>' +
            '<div style="display:flex;justify-content:flex-end">'+timeWithTicks(side,'float:none;margin:6px 0 0 0')+'</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="pix-copy" data-pix="'+keyAttr+'"><span class="pix-copy-ico">📋</span><span class="pix-copy-text">Copiar chave Pix</span></button>';

    const btn=d.querySelector('.pix-copy');
    btn.addEventListener('click',async function(){
      const data=this.getAttribute('data-pix')||'';
      const text=decodeURIComponent(data);
      try{
        if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);}
        else{
          const el=document.createElement('textarea');
          el.value=text;el.style.position='fixed';el.style.left='-9999px';el.style.top='0';
          document.body.appendChild(el);el.focus();el.select();document.execCommand('copy');document.body.removeChild(el);
        }
      }catch{}
      const ico=this.querySelector('.pix-copy-ico');
      const txt=this.querySelector('.pix-copy-text');
      if(ico)ico.textContent='✓';
      if(txt)txt.textContent='Copiado!';
      this.disabled=true;
      setTimeout(()=>{
        if(ico)ico.textContent='📋';
        if(txt)txt.textContent='Copiar chave Pix';
        this.disabled=false;
      },2000);
    });
  }
  else{d.innerHTML='<span>'+applyMarkdown(esc(content))+'</span>'+timeWithTicks(side)}
  msgs.appendChild(d);scroll();
  if(side==='bot')playSound();
  return d;
}

function showTyping(){
  const d=document.createElement('div');d.className='typing';d.id='typing-ind';
  d.innerHTML='<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  msgs.appendChild(d);scroll();status.textContent='digitando...';
}
function hideTyping(){
  const t=document.getElementById('typing-ind');if(t)t.remove();status.textContent='online';
}

function showButtons(content,buttons,parentNext){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='msg msg-bot';
    d.style.padding='0';
    d.style.overflow='visible';
    const wrap=document.createElement('div');
    wrap.style.overflow='hidden';
    wrap.style.borderRadius='8px';
    wrap.style.borderTopLeftRadius='3px';
    if(content){
      const top=document.createElement('div');
      top.style.padding='6px 12px 4px 12px';
      top.innerHTML='<span>'+applyMarkdown(esc(content))+'</span><div style="display:flex;justify-content:flex-end">'+timeWithTicks('bot')+'</div>';
      wrap.appendChild(top);
    }
    const list=document.createElement('div');
    buttons.forEach((b,idx)=>{
      const btn=document.createElement('button');
      btn.className='btn-option';
      btn.innerHTML='<span>'+esc(b.label)+'</span>';
      btn.onclick=()=>{
        list.querySelectorAll('button').forEach(x=>x.disabled=true);
        userReplied=true;
        updateBotTicks();
        addMsg('user',b.label,'text');
        if(b.trackEvent&&window.fbq)window.fbq('track',b.trackEvent,{label:b.label});
        resolve(b.next||parentNext||'');
      };
      list.appendChild(btn);
    });
    wrap.appendChild(list);
    d.appendChild(wrap);
    msgs.appendChild(d);
    scroll();
  });
}

function getDelay(text){const l=(text||'').length||20;return Math.min(2000,Math.max(600,l*25))}

async function processBlock(block){
  switch(block.type){
    case 'text':
      showTyping();await sleep(getDelay(block.content));hideTyping();
      addMsg('bot',replaceVars(block.content||''),'text');await sleep(300);return block.next;
    case 'image':
      showTyping();await sleep(800);hideTyping();
      addMsg('bot',block.url||'','image');await sleep(400);return block.next;
    case 'video':
      showTyping();await sleep(800);hideTyping();
      addMsg('bot',block.url||'','video');await sleep(400);return block.next;
    case 'audio':
      showTyping();await sleep(800);hideTyping();
      if(!block.forwarded){
        const rec=addMsg('bot','Gravando áudio...','recording');await sleep(2000);
        if(rec&&rec.parentNode)rec.parentNode.removeChild(rec);
      }
      addMsg('bot',block.url||'','audio',{duration:block.duration||'0:00',forwarded:!!block.forwarded});await sleep(400);return block.next;
    case 'file':
      showTyping();await sleep(600);hideTyping();
      addMsg('bot',block.url||'','file',{fileName:block.fileName,fileSize:block.fileSize});await sleep(400);return block.next;
    case 'delay':
      showTyping();await sleep(block.delayMs||1500);hideTyping();return block.next;
    case 'input':
      if(block.content){showTyping();await sleep(getDelay(block.content));hideTyping();addMsg('bot',replaceVars(block.content),'text');await sleep(300)}
      input.disabled=false;input.placeholder=block.placeholder||'Digite sua resposta...';input.focus();
      return new Promise(resolve=>{
        const submit=()=>{
          if(!input.value.trim())return;
          const norm=normalizeInput(input.value.trim(),block.inputType);
          if(block.variable)vars[block.variable]=norm;
          addMsg('user',norm,'text');
          input.value='';input.disabled=true;input.placeholder='Aguardando...';
          if(window.fbq)window.fbq('track','Lead',{variable:block.variable,value:norm});
          sendBtn.removeEventListener('click',submit);input.removeEventListener('keydown',keyHandler);
          resolve(block.next);
        };
        const keyHandler=(e)=>{if(e.key==='Enter'){e.preventDefault();submit()}};
        sendBtn.disabled=false;
        sendBtn.addEventListener('click',submit);
        input.addEventListener('keydown',keyHandler);
      });
    case 'buttons':
      const btxt=replaceVars(block.content||'');
      showTyping();await sleep(getDelay(btxt||' '));hideTyping();
      return showButtons(btxt,block.buttons||[],block.next||'');
    case 'pix':
      showTyping();await sleep(700);hideTyping();
      addMsg('bot','', 'pix', {receiverName:block.pixData?.receiverName||'', pixKey:block.pixData?.pixKey||''});
      await sleep(300);return block.next;
    case 'redirect':
      addMsg('bot','🔗 Redirecionando para '+block.url+'...','text');
      await sleep(1500);if(block.url)window.open(block.url,'_blank');return block.next;
    default:return block.next;
  }
}

async function run(){
  if(window.fbq)window.fbq('track','ViewContent',{flowName:FLOW.name});
  let id=FLOW.blocks[0]?.id;
  while(id){
    const block=FLOW.blocks.find(b=>b.id===id);
    if(!block)break;
    id=await processBlock(block);
  }
  if(FLOW.webhookUrl && FLOW.webhookEnabled !== false){
    fetch(FLOW.webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...vars,utms,timestamp:new Date().toISOString()})}).catch(()=>{});
  }
  status.textContent='offline';
}

function start(){
  if(started)return;
  started=true;
  if(startScreen)startScreen.style.display='none';
  if(header)header.style.display='flex';
  if(msgs)msgs.style.display='flex';
  if(inputBar)inputBar.style.display='flex';
  run();
}
if(startBtn)startBtn.addEventListener('click',start);
})();
</script>
${footerCustom}
</body>
</html>`;
}
