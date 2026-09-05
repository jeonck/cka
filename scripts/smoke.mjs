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

// 7. bookmark search: does the filter narrow, highlight, and survive a reload?
await go('/reference/bookmarks/');
await page.waitForSelector('#bmq');
const all = await page.$$eval('tr.bm-row', n => n.length);
await page.fill('#bmq', 'pvc pending');
await page.waitForFunction(() => document.querySelectorAll('tr.bm-row:not([hidden])').length < 5);
const hits = await page.$$eval('tr.bm-row:not([hidden])', n => n.length);
const marks = await page.$$eval('tr.bm-row:not([hidden]) mark', n => n.length);
const foldersShown = await page.$$eval('.bm-folder:not([hidden])', n => n.length);
console.log('bookmarks:', all, 'links |', hits, 'match "pvc pending" |', marks, 'highlights |', foldersShown, 'folder(s) left |', await page.textContent('#bmCount'));
await page.keyboard.press('Escape');
await page.waitForFunction((t) => document.querySelectorAll('tr.bm-row:not([hidden])').length === t, all);
// The query round-trips through the URL, so a filtered view can be shared.
await go('/reference/bookmarks/?q=etcd');
await page.waitForSelector('#bmq');
console.log('bookmarks from ?q=etcd:', await page.$$eval('tr.bm-row:not([hidden])', n => n.length), 'shown |',
  'no match message hidden:', await page.$eval('.bm-empty', e => e.hidden));

// 8. site-wide search palette: does "/" open it, does it rank sensibly, does Enter navigate?
await go('/');
await page.keyboard.press('/');
await page.waitForSelector('#siteSearch[open] #ssq');
await page.fill('#ssq', 'pvc pending');
await page.waitForFunction(() => document.querySelectorAll('#ssResults a').length > 0);
const top = await page.$$eval('#ssResults a', a => a.slice(0, 3).map(x =>
  `${x.querySelector('.palette-kind').textContent.trim()}:${x.querySelector('.palette-title').textContent.trim()}`));
console.log('search "pvc pending":', await page.textContent('#ssHint'), '|', top.join(' / '));
await page.keyboard.press('ArrowDown');
const href = await page.$eval('#ssResults a.is-active', a => a.getAttribute('href'));
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.keyboard.press('Enter')]);
console.log('search Enter →', href, '| landed', await page.evaluate(() => location.pathname + location.search));
// A deep-linked practice task is marked rather than started.
await go('/tools/practice/?task=tk-004');
await page.waitForSelector('.card.is-target');
console.log('task deep link:', await page.$eval('.card.is-target h3', h => h.textContent));
// The bookmark page keeps "/" for its own filter; the palette is still on ctrl+K.
await go('/reference/bookmarks/');
await page.click('h1');
await page.keyboard.press('/');
console.log('bookmarks keep "/":', await page.evaluate(() => document.activeElement?.id),
  '| palette open:', !!(await page.$('#siteSearch[open]')));

// 9. mobile + theme
await page.setViewportSize({width:390,height:844});
await go('/domains/troubleshooting/');
const overflow = await page.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
await page.click('#themeToggle');
const theme = await page.getAttribute('html','data-theme');
console.log('mobile h-overflow px:', overflow, '| theme after toggle:', theme);

await browser.close(); server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('no console/page errors');
