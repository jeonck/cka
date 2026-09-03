// Generates the importable Chrome/Firefox bookmark file from data/bookmarks.json,
// in the Netscape bookmark format every browser still reads. Written to
// public/cka-bookmarks.html so the site can serve it, next to the PDF.
//
// Run with: npm run build:bookmarks   (after npm run build)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(readFileSync(`${root}data/bookmarks.json`, "utf8"));
const out = `${root}public/cka-bookmarks.html`;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Browsers store bookmark timestamps as seconds since the epoch. One value for
// the whole file keeps the folders in the order we wrote them.
const now = Math.floor(Date.now() / 1000);

const lines = [
  "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
  "<!-- Generated from data/bookmarks.json by scripts/build-bookmarks.mjs.",
  "     Every URL is inside the documentation the CKA permits; see the allowed list in that file.",
  "     Do not edit by hand — the site page and this file are built from the same source. -->",
  '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
  "<TITLE>Bookmarks</TITLE>",
  "<H1>Bookmarks</H1>",
  "<DL><p>",
  `    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>`,
  "    <DL><p>",
  `        <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">CKA</H3>`,
  "        <DL><p>",
];

for (const folder of data.folders) {
  lines.push(`            <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${esc(folder.name)}</H3>`);
  lines.push("            <DL><p>");
  for (const item of folder.items) {
    lines.push(`                <DT><A HREF="${esc(item.url)}" ADD_DATE="${now}">${esc(item.title)}</A>`);
    if (item.when) lines.push(`                <DD>${esc(item.when)}`);
  }
  lines.push("            </DL><p>");
}

lines.push("        </DL><p>", "    </DL><p>", "</DL><p>", "");

if (!existsSync(`${root}public`)) mkdirSync(`${root}public`, { recursive: true });
writeFileSync(out, lines.join("\n"), "utf8");

const count = data.folders.reduce((a, f) => a + f.items.length, 0);
console.log(`bookmarks written — ${count} bookmarks in ${data.folders.length} folders → public/cka-bookmarks.html`);
