// Site-wide search, as a command palette.
//
// The index at /api/search.json holds every prose section with its own anchor,
// plus the drill items, mnemonics, practice tasks and bookmarks — so one query
// answers both "where is this explained" and "have I got a card on this".
//
// It is fetched on the first open rather than on page load: nobody should pay
// 200 KB for a search they may not run.

const dialog = document.createElement("dialog");
dialog.className = "palette";
dialog.id = "siteSearch";
dialog.innerHTML = `
  <div class="palette-box">
    <input type="search" id="ssq" autocomplete="off" spellcheck="false" aria-label="Search the site"
           placeholder="Search everything — pages, drills, tasks, bookmarks">
    <p class="small muted palette-hint" id="ssHint"></p>
    <ul class="palette-results" id="ssResults" role="listbox" aria-label="Search results"></ul>
  </div>`;
document.body.append(dialog);

const input = dialog.querySelector("#ssq");
const results = dialog.querySelector("#ssResults");
const hint = dialog.querySelector("#ssHint");

const KIND = {
  section: { label: "section", weight: 3 },
  page: { label: "page", weight: 3 },
  task: { label: "task", weight: 2 },
  mnemonic: { label: "mnemonic", weight: 2 },
  bookmark: { label: "bookmark", weight: 2 },
  flashcard: { label: "card", weight: 1 },
  cloze: { label: "cloze", weight: 1 },
};

let index = null;
let loading = null;
let active = -1;

async function load() {
  if (index) return index;
  if (!loading) {
    loading = fetch(`${window.CKA_BASE || "/"}api/search.json`, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`search.json: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        // One lowercased haystack per entry, built once.
        index = d.entries.map((e) => ({ ...e, hay: `${e.title} ${e.parent || ""} ${e.text || ""}`.toLowerCase() }));
        return index;
      });
  }
  return loading;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function mark(text, terms) {
  const safe = escapeHtml(text);
  if (!terms.length) return safe;
  return safe.replace(new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi"), "<mark>$1</mark>");
}

/** Terms are ANDed; a hit in the title is worth far more than one in the body. */
function score(entry, terms) {
  const title = entry.title.toLowerCase();
  let s = KIND[entry.kind]?.weight || 1;
  for (const t of terms) {
    if (!entry.hay.includes(t)) return 0;
    if (title.includes(t)) s += 12;
    if (title.startsWith(t)) s += 6;
    s += Math.min(3, entry.hay.split(t).length - 1);
  }
  return s;
}

/** A window of body text around the first match, so the row shows why it hit. */
function snippet(entry, terms) {
  const text = (entry.text || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const at = terms.length ? text.toLowerCase().indexOf(terms[0]) : -1;
  if (at < 0) return text.slice(0, 130);
  const from = Math.max(0, at - 55);
  return (from ? "…" : "") + text.slice(from, from + 150) + (from + 150 < text.length ? "…" : "");
}

function render(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  results.replaceChildren();
  active = -1;
  if (!terms.length) {
    hint.textContent = index
      ? `${index.length} indexed: pages and sections, flashcards, cloze drills, practice tasks, mnemonics, bookmarks.`
      : "Loading the index…";
    return;
  }
  const hits = index
    .map((e) => ({ e, s: score(e, terms) }))
    .filter((h) => h.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40);

  hint.textContent = hits.length
    ? `${hits.length}${hits.length === 40 ? "+" : ""} results · ↑↓ to move, Enter to open`
    : `Nothing matches “${q}”.`;

  for (const { e } of hits) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = e.url;
    a.setAttribute("role", "option");
    if (e.external) { a.target = "_blank"; a.rel = "noopener nofollow"; }
    a.innerHTML = `<span class="palette-head">
        <span class="palette-kind">${KIND[e.kind]?.label || e.kind}</span>
        <span class="palette-title">${mark(e.title, terms)}</span>
        ${e.parent ? `<span class="palette-parent small muted">${escapeHtml(e.parent)}</span>` : ""}
        ${e.external ? '<span class="palette-parent small muted">↗</span>' : ""}
      </span>
      <span class="palette-snip small muted">${mark(snippet(e, terms), terms)}</span>`;
    li.append(a);
    results.append(li);
  }
}

function move(delta) {
  const links = [...results.querySelectorAll("a")];
  if (!links.length) return;
  links[active]?.classList.remove("is-active");
  active = (active + delta + links.length) % links.length;
  const a = links[active];
  a.classList.add("is-active");
  a.scrollIntoView({ block: "nearest" });
}

async function open() {
  if (dialog.open) return;
  dialog.showModal();
  input.focus();
  render(input.value);
  await load().catch(() => { hint.textContent = "The search index failed to load."; });
  render(input.value);
}

input.addEventListener("input", () => index && render(input.value));
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); move(1); }
  else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); move(-1); }
  else if (e.key === "Enter") {
    const a = results.querySelectorAll("a")[active < 0 ? 0 : active];
    if (a) { e.preventDefault(); a.click(); }
  }
});

// Clicking the backdrop closes; clicking a result lets the link do its work.
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
document.getElementById("searchOpen")?.addEventListener("click", open);

document.addEventListener("keydown", (e) => {
  const t = e.target;
  const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); return open(); }
  if (e.metaKey || e.ctrlKey || e.altKey || typing) return;
  // A page with its own filter keeps "/" for it; the palette is still on ⌘K.
  if (e.key === "/" && !document.body.dataset.localSlash) { e.preventDefault(); open(); }
});
