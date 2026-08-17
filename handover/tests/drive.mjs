/* Zero-dependency Chrome DevTools Protocol driver.
   Serves the built file over http, loads it in headless Chrome, and reports
   runtime exceptions, console errors, every network request, and a battery
   of assertions against the live app. */
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const FILE = process.env.QB_FILE || new URL('../../index.html', import.meta.url).pathname;
const PORT = 8731;
const CDP_PORT = 9333;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(FILE));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,1000',
  `--user-data-dir=${DIR}/chrome-profile`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

let targets = null;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json(); if (targets.length) break; }
  catch { /* not up yet */ }
  await sleep(250);
}
if (!targets?.length) { console.error('Chrome did not start'); process.exit(1); }

const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));

let msgId = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) events.push(m);
});
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise(r => pending.set(id, r));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception));
  return r.result?.result?.value;
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Network.enable');

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(2200);

// ---------------------------------------------------------------- reports
const exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown');
const consoleErrs = events.filter(e =>
  (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)) ||
  (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)));
const requests = events.filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url);

console.log('=== RUNTIME EXCEPTIONS ===');
if (!exceptions.length) console.log('  none');
exceptions.forEach(e => console.log('  ' + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)));

console.log('\n=== CONSOLE ERRORS / WARNINGS ===');
if (!consoleErrs.length) console.log('  none');
consoleErrs.forEach(e => console.log('  ' + (e.params.entry?.text || JSON.stringify(e.params.args?.map(a => a.value)))));

console.log('\n=== NETWORK REQUESTS (privacy claim) ===');
requests.forEach(u => console.log('  ' + u));
const external = requests.filter(u => !u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:'));
console.log(external.length === 0
  ? `  -> PASS: ${requests.length} request(s), all to the page origin. No external host contacted.`
  : `  -> FAIL: external requests: ${external.join(', ')}`);

// ---------------------------------------------------------------- assertions
const results = await evaluate(`(() => {
  const out = [];
  const t = (name, pass, detail='') => out.push({name, pass, detail});

  // ---- router: exactly one view visible per route
  const routes = ['overview','ledger','expenses','payments','estimate','reports','settings','help','pricing','terms','privacy'];
  for (const r of routes) {
    location.hash = '#/' + r;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const visible = Array.from(document.querySelectorAll('.view')).filter(v => !v.hidden);
    const tabOK = !!document.querySelector('.tab[data-route-link="'+r+'"][aria-current="page"]') ||
                  !document.querySelector('.tab[data-route-link="'+r+'"]');
    t('route ' + r, visible.length === 1 && visible[0].dataset.route === r && tabOK,
      'visible=' + visible.length + ' -> ' + (visible[0]?.dataset.route) + ' title=' + document.title);
  }

  // ---- deep anchor into legal page
  location.hash = '#tos-12';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  const v = Array.from(document.querySelectorAll('.view')).filter(x => !x.hidden);
  t('deep anchor #tos-12 opens Terms', v.length === 1 && v[0].dataset.route === 'terms');

  // ---- legacy hash from the old single-page version
  location.hash = '#history';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  const v2 = Array.from(document.querySelectorAll('.view')).filter(x => !x.hidden);
  t('legacy #history -> reports', v2.length === 1 && v2[0].dataset.route === 'reports');

  // ---- tax math against a hand-computed figure
  const est = calculateEstimate({income:100000, expenses:20000, filingStatus:'single',
    w2Wages:0, otherIncome:0, withholding:0, credits:0, estimatedPayments:0});
  t('SE tax = 11303.64', Math.abs(est.seTaxCore - 11303.64) < 0.01, est.seTaxCore.toFixed(2));
  t('income tax = 7526.60', Math.abs(est.federalIncomeTax - 7526.5996) < 0.01, est.federalIncomeTax.toFixed(4));
  t('total federal = 18830.24', Math.abs(est.estimatedTotalFederalTax - 18830.2396) < 0.01, est.estimatedTotalFederalTax.toFixed(4));
  t('set-aside = quarter of total', Math.abs(est.suggestedQuarterlySetAside*4 - est.estimatedTotalFederalTax) < 1e-9);

  // ---- SE threshold edge
  const tiny = calculateEstimate({income:400, expenses:0, filingStatus:'single'});
  t('below SE threshold -> no SE tax', tiny.seTaxCore === 0, '400*0.9235=369.4 < 400');

  // ---- loss year
  const loss = calculateEstimate({income:1000, expenses:5000, filingStatus:'single'});
  t('loss year -> profit floored at 0', loss.netProfit === 0 && loss.rawNet === -4000);

  // ---- garbage input cannot produce NaN (the settingsByYear bug)
  const junk = calculateEstimate({income:'abc', expenses:null, filingStatus:'nonsense',
    w2Wages:'xyz', otherIncome:undefined, withholding:NaN, credits:{}, estimatedPayments:'12'});
  t('garbage input -> no NaN', Object.values(junk).every(x => typeof x !== 'number' || isFinite(x)),
    JSON.stringify(junk.estimatedTotalFederalTax));

  // ---- wage base cap
  const capped = calculateEstimate({income:400000, expenses:0, filingStatus:'single', w2Wages:0});
  t('SS portion capped at wage base', Math.abs(capped.socialSecurityPortion - 184500*0.124) < 0.01,
    capped.socialSecurityPortion.toFixed(2));

  // ---- Additional Medicare kicks in
  t('Additional Medicare applied above threshold', capped.additionalMedicareTax > 0,
    capped.additionalMedicareTax.toFixed(2));

  // ---- federal holiday deadline logic
  const d2028 = deadlinesForTaxYear(2028);
  t('2028 Q1 -> Apr 18 (Emancipation Day observed Mon Apr 17)',
    d2028[0].date.getMonth()===3 && d2028[0].date.getDate()===18, d2028[0].date.toDateString());
  const d2028q4 = d2028[3];
  t('TY2028 Q4 -> Jan 16 2029 (Jan 15 is MLK Day)',
    d2028q4.date.getFullYear()===2029 && d2028q4.date.getMonth()===0 && d2028q4.date.getDate()===16,
    d2028q4.date.toDateString());
  const d2026 = deadlinesForTaxYear(2026);
  t('2026 Q1 -> Apr 15', d2026[0].date.getMonth()===3 && d2026[0].date.getDate()===15, d2026[0].date.toDateString());
  t('2026 Q2 -> Jun 15', d2026[1].date.getMonth()===5 && d2026[1].date.getDate()===15, d2026[1].date.toDateString());
  const d2027 = deadlinesForTaxYear(2027);
  t('TY2027 Q4 -> Jan 18 2028 (Jan 15 Sat, Jan 17 MLK)',
    d2027[3].date.getFullYear()===2028 && d2027[3].date.getMonth()===0 && d2027[3].date.getDate()===18,
    d2027[3].date.toDateString());

  // ---- escaping
  t('escapeHtml handles quotes', escapeHtml('a"b\\'c<d>e&f') === 'a&quot;b&#39;c&lt;d&gt;e&amp;f', escapeHtml('a"b'));
  t('csv formula injection neutralised', csvSafeField('=SUM(A1)').startsWith("'"), csvSafeField('=SUM(A1)'));
  t('csv quote escaping', csvSafeField('a"b,c') === '"a""b,c"', csvSafeField('a"b,c'));

  // ---- the hero set-aside bug: add an entry and confirm the overview updates
  const before = document.getElementById('ovSetAside').textContent;
  state.entries.push({id:'test-1', entryType:'income', date: state.selectedYear+'-03-04',
    description:'Test invoice', category:'Business income', amount:100000, createdAt:new Date().toISOString()});
  state.entries.push({id:'test-2', entryType:'expense', date: state.selectedYear+'-04-09',
    description:'Laptop', category:'Equipment', amount:20000, createdAt:new Date().toISOString()});
  renderAll();
  const after = document.getElementById('ovSetAside').textContent;
  t('overview set-aside updates (was permanently $0)', before === '$0' && after === '$4,708', before + ' -> ' + after);
  t('estimate tab set-aside matches', document.getElementById('estSetAside').textContent === '$4,708',
    document.getElementById('estSetAside').textContent);
  t('ledger renders both rows', document.querySelectorAll('#ledgerBody tr').length === 2);
  t('overview total tax', document.getElementById('ovTotalTax').textContent === '$18,830.24',
    document.getElementById('ovTotalTax').textContent);

  // ---- XSS: a hostile category from an imported backup must not become markup
  state.entries.push({id:'test-3', entryType:'expense', date: state.selectedYear+'-05-02',
    description:'"><img src=x onerror=alert(1)>', category:'"><script>alert(2)<\\/script>',
    amount:5, createdAt:new Date().toISOString()});
  renderAll();
  t('no injected img element', document.querySelectorAll('#view-expenses img').length === 0);
  t('no injected script element', document.querySelectorAll('#view-expenses script').length === 0);
  const opts = Array.from(document.querySelectorAll('#expCategoryFilter option')).map(o => o.value);
  t('hostile category kept as inert option text', opts.includes('"><script>alert(2)<\\/script>'), JSON.stringify(opts));

  // ---- storage round trip
  saveState();
  const parsed = JSON.parse(localStorage.getItem('quarterback:app:v3'));
  const revalidated = validateLoadedState(parsed);
  t('save/load round trip keeps entries', revalidated.entries.length === state.entries.length);
  t('corrupt settingsByYear is coerced',
    validateLoadedState({settingsByYear:{2026:{w2Wages:'abc', filingStatus:'bogus'}}}).settingsByYear[2026].w2Wages === 0);
  t('out-of-range year clamped', validateLoadedState({selectedYear: 99999}).selectedYear <= 2035);
  t('invalid entries dropped',
    validateLoadedState({entries:[{id:'x'},{id:'y',entryType:'income',date:'bad',amount:5},null]}).entries.length === 0);

  // ---- theme
  applyTheme('dark');
  t('dark theme applied', document.documentElement.getAttribute('data-theme') === 'dark');
  applyTheme('light');
  t('light theme applied', document.documentElement.getAttribute('data-theme') === 'light');
  applyTheme('system');
  t('system theme clears attribute', !document.documentElement.hasAttribute('data-theme'));

  // ---- legal placeholders resolved
  const unresolved = Array.from(document.querySelectorAll('[data-legal]')).filter(n => !n.textContent.trim());
  t('all data-legal spans filled', unresolved.length === 0, unresolved.length + ' empty');
  const mailtos = Array.from(document.querySelectorAll('[data-legal-mailto]'));
  t('mailto links wired', mailtos.length > 0 && mailtos.every(a => a.getAttribute('href').startsWith('mailto:')));

  // ---- cleanup so the screenshot shows a realistic populated app
  state.entries = state.entries.filter(e => e.id !== 'test-3');
  renderAll();

  return out;
})()`);

console.log('\n=== APP ASSERTIONS ===');
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`);
}
console.log(`\n  ${results.length - failed}/${results.length} passed`);

// ---------------------------------------------------------------- screenshots
async function shot(route, name, width = 1280) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 2, mobile: width < 700 });
  await evaluate(`location.hash='#/${route}'; window.dispatchEvent(new HashChangeEvent('hashchange')); window.scrollTo(0,0);`);
  await sleep(500);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(DIR, name), Buffer.from(r.result.data, 'base64'));
}
await evaluate(`finishOnboarding(); state.profile.displayName='Jordan'; renderProfile(); renderAll(); applyTheme('light')`);
await shot('overview', 'shot-overview.png');
await shot('estimate', 'shot-estimate.png');
await shot('terms', 'shot-terms.png');
await evaluate(`applyTheme('dark')`);
await shot('ledger', 'shot-ledger-dark.png');
await shot('privacy', 'shot-privacy-mobile.png', 420);

console.log('\nscreenshots written');
ws.close(); chrome.kill(); server.close();
process.exit(failed || exceptions.length || external.length ? 1 : 0);
