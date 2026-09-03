// Validates the drill data before a build. Cheap, and it catches the failure
// modes that only show up as a broken review session in the browser.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = (f) => JSON.parse(readFileSync(`${root}data/${f}`, "utf8")).items;
const loadFile = (f) => JSON.parse(readFileSync(`${root}data/${f}`, "utf8"));

const DOMAINS = new Set([
  "troubleshooting",
  "cluster-architecture",
  "services-networking",
  "workloads-scheduling",
  "storage",
]);

const errors = [];
const fail = (m) => errors.push(m);

const flashcards = load("flashcards.json");
const cloze = load("cloze.json");
const tasks = load("tasks.json");
const mnemonics = load("mnemonics.json");
const bookmarks = loadFile("bookmarks.json");

const ids = new Set();
for (const [name, set] of [["flashcards", flashcards], ["cloze", cloze], ["tasks", tasks], ["mnemonics", mnemonics]]) {
  for (const i of set) {
    if (!i.id) fail(`${name}: an item has no id`);
    if (ids.has(i.id)) fail(`duplicate id: ${i.id}`);
    ids.add(i.id);
    if (!DOMAINS.has(i.domain)) fail(`${i.id}: unknown domain "${i.domain}"`);
  }
}

for (const c of flashcards) {
  if (!c.front || !c.back) fail(`${c.id}: flashcard needs both front and back`);
}

for (const c of cloze) {
  const open = (c.text.match(/\[\[/g) || []).length;
  const close = (c.text.match(/\]\]/g) || []).length;
  if (open === 0) fail(`${c.id}: cloze item has no [[blanks]]`);
  if (open !== close) fail(`${c.id}: unbalanced blanks (${open} open, ${close} close)`);
  for (const m of c.text.matchAll(/\[\[(.+?)\]\]/g)) {
    if (/[[\]]/.test(m[1])) fail(`${c.id}: nested brackets inside a blank: ${m[1]}`);
  }
  if (!c.why) fail(`${c.id}: cloze item has no "why"`);
}

for (const t of tasks) {
  for (const k of ["title", "scenario", "context", "points", "targetMinutes"]) {
    if (!t[k]) fail(`${t.id}: task missing "${k}"`);
  }
  if (!t.solution?.length) fail(`${t.id}: task has no model solution`);
  if (!t.verify?.length) fail(`${t.id}: task has no verification command`);
  for (const s of t.solution || []) {
    if (!s.cmd || !s.why) fail(`${t.id}: every solution step needs a cmd and a why`);
  }
}

for (const m of mnemonics) {
  if (!m.sequence?.length) fail(`${m.id}: mnemonic has no sequence`);
  if (!m.why) fail(`${m.id}: mnemonic has no "why"`);
}

// The bookmark set is only useful if every link is one the exam actually
// permits — an out-of-scope URL is worse than no bookmark, because opening it
// in the exam is a rules violation. Prefix-check every one against the allowed
// list, and keep the file small enough to scan.
const prefixes = bookmarks.allowed.map((a) => a.prefix);
const seenUrls = new Set();
let bookmarkCount = 0;
for (const folder of bookmarks.folders) {
  if (!folder.name) fail("bookmarks: a folder has no name");
  if (!folder.why) fail(`bookmarks: folder "${folder.name}" has no "why"`);
  if (!folder.items?.length) fail(`bookmarks: folder "${folder.name}" is empty`);
  for (const b of folder.items || []) {
    bookmarkCount++;
    if (!b.title || !b.url || !b.when) fail(`bookmarks: an item in "${folder.name}" is missing title, url or when`);
    if (!DOMAINS.has(b.domain)) fail(`bookmarks: ${b.title} — unknown domain "${b.domain}"`);
    if (!prefixes.some((p) => b.url?.startsWith(p)))
      fail(`bookmarks: ${b.url} is outside the documentation the exam allows`);
    if (seenUrls.has(b.url)) fail(`bookmarks: duplicate url ${b.url}`);
    seenUrls.add(b.url);
  }
}

const byDomain = (set) =>
  [...DOMAINS].map((d) => `${d}:${set.filter((i) => i.domain === d).length}`).join(" ");

if (errors.length) {
  console.error(`data check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`data check passed — ${ids.size} items`);
console.log(`  flashcards ${flashcards.length}  ${byDomain(flashcards)}`);
console.log(`  cloze      ${cloze.length}  ${byDomain(cloze)}`);
console.log(`  tasks      ${tasks.length}  ${byDomain(tasks)} · ${tasks.reduce((a, t) => a + t.targetMinutes, 0)} target minutes`);
console.log(`  mnemonics  ${mnemonics.length}  ${byDomain(mnemonics)}`);
console.log(`  bookmarks  ${bookmarkCount}  in ${bookmarks.folders.length} folders · ${prefixes.length} allowed domains`);
