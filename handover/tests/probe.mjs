import http from 'node:http'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
const DIR = new URL('.', import.meta.url).pathname;
const PORT=8761, CDP=9363;
const server=http.createServer((_,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync(process.env.QB_FILE || new URL('../../index.html', import.meta.url).pathname));});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--remote-debugging-port=${CDP}`,'--no-first-run','--disable-gpu',`--user-data-dir=${DIR}/cp-probe`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let ts;
for(let i=0;i<60;i++){try{ts=await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();if(ts.length)break;}catch{}await sleep(250);}
const ws=new WebSocket(ts.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r));
let id=0;const p=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}});
const send=(m,q={})=>{const i=++id;ws.send(JSON.stringify({id:i,method:m,params:q}));return new Promise(r=>p.set(i,r));};
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
await send('Runtime.enable');await send('Page.enable');
await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/`}); await sleep(1500);
await ev(`finishOnboarding(); state.entries.push({id:'a',entryType:'income',date:'2026-03-04',description:'Acme invoice',category:'Business income',amount:100000,createdAt:''}); renderAll();`);
await send('Emulation.setDeviceMetricsOverride',{width:375,height:800,deviceScaleFactor:1,mobile:true});
await ev(`location.hash='#/ledger';window.dispatchEvent(new HashChangeEvent('hashchange'));`); await sleep(300);

for(const r of ['ledger','expenses','overview','reports','terms']){
  await ev(`location.hash='#/'+${JSON.stringify(r)};window.dispatchEvent(new HashChangeEvent('hashchange'));window.scrollTo(0,0);`);
  await sleep(250);
  const res = await ev(`(()=>{
    // Can the user actually pan the page sideways?
    window.scrollTo(600,0); const withClip = window.scrollX; window.scrollTo(0,0);
    // Now drop the body clip and re-test, to see whether overflow-x:hidden is
    // merely masking a real layout overflow.
    const prev = document.body.style.overflowX; document.body.style.overflowX='visible';
    void document.body.offsetWidth;
    window.scrollTo(600,0); const noClip = window.scrollX; window.scrollTo(0,0);
    document.body.style.overflowX = prev;
    return {withClip, noClip, docSW: document.documentElement.scrollWidth, docCW: document.documentElement.clientWidth};
  })()`);
  console.log(r.padEnd(9), 'panned(with body clip)='+res.withClip, ' panned(clip removed)='+res.noClip,
              ' docSW='+res.docSW, 'docCW='+res.docCW);
}
ws.close();chrome.kill();server.close();
