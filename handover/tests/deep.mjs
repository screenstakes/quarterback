/* Deep interaction + responsive + a11y sweep driven through real input events. */
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const DIR = 'new URL('.', import.meta.url).pathname';
const FILE = process.env.QB_FILE || new URL('../../index.html', import.meta.url).pathname;
const PORT = 8741, CDP = 9343;

const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(FILE));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${CDP}`, '--no-first-run', '--disable-gpu',
  '--window-size=1280,900', `--user-data-dir=${DIR}/cp-deep`, 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); if (targets.length) break; } catch {}
  await sleep(250);
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) events.push(m);
});
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise(r => pending.set(i, r)); };
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval threw');
  return r.result?.result?.value;
}
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable');

const out = [];
const t = (name, pass, detail = '') => { out.push({ name, pass, detail }); };

// Real mouse click at an element's centre.
async function click(selector, nth = 0) {
  const box = await ev(`(() => { const n = document.querySelectorAll(${JSON.stringify(selector)})[${nth}];
    if (!n) return null; const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    n.scrollIntoView({block:'center', behavior:'instant'}); const r2 = n.getBoundingClientRect();
    return {x: r2.left + r2.width/2, y: r2.top + r2.height/2}; })()`);
  await sleep(60);
  if (!box) return false;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(120);
  return true;
}
async function typeInto(selector, text) {
  await ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  for (const ch of text) await send('Input.dispatchKeyEvent', { type: 'char', text: ch });
  await ev(`(() => { const n=document.querySelector(${JSON.stringify(selector)});
    n.dispatchEvent(new Event('input',{bubbles:true})); n.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
async function setVal(selector, value) {
  await ev(`(() => { const n=document.querySelector(${JSON.stringify(selector)}); n.value=${JSON.stringify(value)};
    n.dispatchEvent(new Event('input',{bubbles:true})); n.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(1800);

// ============================ ONBOARDING via real clicks
t('onboarding shows on first load', await ev(`!document.getElementById('onboardOverlay').hidden`));
t('focus starts inside dialog', await ev(`document.getElementById('onboardOverlay').contains(document.activeElement)`));
await click('#onboardNextBtn');                       // step 1 -> 2
await typeInto('#obName', 'Jordan Avery');
await click('#onboardNextBtn');                       // -> 3 colour
await click('.ob-swatch', 2);
await click('#onboardNextBtn');                       // -> 4 business
await typeInto('#obBizName', 'Avery Design Co.');
await click('#onboardNextBtn');                       // -> 5 filing
await click('#onboardNextBtn');                       // -> 6 goal
await setVal('#obGoal', '9000');
await click('#onboardNextBtn');                       // -> 7 last
await click('#onboardSkipBtn');                       // skip the LAST step (the old bug)
t('onboarding closes', await ev(`document.getElementById('onboardOverlay').hidden`));
t('skipping last step still marks complete', await ev(`!!state.profile.onboardingCompletedAt`));
t('name captured through real typing', (await ev(`state.profile.displayName`)) === 'Jordan Avery');
t('goal captured', (await ev(`state.profile.financialGoal`)) === 9000);
t('avatar colour picked', (await ev(`state.profile.avatarColor`)) === (await ev(`AVATAR_COLORS[2]`)));
t('greeting uses the name', (await ev(`document.getElementById('heroGreeting').textContent`)).includes('Jordan Avery'));

// ============================ TAB CLICKS
for (const r of ['ledger', 'expenses', 'payments', 'estimate', 'reports', 'settings', 'help']) {
  await click(`.tab[data-route-link="${r}"]`);
  const vis = await ev(`Array.from(document.querySelectorAll('.view')).filter(v=>!v.hidden).map(v=>v.dataset.route)`);
  t(`clicking tab "${r}"`, vis.length === 1 && vis[0] === r, vis.join(','));
}

// ============================ ENTRY FORM via real clicks + typing
await click('.tab[data-route-link="ledger"]');
await setVal('#entryDate', '2026-03-04');
await typeInto('#entryDesc', 'Acme Co. invoice');
await setVal('#entryAmount', '9500');
await click('#submitEntryBtn');
t('income entry saved by clicking Save', (await ev(`state.entries.length`)) === 1);
t('ledger row rendered', (await ev(`document.querySelectorAll('#ledgerBody tr').length`)) === 1);

await click('label[for="typeExpense"]');
t('expense radio switches category control', await ev(`!document.getElementById('entryCategory').hidden`));
await setVal('#entryDate', '2026-03-20');
await typeInto('#entryDesc', 'Adobe CC');
await setVal('#entryCategory', 'Software and subscriptions');
await setVal('#entryAmount', '62.99');
await click('#submitEntryBtn');
t('expense entry saved', (await ev(`state.entries.length`)) === 2);
t('totals updated', (await ev(`document.getElementById('totalExpenses').textContent`)) === '$62.99');

// validation
await click('#submitEntryBtn');
t('empty submit blocked + field flagged', await ev(`document.getElementById('fieldDesc').classList.contains('invalid')`));
t('validation message announced', (await ev(`document.getElementById('entryFormStatus').textContent`)).includes('highlighted'));

// edit flow
await click('#ledgerBody tr .row-actions button', 0);
t('edit mode entered', (await ev(`document.getElementById('entryFormMode').textContent`)) === 'Editing entry');
t('cancel button revealed', await ev(`!document.getElementById('cancelEditBtn').hidden`));
await setVal('#entryAmount', '75');
await click('#submitEntryBtn');
t('edit saved, no duplicate row', (await ev(`state.entries.length`)) === 2);
t('edited amount persisted', await ev(`state.entries.some(e=>e.amount===75)`));

// filters + search
await click('.chip[data-filter="income"]');
t('income filter narrows table', (await ev(`document.querySelectorAll('#ledgerBody tr').length`)) === 1);
await click('.chip[data-filter="all"]');
await typeInto('#ledgerSearch', 'adobe');
await sleep(400);
t('search filters case-insensitively', (await ev(`document.querySelectorAll('#ledgerBody tr').length`)) === 1);
await ev(`document.getElementById('ledgerSearch').value=''; ledgerSearch=''; renderAll();`);

// ============================ PAYMENTS
await click('.tab[data-route-link="payments"]');
await setVal('#paymentDate', '2026-04-15');
await setVal('#paymentPeriod', 'Q1');
await setVal('#paymentAmount', '1200');
await click('#submitPaymentBtn');
t('payment recorded', (await ev(`state.payments.length`)) === 1);
t('payment total shown', (await ev(`document.getElementById('totalPayments').textContent`)) === '$1,200.00');
t('remaining balance reduced by payment', await ev(
  `(()=>{const s=computeSnapshot();return Math.abs(s.est.estimatedTotalFederalTax-1200-s.est.remainingEstimatedBalance)<0.01;})()`));

// ============================ THEME toggle by click
const before = await ev(`themeMode`);
await click('#themeToggle');
t('theme toggle cycles', (await ev(`themeMode`)) !== before, before + ' -> ' + await ev(`themeMode`));
await ev(`applyTheme('light')`);

// ============================ SETTINGS interactions
await click('.tab[data-route-link="settings"]');
await setVal('#filingStatus', 'mfj');
t('filing status persists per year', (await ev(`getYearSettings(state.selectedYear).filingStatus`)) === 'mfj');
t('estimate recalculated with MFJ std deduction',
  (await ev(`computeSnapshot().est.stdDeduction`)) === 32200);
await setVal('#filingStatus', 'single');
await setVal('#w2Wages', '50000');
t('w2 wages feed the model', (await ev(`computeSnapshot().est.totalOrdinaryIncome`)) > 50000);
await setVal('#w2Wages', '0');
await setVal('#taxYearSelect', '2027');
t('year switch changes selected year', (await ev(`state.selectedYear`)) === 2027);
t('other year shows empty ledger', (await ev(`entriesForSelectedYear().length`)) === 0);
await setVal('#taxYearSelect', '2026');
await setVal('#taxYearSelect', '1999');
t('out-of-range year rejected, control reverts', (await ev(`state.selectedYear`)) === 2026);
await click('#prefCompactLayout');
t('compact layout hides hero', await ev(`document.querySelector('#view-overview .hero').hidden`));
await click('#prefCompactLayout');
t('compact layout restores hero', await ev(`!document.querySelector('#view-overview .hero').hidden`));

// ============================ EXPORT / IMPORT round trip
const csv = await ev(`(()=>{ let captured=null; const orig=URL.createObjectURL;
  URL.createObjectURL=b=>{captured=b; return 'blob:stub';}; exportCsv(); URL.createObjectURL=orig;
  return captured ? captured.size : 0; })()`);
t('CSV export produces a blob', csv > 0, csv + ' bytes');
const backup = await ev(`JSON.stringify(state)`);
t('JSON backup is valid JSON', (() => { try { JSON.parse(backup); return true; } catch { return false; } })());
const restored = await ev(`(()=>{ const snapshot=JSON.parse(${JSON.stringify(backup)});
  const before={e:state.entries.length,p:state.payments.length};
  state={version:3,entries:[],payments:[],settingsByYear:{},selectedYear:2026,
    profile:DEFAULT_PROFILE(),preferences:DEFAULT_PREFERENCES(),dismissedInsights:[],updatedAt:''};
  const v=validateLoadedState(snapshot); state=v; renderAll();
  return before.e===state.entries.length && before.p===state.payments.length; })()`);
t('backup restores entries and payments', restored);

// ============================ DANGER ZONE with undo
await ev(`window.__confirm=window.confirm; window.confirm=()=>true;`);
await click('.tab[data-route-link="settings"]');
await click('#clearYearBtn');
t('clear year empties the ledger', (await ev(`entriesForSelectedYear().length`)) === 0);
t('undo button offered', await ev(`!!document.querySelector('#dangerStatus button')`));
await click('#dangerStatus button');
t('undo restores the entries', (await ev(`entriesForSelectedYear().length`)) === 2);
await ev(`window.confirm=window.__confirm;`);

// ============================ INSIGHTS dismiss
await click('.tab[data-route-link="reports"]');
const insightCount = await ev(`document.querySelectorAll('#insightsList .insight').length`);
if (insightCount > 0) {
  await click('#insightsList .insight-dismiss');
  t('insight dismiss removes the card',
    (await ev(`document.querySelectorAll('#insightsList .insight').length`)) === insightCount - 1);
  t('dismissal persisted', (await ev(`state.dismissedInsights.length`)) > 0);
} else t('insights present to dismiss', false, 'none rendered');

// ============================ RESPONSIVE overflow sweep
const routes = ['overview','ledger','expenses','payments','estimate','reports','settings','help','pricing','terms','privacy'];
for (const w of [375, 768, 1280]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 700 });
  const bad = [];
  for (const r of routes) {
    await ev(`location.hash='#/${r}'; window.dispatchEvent(new HashChangeEvent('hashchange'));`);
    await sleep(90);
    const over = await ev(`(()=>{ const d=document.documentElement;
      // Remove the body clip first, so we detect genuine layout overflow
      // rather than overflow that is merely being masked.
      const prev = document.body.style.overflowX; document.body.style.overflowX='visible';
      void document.body.offsetWidth;
      window.scrollTo(600,0); const panned = window.scrollX; window.scrollTo(0,0);
      document.body.style.overflowX = prev;
      const wide = Array.from(document.querySelectorAll('.view:not([hidden]) *'))
        .filter(n => !n.closest('.table-wrap'))
        .filter(n => n.getBoundingClientRect().right > d.clientWidth + 2)
        .map(n => n.tagName.toLowerCase()+'.'+(n.className.toString().split(' ')[0]||''));
      return {panned, wide: Array.from(new Set(wide)).slice(0,4)}; })()`);
    if (over.panned > 0) bad.push(`${r}(pans ${over.panned}px ${over.wide.join(',')})`);
  }
  t(`no horizontal overflow @ ${w}px`, bad.length === 0, bad.join(' '));
}
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

// ============================ A11Y
await ev(`location.hash='#/ledger'; window.dispatchEvent(new HashChangeEvent('hashchange'));`);
t('every input has an accessible name', await ev(`
  Array.from(document.querySelectorAll('.view:not([hidden]) input,.view:not([hidden]) select'))
    .every(n => n.labels?.length || n.getAttribute('aria-label') || n.getAttribute('aria-labelledby'))`));
t('every button has an accessible name', await ev(`
  Array.from(document.querySelectorAll('button')).filter(b=>b.offsetParent!==null)
    .every(b => (b.textContent||'').trim() || b.getAttribute('aria-label'))`));
t('all images/svg decorative or labelled', await ev(`
  Array.from(document.querySelectorAll('svg')).every(s =>
    s.getAttribute('aria-hidden')==='true' || s.getAttribute('role')==='img' ||
    s.getAttribute('role')==='presentation' || s.closest('symbol,defs') || s.closest('[aria-hidden="true"]'))`));
t('tables have captions', await ev(`
  Array.from(document.querySelectorAll('.view table')).every(tb => !!tb.querySelector('caption'))`));
t('single h1 per visible view', await ev(`
  document.querySelectorAll('.view:not([hidden]) h1').length === 1`));
t('lang set', (await ev(`document.documentElement.lang`)) === 'en');
t('skip link targets main', await ev(`!!document.getElementById('main')`));
t('external links carry rel=noopener noreferrer', await ev(`
  Array.from(document.querySelectorAll('a[target="_blank"]')).every(a => {
    const r=(a.rel||''); return r.includes('noopener') && r.includes('noreferrer'); })`));

// heading order sanity per view
const headingIssues = await ev(`(()=>{ const bad=[];
  document.querySelectorAll('.view').forEach(v=>{ v.hidden=false;
    let prev=0; v.querySelectorAll('h1,h2,h3,h4').forEach(h=>{ const lv=+h.tagName[1];
      if(prev && lv>prev+1) bad.push(v.dataset.route+':'+h.tagName+' after H'+prev); prev=lv; });
    v.hidden=true; });
  location.hash='#/overview'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  return bad.slice(0,5); })()`);
t('no skipped heading levels', headingIssues.length === 0, headingIssues.join(' | '));

// ============================ REPORT
const exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown');
const errs = events.filter(e => e.method === 'Log.entryAdded' && ['error'].includes(e.params.entry.level));
const reqs = events.filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url);
const ext = reqs.filter(u => !u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:') && !u.startsWith('blob:'));

let fails = 0;
console.log('=== DEEP INTERACTION SWEEP ===');
for (const r of out) { if (!r.pass) fails++; console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`); }
console.log(`\n  ${out.length - fails}/${out.length} passed`);
console.log(`  runtime exceptions: ${exceptions.length}`);
exceptions.forEach(e => console.log('    ' + (e.params.exceptionDetails.exception?.description || '').split('\n')[0]));
console.log(`  console errors: ${errs.length}`);
errs.forEach(e => console.log('    ' + e.params.entry.text));
console.log(`  external network requests: ${ext.length}${ext.length ? ' -> ' + ext.join(', ') : ''}`);

ws.close(); chrome.kill(); server.close();
process.exit(fails || exceptions.length || errs.length || ext.length ? 1 : 0);
