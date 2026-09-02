// Keyboard-driven review session over flashcards and cloze items,
// scheduled by the SM-2 queue in store.js.
import { items, qs, el, esc, fmtDuration } from "./data.js";
import * as store from "./store.js";
import { GRADES } from "./srs.js";
import { card } from "./store.js";

const mount = document.getElementById("review");
document.body.dataset.review = "1";

let queue = [];
let idx = 0;
let revealed = false;
let stats = { reviewed: 0, correct: 0, startedAt: Date.now(), cardStartedAt: Date.now() };
let all = null;

const controls = {
  domain: document.getElementById("fDomain"),
  type: document.getElementById("fType"),
  limit: document.getElementById("fLimit"),
  start: document.getElementById("fStart"),
};

init();

async function init() {
  all = await items();
  const d = qs("domain");
  if (d && controls.domain) controls.domain.value = d;
  controls.start.addEventListener("click", start);
  document.addEventListener("keydown", keys);
  start();
}

function pool() {
  const type = controls.type.value;
  const list = [];
  if (type !== "cloze") list.push(...all.flashcards.map((i) => ({ ...i, kind: "flashcard" })));
  if (type !== "flashcards") list.push(...all.cloze.map((i) => ({ ...i, kind: "cloze" })));
  return list;
}

function start() {
  const domain = controls.domain.value || null;
  const limit = Number(controls.limit.value) || 20;
  queue = store.dueQueue(pool(), { domain, limit });
  idx = 0;
  revealed = false;
  stats = { reviewed: 0, correct: 0, startedAt: Date.now(), cardStartedAt: Date.now() };
  render();
}

function current() {
  return queue[idx] || null;
}

function render() {
  mount.replaceChildren();
  const it = current();

  if (!it) {
    const done = stats.reviewed > 0;
    mount.append(
      el("div", { class: "card" },
        el("h2", {}, done ? "Session complete" : "Nothing due right now"),
        el("p", { class: "muted" },
          done
            ? `${stats.reviewed} reviewed · ${stats.correct} correct (${Math.round((stats.correct / stats.reviewed) * 100)}%) · ${fmtDuration((Date.now() - stats.startedAt) / 1000)}`
            : "Every item in this filter is scheduled for a later day. Widen the filter, or come back tomorrow — that spacing is the point."),
        el("div", { class: "toolbar" },
          el("button", { class: "btn", onclick: start }, "New session"),
          el("a", { class: "btn ghost", href: `${window.CKA_BASE}tools/dashboard/` }, "Dashboard"))));
    if (done) store.logSession("review", stats.reviewed, stats.correct, (Date.now() - stats.startedAt) / 1000);
    return;
  }

  const c = card(it.id);
  const body = el("div", { class: "card review-card" });

  if (it.kind === "flashcard") {
    body.append(el("p", { class: "eyebrow" }, `${it.domain} · flashcard`));
    body.append(el("p", { class: "q" }, it.front));
    if (revealed) body.append(el("div", { class: "a", html: `<p>${esc(it.back)}</p>` }));
  } else {
    body.append(el("p", { class: "eyebrow" }, `${it.domain} · cloze · ${it.lang}`));
    body.append(el("p", { class: "q" }, it.title));
    body.append(clozeBlock(it.text, revealed));
    if (revealed && it.why) body.append(el("div", { class: "a", html: `<p class="small muted">${esc(it.why)}</p>` }));
  }

  if (!revealed) {
    body.append(el("div", { class: "toolbar" },
      el("button", { class: "btn", onclick: reveal }, "Reveal"),
      el("span", { class: "small muted" }, "or press Space")));
  } else {
    const g = el("div", { class: "grades" });
    for (const gr of GRADES) {
      g.append(el("button", { class: `btn ${gr.cls}`, title: gr.hint, onclick: () => grade(gr.q) },
        `${gr.label} (${gr.key})`));
    }
    body.append(g);
  }

  mount.append(body);
  mount.append(el("p", { class: "progress-line" },
    el("span", {}, `Card ${idx + 1} of ${queue.length}`),
    el("span", {}, c.due ? `interval ${c.interval}d · ease ${c.ease.toFixed(2)} · seen ${c.seen}×` : "new item"),
    el("span", {}, `${stats.reviewed} done this session`),
    el("span", {}, "Space reveal · 1–4 grade · s skip")));
}

function clozeBlock(text, show) {
  const pre = el("pre", { class: "cloze" });
  const code = el("code");
  const re = /\[\[(.+?)\]\]/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) code.append(document.createTextNode(text.slice(last, m.index)));
    const answer = m[1];
    code.append(el("span", { class: `cloze-blank${show ? " revealed" : ""}` },
      show ? answer : " ".repeat(Math.max(3, Math.min(answer.length, 14)))));
    last = m.index + m[0].length;
  }
  code.append(document.createTextNode(text.slice(last)));
  pre.append(code);
  return pre;
}

function reveal() {
  revealed = true;
  render();
}

function grade(q) {
  const it = current();
  if (!it) return;
  store.gradeCard(it.id, q);
  store.addTime(it.domain, (Date.now() - stats.cardStartedAt) / 1000);
  stats.reviewed++;
  if (q >= 3) stats.correct++;
  idx++;
  revealed = false;
  stats.cardStartedAt = Date.now();
  render();
}

function skip() {
  idx++;
  revealed = false;
  stats.cardStartedAt = Date.now();
  render();
}

function keys(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  if (!current()) return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (!revealed) reveal();
    return;
  }
  if (e.key === "s") { e.preventDefault(); skip(); return; }
  if (revealed) {
    const g = GRADES.find((x) => x.key === e.key);
    if (g) { e.preventDefault(); grade(g.q); }
  }
}
