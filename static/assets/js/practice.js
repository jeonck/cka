// Timed, scenario-based practice tasks: pick one, run the clock, then compare
// against the model solution and run the verification commands yourself.
import { items, qs, el, esc, fmtSeconds, fmtDuration } from "./data.js";
import * as store from "./store.js";

const list = document.getElementById("taskList");
const stage = document.getElementById("taskStage");
const fDomain = document.getElementById("fDomain");

let all = [];
let timer = null;
let started = 0;
let active = null;

init();

async function init() {
  all = (await items()).tasks;
  const d = qs("domain");
  if (d) fDomain.value = d;
  fDomain.addEventListener("change", renderList);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) stop(false);
  });
  renderList();
}

function renderList() {
  stage.replaceChildren();
  list.replaceChildren();
  const domain = fDomain.value;
  const shown = all.filter((t) => !domain || t.domain === domain);

  const total = shown.reduce((a, t) => a + t.targetMinutes, 0);
  list.append(el("p", { class: "muted small" },
    `${shown.length} tasks · ${total} target minutes · the real exam is roughly 120 minutes for 15–20 tasks.`));

  // Search results deep-link to a single task; mark it and scroll it into view
  // rather than starting the clock, so arriving here is never an ambush.
  const wanted = qs("task");
  for (const t of shown) {
    const st = store.taskState(t.id);
    const best = st.bestSeconds ? `best ${fmtSeconds(st.bestSeconds)}` : "not attempted";
    list.append(el("div", { class: t.id === wanted ? "card is-target" : "card", id: `task-${t.id}` },
      el("p", { class: "eyebrow" }, `${t.domain} · ${t.points} points · target ${t.targetMinutes} min · ${best}`),
      el("h3", { style: "margin:2px 0 8px" }, t.title),
      el("p", { class: "small muted" }, t.scenario.slice(0, 150) + (t.scenario.length > 150 ? "…" : "")),
      el("button", { class: "btn", onclick: () => open(t) }, "Start timed attempt")));
  }
  if (wanted) document.getElementById(`task-${wanted}`)?.scrollIntoView({ block: "center" });
}

function open(t) {
  active = t;
  started = Date.now();
  list.replaceChildren();
  stage.replaceChildren();

  const clock = el("span", { class: "timer" }, "00:00");
  const target = t.targetMinutes * 60;

  stage.append(el("div", { class: "card" },
    el("div", { class: "toolbar" },
      clock,
      el("span", { class: "muted small" }, `target ${t.targetMinutes}:00 · ${t.points} points`),
      el("button", { class: "btn", onclick: () => stop(true) }, "I'm done"),
      el("button", { class: "btn ghost", onclick: () => stop(false) }, "Give up (Esc)")),
    el("p", { class: "eyebrow" }, `${t.domain} · context: ${t.context}`),
    el("h2", { style: "margin:4px 0 10px" }, t.title),
    el("p", {}, t.scenario),
    el("p", { class: "small muted" }, `Start with: kubectl config use-context ${t.context} && kubectl config current-context`),
    hints(t)));

  timer = setInterval(() => {
    const s = (Date.now() - started) / 1000;
    clock.textContent = fmtSeconds(s);
    clock.classList.toggle("over", s > target);
  }, 250);
}

function hints(t) {
  const d = el("details", {});
  d.append(el("summary", {}, "Hints (costs you nothing but time)"));
  const ul = el("ul", {});
  for (const h of t.hints || []) ul.append(el("li", {}, h));
  d.append(ul);
  return d;
}

function stop(completed) {
  if (!active) return;
  clearInterval(timer);
  const seconds = (Date.now() - started) / 1000;
  const t = active;
  store.recordTask(t.id, t.domain, seconds, completed);
  active = null;

  const over = seconds > t.targetMinutes * 60;
  stage.replaceChildren();
  stage.append(el("div", { class: "card" },
    el("h2", {}, completed ? "Attempt recorded" : "Attempt abandoned"),
    el("p", { class: over ? "" : "muted" },
      `${fmtSeconds(seconds)} against a ${t.targetMinutes}:00 target — ${over ? "over budget. On the real exam this is where you flag and move on." : "inside budget."}`),
    el("h3", {}, "Model solution"),
    ...(t.solution || []).map((s) =>
      el("div", { class: "step" },
        el("pre", {}, el("code", {}, s.cmd)),
        el("p", { class: "why" }, s.why))),
    el("h3", {}, "Verify"),
    el("pre", {}, el("code", {}, (t.verify || []).join("\n"))),
    el("p", { class: "small muted" }, "A task is not finished until one of these comes back correct. \"It applied without an error\" is not verification."),
    t.gotcha ? el("div", { class: "callout warn" }, el("p", {}, el("strong", {}, "Gotcha: "), t.gotcha)) : null,
    el("div", { class: "toolbar" },
      el("button", { class: "btn", onclick: renderList }, "Back to tasks"))));
}
