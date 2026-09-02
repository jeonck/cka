// Build the one-book reference PDF from the same markdown and JSON the site uses.
// Nothing here is hand-edited: run `npm run build:pdf` and it regenerates.
//
// Rendering goes through headless Chromium (Playwright) rather than a LaTeX
// toolchain, so the PDF inherits the same markdown-it output as the site and
// the build works on a clean CI runner.

import { chromium } from "playwright";
import markdownIt from "markdown-it";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromiumExecutable } from "./chromium.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}dist/cka-reference.pdf`;
const md = markdownIt({ html: true, linkify: false });

const read = (p) => readFileSync(root + p, "utf8");
const json = (p) => JSON.parse(read(p)).items;

/** Strip YAML front matter and return { data, body }. */
function split(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { data, body: src.slice(m[0].length) };
}

function section(path, { title = null, appendix = false } = {}) {
  const { data, body } = split(read(path));
  return `<section class="chapter${appendix ? " appendix" : ""}">
    ${title || data.title ? `<p class="chapter-label">${title || data.title}</p>` : ""}
    ${md.render(body)}
  </section>`;
}

function mnemonicsSection() {
  const items = json("data/mnemonics.json");
  const domains = [...new Set(items.map((i) => i.domain))];
  const blocks = domains
    .map((d) => {
      const mine = items.filter((i) => i.domain === d);
      return `<h2>${d.replace(/-/g, " ")}</h2>` + mine
        .map(
          (m) => `<div class="mnemonic">
            <h3>${m.title}</h3>
            <p class="hook">${md.renderInline(m.mnemonic)}</p>
            <table>${m.sequence
              .map((s) => `<tr><th>${s.key}</th><td><code>${escapeHtml(s.text)}</code></td></tr>`)
              .join("")}</table>
            <p class="why"><em>Why:</em> ${md.renderInline(m.why)}</p>
          </div>`
        )
        .join("");
    })
    .join("");
  return `<section class="chapter mnemonics"><p class="chapter-label">Mnemonics</p><h1>Mnemonics</h1>
    <p class="lede">Ordering and exact sets — the material that fails under time pressure for reasons other than
    comprehension. Generated from <code>data/mnemonics.json</code>.</p>${blocks}</section>`;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const built = new Date().toISOString().slice(0, 10);

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>CKA One-Book Reference</title>
<style>
  @page { size: A4; margin: 13mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 9.4pt/1.42 "DejaVu Sans", "Helvetica Neue", Arial, sans-serif; color: #14181d; margin: 0; }
  code, pre { font-family: "DejaVu Sans Mono", Menlo, Consolas, monospace; }
  h1 { font-size: 17pt; letter-spacing: -0.02em; margin: 0 0 6pt; }
  h2 { font-size: 11.5pt; margin: 14pt 0 4pt; padding-bottom: 2pt; border-bottom: 0.6pt solid #c8cfd7;
       break-after: avoid; }
  .mnemonics h2 { text-transform: capitalize; }
  h3 { font-size: 9.8pt; margin: 9pt 0 3pt; break-after: avoid; }
  p, li { margin: 3pt 0; orphans: 3; widows: 3; }
  ul, ol { padding-left: 13pt; margin: 3pt 0; }
  a { color: #14181d; text-decoration: none; }
  pre { background: #f2f4f7; border: 0.5pt solid #d5dbe2; border-radius: 3pt; padding: 4pt 6pt;
        margin: 4pt 0; font-size: 7.7pt; line-height: 1.35; white-space: pre-wrap; word-break: break-word;
        break-inside: avoid; }
  code { background: #f2f4f7; padding: 0 2pt; border-radius: 2pt; font-size: 8.2pt; }
  pre code { background: none; padding: 0; font-size: inherit; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0; font-size: 8.3pt; break-inside: avoid; }
  th, td { border-bottom: 0.5pt solid #dde2e8; padding: 2pt 5pt; text-align: left; vertical-align: top; }
  th { color: #4a5563; font-weight: 600; }
  em { color: #43505e; }
  blockquote { margin: 5pt 0; padding-left: 8pt; border-left: 2pt solid #d5dbe2; color: #43505e; }
  hr { display: none; }
  .callout { background: #f7f9fb; border-left: 2pt solid #2f6fd0; padding: 1pt 8pt; margin: 5pt 0; break-inside: avoid; }
  .callout.warn { border-left-color: #b8860b; }
  .chapter { break-before: page; }
  .chapter-label { text-transform: uppercase; letter-spacing: 0.14em; font-size: 7pt; color: #6b7684; margin: 0 0 2pt; }
  .lede { color: #43505e; }
  .mnemonic { break-inside: avoid; margin: 7pt 0; }
  .mnemonic .hook { font-weight: 700; margin: 1pt 0 3pt; }
  .mnemonic .why { font-size: 8.2pt; color: #43505e; margin: 2pt 0 0; }
  .mnemonic th { white-space: nowrap; font-family: "DejaVu Sans Mono", monospace; font-size: 7.6pt; }
  .cover { height: 252mm; display: flex; flex-direction: column; justify-content: center; }
  .cover h1 { font-size: 30pt; line-height: 1.05; margin-bottom: 10pt; }
  .cover .sub { font-size: 11pt; color: #43505e; max-width: 120mm; }
  .cover .meta { margin-top: 22pt; font-size: 8.5pt; color: #6b7684; }
  .cover .weights { display: flex; gap: 2pt; height: 9mm; margin: 16pt 0 4pt; }
  .cover .weights span { flex-basis: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #2f6fd0;
      color: #fff; font-size: 8pt; font-weight: 700; border-radius: 2pt; }
  .toc { break-after: page; }
  .toc ol { font-size: 9pt; }
  .header-anchor { display: none; }
</style></head>
<body>

<section class="cover">
  <p class="chapter-label">Condensed reference · generated ${built}</p>
  <h1>CKA One-Book Reference</h1>
  <p class="sub">Decision trees, the imperative commands worth memorising, mnemonics for what must be recalled cold,
  and the flags that cost minutes when you have to look them up.</p>
  <div class="weights">
    <span style="flex:30">Troubleshooting 30%</span>
    <span style="flex:25">Cluster Architecture 25%</span>
    <span style="flex:20">Services &amp; Networking 20%</span>
    <span style="flex:15">Workloads 15%</span>
    <span style="flex:10">Storage 10%</span>
  </div>
  <p class="meta">
    CNCF curriculum v1.35 · fetched 2026-09-02 · exam is 120 minutes, ~17 performance-based tasks, 66% to pass.<br>
    Generated from the site's markdown and JSON sources — do not edit this PDF, edit the source and rebuild.<br>
    Contains no exam content. Every practice scenario is original, inferred from published curriculum weights and
    public community retrospectives.
  </p>
</section>

<section class="toc chapter">
  <p class="chapter-label">Contents</p>
  <h1>Contents</h1>
  <ol>
    <li>Command cheat sheet — setup, generation, inspection, lifecycle, etcd, Helm</li>
    <li>Mnemonics — ordering and exact sets</li>
    <li>Troubleshooting (30%) — symptom decision trees</li>
    <li>Cluster Architecture (25%) — RBAC, etcd, kubeadm, HA, Helm/Kustomize, CRDs</li>
    <li>Services and Networking (20%) — Services, NetworkPolicy, DNS, Ingress, Gateway API</li>
    <li>Workloads and Scheduling (15%) — rollouts, config, autoscaling, scheduling</li>
    <li>Storage (10%) — binding, StorageClasses, access modes, reclaim policies</li>
    <li>Exam strategy — the seven-minute budget and the verification habit</li>
    <li>Appendix: curriculum v1.35, verbatim</li>
  </ol>
</section>

${section("content/reference/cheatsheet.md")}
${mnemonicsSection()}
${section("content/domains/troubleshooting.md")}
${section("content/domains/cluster-architecture.md")}
${section("content/domains/services-networking.md")}
${section("content/domains/workloads-scheduling.md")}
${section("content/domains/storage.md")}
${section("content/reference/exam-strategy.md")}
${section("docs/curriculum.md", { appendix: true })}

</body></html>`;

if (!existsSync(`${root}dist`)) mkdirSync(`${root}dist`, { recursive: true });

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `<div style="width:100%;font:7pt 'DejaVu Sans',Arial,sans-serif;color:#8a939e;
      padding:0 12mm;display:flex;justify-content:space-between;">
      <span>CKA One-Book Reference · curriculum v1.35 · generated ${built}</span>
      <span class="pageNumber"></span></div>`,
  margin: { top: "13mm", bottom: "16mm", left: "12mm", right: "12mm" },
});
await browser.close();

const { size } = await import("node:fs").then((fs) => fs.statSync(out));
console.log(`wrote ${out} (${Math.round(size / 1024)} KB)`);
