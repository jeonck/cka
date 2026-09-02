// Export / import / reset. Progress lives only in this browser, so this page
// is the only thing standing between you and a cleared cache.
import { el } from "./data.js";
import * as store from "./store.js";

const mount = document.getElementById("datatool");
render();
document.addEventListener("cka:progress", render);

function render() {
  const s = store.load();
  const cards = Object.keys(s.cards).length;
  const tasks = Object.keys(s.tasks).length;

  mount.replaceChildren();
  mount.append(el("div", { class: "grid" },
    stat(cards, "items scheduled"),
    stat(tasks, "tasks attempted"),
    stat(s.sessions.length, "sessions logged"),
    stat(s.examDate || "—", "target exam date")));

  const status = el("p", { class: "small muted" }, "");

  mount.append(el("div", { class: "card" },
    el("h2", {}, "Export"),
    el("p", { class: "muted small" },
      "Downloads everything as JSON: SM-2 state for every item, task attempts, time per domain, and your exam date. Keep a copy — clearing site data wipes the original."),
    el("div", { class: "toolbar" },
      el("button", { class: "btn", onclick: download }, "Download progress JSON"),
      el("button", { class: "btn ghost", onclick: copy }, "Copy to clipboard"))));

  const file = el("input", { type: "file", accept: "application/json,.json" });
  mount.append(el("div", { class: "card" },
    el("h2", {}, "Import"),
    el("p", { class: "muted small" }, "Replaces everything currently stored in this browser."),
    el("div", { class: "toolbar" }, file,
      el("button", {
        class: "btn",
        onclick: async () => {
          const f = file.files?.[0];
          if (!f) { status.textContent = "Choose a file first."; return; }
          try {
            store.importJSON(await f.text());
            status.textContent = `Imported ${f.name}.`;
          } catch (e) {
            status.textContent = `Import failed: ${e.message}`;
          }
        },
      }, "Import")),
    status));

  mount.append(el("div", { class: "card" },
    el("h2", {}, "Reset"),
    el("p", { class: "muted small" }, "Deletes all progress in this browser. There is no undo — export first."),
    el("button", {
      class: "btn ghost",
      onclick: () => { if (confirm("Delete all stored progress? This cannot be undone.")) store.reset(); },
    }, "Reset all progress")));
}

function download() {
  const blob = new Blob([store.exportJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cka-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function copy() {
  try { await navigator.clipboard.writeText(store.exportJSON()); } catch (e) {}
}

function stat(v, label) {
  return el("div", { class: "stat" }, el("b", {}, String(v)), el("span", {}, label));
}
