import http from 'node:http'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
const DIR='new URL('.', import.meta.url).pathname';
const PORT=8751, CDP=9353;
const server=http.createServer((_,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync(process.env.QB_FILE || new URL('../../index.html', import.meta.url).pathname));});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--remote-debugging-port=${CDP}`,'--no-first-run','--disable-gpu',`--user-data-dir=${DIR}/cp-diag`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let ts;
for(let i=0;i<60;i++){try{ts=await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();if(ts.length)break;}catch{}await sleep(250);}
const ws=new WebSocket(ts.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r));
let id=0;const p=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}});
const send=(m,q={})=>{const i=++id;ws.send(JSON.stringify({id:i,method:m,params:q}));return new Promise(r=>p.set(i,r));};
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
await send('Runtime.enable');await send('Page.enable');
await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/`}); await sleep(1600);
await ev(`finishOnboarding(); state.entries.push({id:'a',entryType:'income',date:'2026-03-04',description:'Acme Co. invoice',category:'Business income',amount:100000,createdAt:''},{id:'b',entryType:'expense',date:'2026-04-09',description:'Adobe Creative Cloud subscription',category:'Software and subscriptions',amount:62.99,createdAt:''}); renderAll();`);

console.log('=== INPUTS WITHOUT ACCESSIBLE NAME (incl. hidden) ===');
console.log(await ev(`(()=>{const bad=[];document.querySelectorAll('.view').forEach(v=>{v.hidden=false;
 v.querySelectorAll('input,select,textarea').forEach(n=>{if(!(n.labels?.length||n.getAttribute('aria-label')||n.getAttribute('aria-labelledby')))
 bad.push(v.dataset.route+' -> <'+n.tagName.toLowerCase()+' id='+(n.id||'?')+' type='+(n.type||'')+'>');});v.hidden=true;});return bad;})()`));

console.log('\n=== TABLES WITHOUT CAPTION ===');
console.log(await ev(`(()=>{const bad=[];document.querySelectorAll('.view').forEach(v=>{v.hidden=false;
 v.querySelectorAll('table').forEach(t=>{if(!t.querySelector('caption')){const h=Array.from(t.querySelectorAll('thead th')).map(x=>x.textContent.trim()).join('|');
 bad.push(v.dataset.route+' -> ['+h+']');}});v.hidden=true;});return bad;})()`));

console.log('\n=== HEADING ORDER ===');
console.log(await ev(`(()=>{const bad=[];document.querySelectorAll('.view').forEach(v=>{v.hidden=false;let prev=0;
 v.querySelectorAll('h1,h2,h3,h4').forEach(h=>{const lv=+h.tagName[1];if(prev&&lv>prev+1)bad.push(v.dataset.route+': '+h.tagName+' "'+h.textContent.trim().slice(0,40)+'" after H'+prev);prev=lv;});v.hidden=true;});return bad;})()`));

console.log('\n=== 375px OVERFLOW CULPRITS ===');
await send('Emulation.setDeviceMetricsOverride',{width:375,height:800,deviceScaleFactor:1,mobile:true});
for(const r of ['overview','ledger','expenses','payments','estimate','reports','settings','help','pricing','terms','privacy']){
  await ev(`location.hash='#/${r}';window.dispatchEvent(new HashChangeEvent('hashchange'));`); await sleep(120);
  const res=await ev(`(()=>{const vw=document.documentElement.clientWidth;const over=document.documentElement.scrollWidth-vw;
   if(over<=1)return null;const list=[];
   document.querySelectorAll('body *').forEach(n=>{
     const cs=getComputedStyle(n); if(cs.display==='none')return;
     const ovx=cs.overflowX;
     if(n.scrollWidth>n.clientWidth+1 && ovx!=='auto' && ovx!=='scroll' && ovx!=='hidden'){
       list.push(n.tagName.toLowerCase()+'.'+(n.className.toString().split(' ').slice(0,2).join('.'))+
        ' sw='+n.scrollWidth+' cw='+n.clientWidth+' par='+(n.parentElement?n.parentElement.tagName.toLowerCase()+'.'+n.parentElement.className.toString().split(' ')[0]:'')+
        ' :: '+(n.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40));}});
   return {over, worst:list.slice(0,8)};})()`);
  if(res) console.log(' '+r+' (+'+res.over+'px)\n   '+res.worst.join('\n   '));
}
ws.close();chrome.kill();server.close();
