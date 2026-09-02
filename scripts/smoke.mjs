// End-to-end smoke test of the study tools against a built ./public.
// Run with: npm run test:smoke   (after npm run build)
import { chromium } from 'playwright';
import { chromiumExecutable } from './chromium.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public', import.meta.url));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server = createServer((req,res)=>{
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p,'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, {'content-type': types[extname(p)] || 'text/plain'});
  res.end(readFileSync(p));
});
await new Promise(r=>server.listen(8099, r));

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });

async function go(path){ await page.goto('http://localhost:8099'+path, {waitUntil:'networkidle'}); }

// 1. review session: does a graded card actually advance and persist?
await go('/tools/review/');
await page.waitForSelector('.review-card', {timeout:5000});
const q1 = await page.textContent('.q');
await page.keyboard.press(' ');
await page.waitForSelector('.grades', {timeout:3000});
await page.keyboard.press('3');           // Good
await page.waitForSelector('.review-card .q');
const q2 = await page.textContent('.q');
console.log('review advanced:', q1 !== q2, '|', q1.slice(0,40));
const stored = await page.evaluate(()=>JSON.parse(localStorage.getItem('cka.progress.v1')));
console.log('cards scheduled:', Object.keys(stored.cards).length, JSON.stringify(Object.values(stored.cards)[0]));

// 2. cloze rendering
await page.selectOption('#fType','cloze');
await page.click('#fStart');
await page.waitForSelector('pre.cloze');
const blanks = await page.$$eval('.cloze-blank', n=>n.length);
await page.keyboard.press(' ');
const revealed = await page.$$eval('.cloze-blank.revealed', n=>n.map(x=>x.textContent).slice(0,3));
console.log('cloze blanks:', blanks, 'revealed sample:', revealed);

// 3. practice task timer
await go('/tools/practice/');
await page.waitForSelector('#taskList .card');
await page.click('#taskList .card .btn');
await page.waitForSelector('.timer');
await page.waitForTimeout(1200);
const t = await page.textContent('.timer');
await page.click('text=I\'m done');
await page.waitForSelector('.step');
const steps = await page.$$eval('.step', n=>n.length);
console.log('timer ticked:', t, '| solution steps:', steps);

// 4. dashboard
await go('/tools/dashboard/');
await page.waitForSelector('.bar');
const rows = await page.$$eval('#dash .card strong', n=>n.map(x=>x.textContent));
console.log('dashboard rows (risk order):', rows);

// 5. plan
await go('/tools/plan/');
await page.fill('#examDate','2026-11-15');
await page.dispatchEvent('#examDate','change');
await page.waitForSelector('#plan .stat');
console.log('plan:', (await page.textContent('#plan')).replace(/\s+/g,' ').slice(0,150));

// 6. export round trip
await go('/tools/data/');
await page.waitForSelector('#datatool .stat');
const ok = await page.evaluate(async () => {
  const m = await import('/assets/js/store.js');
  const json = m.exportJSON();
  m.reset();
  const before = Object.keys(m.load().cards).length;
  m.importJSON(json);
  return { before, after: Object.keys(m.load().cards).length };
});
console.log('export/import round trip:', JSON.stringify(ok));

// 7. mobile + theme
await page.setViewportSize({width:390,height:844});
await go('/domains/troubleshooting/');
const overflow = await page.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
await page.click('#themeToggle');
const theme = await page.getAttribute('html','data-theme');
console.log('mobile h-overflow px:', overflow, '| theme after toggle:', theme);

await browser.close(); server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('no console/page errors');
