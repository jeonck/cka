// Site chrome: theme, mobile nav, current-page marking, global keys,
// and the per-domain due counts shown on each domain page.
import { items } from "./data.js";
import { counts } from "./store.js";

const root = document.documentElement;

document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
function toggleTheme() {
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("cka.theme", next); } catch (e) {}
}

const nav = document.getElementById("sidenav");
document.getElementById("navToggle")?.addEventListener("click", (e) => {
  const open = nav.classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", String(open));
});

for (const a of document.querySelectorAll(".sidenav a")) {
  if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page");
}

// Global keys, suppressed while typing.
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.tagName === "SELECT")) return;
  if (e.key === "t") toggleTheme();
  if (e.key === "r" && !document.body.dataset.review) location.href = `${window.CKA_BASE || "/"}tools/review/`;
  if (e.key === "?") document.getElementById("keyhelp")?.toggleAttribute("open");
});

// Domain pages advertise how much is waiting for review.
const slot = document.querySelector("[data-domain-counts]");
if (slot) {
  items().then((d) => {
    const domain = slot.dataset.domainCounts;
    const drillables = [...d.flashcards, ...d.cloze];
    const c = counts(drillables, domain);
    const t = d.tasks.filter((x) => x.domain === domain).length;
    slot.textContent = `${c.due} due · ${c.fresh} new · ${c.total} drill items · ${t} practice tasks`;
  }).catch(() => {});
}
