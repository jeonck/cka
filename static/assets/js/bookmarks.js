// Filter the exam bookmark set by symptom.
//
// This is the drill the page is for: you type what the task said — "PVC
// pending", "no endpoints", "rollback" — and see which page answers it. So the
// haystack is the whole row, and the `when` column (the symptom) matters more
// than the doc's title.
//
// The toolbar is built here rather than in the template: with JavaScript off
// the page stays the complete list instead of showing a search box that does
// nothing.

const list = document.getElementById("bookmarkList");
if (list) {
  const rows = [...list.querySelectorAll("tr.bm-row")].map((tr) => ({
    tr,
    folder: tr.closest(".bm-folder"),
    // Cells are re-rendered on every keystroke, so keep the pristine markup.
    cells: [...tr.cells].map((td) => ({ td, html: td.innerHTML })),
    hay: `${tr.textContent} ${tr.querySelector("a")?.getAttribute("href") || ""}`.toLowerCase(),
  }));
  const folders = [...list.querySelectorAll(".bm-folder")];

  const bar = document.createElement("div");
  bar.className = "toolbar bm-search";
  bar.innerHTML = `
    <input type="search" id="bmq" autocomplete="off" spellcheck="false" aria-label="Filter bookmarks"
           placeholder="Filter by symptom — try &quot;PVC pending&quot;, &quot;no endpoints&quot;, &quot;rollback&quot;, &quot;etcd&quot;">
    <span class="small muted" id="bmCount" role="status" aria-live="polite"></span>
    <span class="small muted">Press <kbd>/</kbd> to search, <kbd>Esc</kbd> to clear.</span>`;
  list.parentNode.insertBefore(bar, list);

  const empty = document.createElement("p");
  empty.className = "small muted bm-empty";
  empty.hidden = true;
  list.parentNode.insertBefore(empty, list.nextSibling);

  const input = bar.querySelector("#bmq");
  const count = bar.querySelector("#bmCount");
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** Wrap every occurrence of `terms` in the cell's text nodes with <mark>. */
  function highlight(td, terms) {
    if (!terms.length) return;
    const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi");
    const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const node of texts) {
      if (!re.test(node.nodeValue)) continue;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of node.nodeValue.matchAll(re)) {
        frag.append(node.nodeValue.slice(last, m.index));
        const mark = document.createElement("mark");
        mark.textContent = m[0];
        frag.append(mark);
        last = m.index + m[0].length;
      }
      frag.append(node.nodeValue.slice(last));
      node.replaceWith(frag);
    }
  }

  function apply(q) {
    // Space-separated terms all have to match, so "pvc pending" narrows rather
    // than widening the way a single OR'd phrase would.
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      const hit = terms.every((t) => row.hay.includes(t));
      row.tr.hidden = !hit;
      for (const c of row.cells) c.td.innerHTML = c.html;
      if (hit) {
        shown++;
        highlight(row.cells[0].td, terms);
        highlight(row.cells[1].td, terms);
      }
    }
    for (const f of folders) f.hidden = !f.querySelector("tr.bm-row:not([hidden])");
    count.textContent = terms.length ? `${shown} of ${rows.length}` : `${rows.length} links`;
    empty.hidden = shown > 0 || !terms.length;
    empty.textContent = shown
      ? ""
      : `Nothing matches “${q}”. The set is deliberately small — if a page is missing here, `
        + `it is because kubectl explain answers it faster than the page loads.`;

    // Keep the query in the URL so a filtered view can be shared or reopened.
    const url = new URL(location.href);
    if (terms.length) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  }

  input.addEventListener("input", () => apply(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    input.value = "";
    apply("");
    input.blur();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  input.value = new URL(location.href).searchParams.get("q") || "";
  apply(input.value);
}
