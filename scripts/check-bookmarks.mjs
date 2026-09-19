// Verify every bookmark still resolves — and that every #anchor still exists.
//
//   npm run check:bookmarks
//
// Deliberately NOT part of `npm run check` or CI. It depends on upstream
// Kubernetes documentation URLs, so a page moving there would block deploys of
// this repository, which is the wrong failure. Run it yourself in the week
// before an exam; doc URLs and heading anchors drift between releases.
//
// check-data.mjs already enforces the safety-critical property — that every URL
// sits inside the exam's allowed prefixes. This checks the other half: that the
// link actually goes somewhere, and lands where you meant it to.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(readFileSync(`${root}data/bookmarks.json`, "utf8"));

const where = new Map();
for (const folder of data.folders) {
  for (const item of folder.items) {
    if (!where.has(item.url)) where.set(item.url, []);
    where.get(item.url).push(`${folder.name} › ${item.title}`);
  }
}

const urls = [...where.keys()];
const anchored = urls.filter((u) => u.includes("#")).length;
console.log(`checking ${urls.length} bookmarks (${anchored} with anchors)\n`);

// Serial with a small delay: this is someone else's docs site, not a load test.
const results = [];
for (const url of urls) {
  results.push(await check(url));
  await new Promise((r) => setTimeout(r, 120));
}

async function check(url) {
  const [base, frag] = url.split("#");
  try {
    const res = await fetch(base, { redirect: "follow" });
    if (!res.ok) return { url, status: res.status };
    const html = await res.text();
    const moved = res.url.replace(/\/$/, "") !== base.replace(/\/$/, "");
    // Goldmark-style heading ids land as id="..."; older pages use name="...".
    const anchorOk = !frag || html.includes(`id="${frag}"`) || html.includes(`name="${frag}"`);
    return { url, status: res.status, moved, finalUrl: res.url, frag, anchorOk };
  } catch (e) {
    return { url, status: 0, error: e.message };
  }
}

let broken = 0;
let drifted = 0;
for (const r of results) {
  const dead = !(r.status >= 200 && r.status < 300);
  const lostAnchor = !dead && r.frag && !r.anchorOk;
  if (dead) broken++;
  if (lostAnchor || r.moved) drifted++;

  const mark = dead ? "DEAD" : lostAnchor ? "ANCHOR" : r.moved ? "MOVED" : "ok";
  if (mark === "ok") continue; // only print what needs a decision

  console.log(`${mark.padEnd(7)} ${r.url}`);
  if (r.error) console.log(`        ${r.error}`);
  if (r.status) console.log(`        HTTP ${r.status}`);
  if (r.moved) console.log(`        now redirects to ${r.finalUrl}`);
  if (lostAnchor) console.log(`        page loads, but #${r.frag} is gone — the link will land at the top`);
  for (const w of where.get(r.url)) console.log(`        used by: ${w}`);
  console.log();
}

const clean = results.length - broken - drifted;
console.log(`${clean} fine, ${drifted} drifted, ${broken} dead`);

// Every link failing means the network, not the links — a corporate proxy, a
// VPN, or an offline machine. Say so, rather than letting it read as 79 rotted
// bookmarks and sending someone off to "fix" a set that is fine.
if (broken === results.length && results.length > 1) {
  console.log(
    "\nEvery single link failed, which is almost certainly this machine's network " +
    "(proxy, VPN, or offline) rather than the bookmarks. Re-run from a connection " +
    "that can reach kubernetes.io before changing anything."
  );
  process.exit(1);
}

if (broken || drifted) {
  console.log("\nFix them in data/bookmarks.json, then `npm run build && npm run build:bookmarks`.");
  process.exit(1);
}
