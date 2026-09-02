// Per-domain mastery, time spent, and weak areas first.
// "Exam risk" = curriculum weight x (1 - mastery): where the marks you are
// most likely to lose actually live.
import { items, el, fmtDuration } from "./data.js";
import * as store from "./store.js";
import { maturity, dayKey } from "./srs.js";

const DOMAINS = [
  { id: "troubleshooting", title: "Troubleshooting", weight: 30 },
  { id: "cluster-architecture", title: "Cluster Architecture", weight: 25 },
  { id: "services-networking", title: "Services and Networking", weight: 20 },
  { id: "workloads-scheduling", title: "Workloads and Scheduling", weight: 15 },
  { id: "storage", title: "Storage", weight: 10 },
];

const mount = document.getElementById("dash");
render();
document.addEventListener("cka:progress", render);

async function render() {
  const data = await items();
  const drills = [...data.flashcards, ...data.cloze];
  const s = store.load();

  const rows = DOMAINS.map((d) => {
    const mine = drills.filter((i) => i.domain === d.id);
    const cards = mine.map((i) => store.card(i.id));
    const mastery = mine.length ? cards.reduce((a, c) => a + maturity(c), 0) / mine.length : 0;
    const seen = cards.filter((c) => c.seen > 0).length;
    const graded = cards.reduce((a, c) => a + c.seen, 0);
    const right = cards.reduce((a, c) => a + c.correct, 0);
    const tasks = data.tasks.filter((t) => t.domain === d.id);
    const attempted = tasks.filter((t) => store.taskState(t.id).attempts.length > 0).length;
    return {
      ...d,
      total: mine.length,
      seen,
      mastery,
      accuracy: graded ? right / graded : null,
      time: s.time[d.id] || 0,
      tasks: tasks.length,
      attempted,
      risk: d.weight * (1 - mastery),
    };
  });

  rows.sort((a, b) => b.risk - a.risk);

  const c = store.counts(drills);
  const totalTime = Object.values(s.time).reduce((a, b) => a + b, 0);
  const today = s.sessions.filter((x) => x.day === dayKey());
  const reviewedToday = today.reduce((a, x) => a + x.reviewed, 0);

  mount.replaceChildren();

  mount.append(el("div", { class: "grid" },
    stat(c.due, "due now"),
    stat(c.fresh, "not yet seen"),
    stat(reviewedToday, "reviewed today"),
    stat(fmtDuration(totalTime), "total study time")));

  mount.append(el("h2", {}, "Weak areas first"));
  mount.append(el("p", { class: "muted small" },
    "Ordered by exam risk — the curriculum weight of a domain multiplied by how far you still are from mastering it. " +
    "Mastery is the mean progress of every drill item toward a 21-day interval, so unseen items count as zero."));

  for (const r of rows) {
    const pct = Math.round(r.mastery * 100);
    const cls = r.mastery > 0.66 ? "good" : r.mastery < 0.33 ? "risk" : "";
    mount.append(el("div", { class: "card" },
      el("div", { class: "toolbar", style: "justify-content:space-between;margin:0 0 8px" },
        el("strong", {}, `${r.title} · ${r.weight}%`),
        el("span", { class: "small muted" }, `risk score ${r.risk.toFixed(1)}`)),
      el("div", { class: "bar" }, el("i", { class: cls, style: `width:${Math.max(pct, 1)}%` })),
      el("p", { class: "small muted", style: "margin:8px 0 10px" },
        `${pct}% mastery · ${r.seen}/${r.total} items seen · ` +
        `${r.accuracy === null ? "no grades yet" : Math.round(r.accuracy * 100) + "% correct"} · ` +
        `${r.attempted}/${r.tasks} practice tasks attempted · ${fmtDuration(r.time)} spent`),
      el("div", { class: "toolbar", style: "margin:0" },
        el("a", { class: "btn", href: `${window.CKA_BASE}tools/review/?domain=${r.id}` }, "Review"),
        el("a", { class: "btn ghost", href: `${window.CKA_BASE}tools/practice/?domain=${r.id}` }, "Practice"),
        el("a", { class: "btn ghost", href: `${window.CKA_BASE}domains/${r.id}/` }, "Read"))));
  }

  if (!s.sessions.length) {
    mount.append(el("p", { class: "muted small" },
      "No sessions recorded yet — the numbers above stay flat until you grade something."));
  }
}

function stat(value, label) {
  return el("div", { class: "stat" }, el("b", {}, String(value)), el("span", {}, label));
}
