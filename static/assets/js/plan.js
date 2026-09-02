// Study plan: target exam date -> daily workload derived from what is due,
// what has never been seen, and how many days are left.
import { items, el, fmtDuration } from "./data.js";
import * as store from "./store.js";
import { dayKey, isDue } from "./srs.js";

const mount = document.getElementById("plan");
const input = document.getElementById("examDate");
const buffer = 3; // days reserved at the end for a final pass, not new material

input.value = store.examDate() || "";
input.addEventListener("change", () => {
  store.examDate(input.value);
  render();
});
render();
document.addEventListener("cka:progress", render);

async function render() {
  const data = await items();
  const drills = [...data.flashcards, ...data.cloze];
  const s = store.load();
  const today = dayKey();

  mount.replaceChildren();

  const exam = store.examDate();
  if (!exam) {
    mount.append(el("p", { class: "muted" },
      "Set a target exam date above and this becomes a daily workload instead of a pile of cards."));
  }

  const days = exam ? daysBetween(today, exam) : null;
  const unseen = drills.filter((i) => !s.cards[i.id]?.due);
  const due = drills.filter((i) => { const c = s.cards[i.id]; return c?.due && isDue(c, today); });
  const tasksLeft = data.tasks.filter((t) => store.taskState(t.id).attempts.length === 0);

  const studyDays = days === null ? null : Math.max(1, days - buffer);
  const newPerDay = studyDays ? Math.ceil(unseen.length / studyDays) : null;
  const tasksPerDay = studyDays ? Math.max(1, Math.ceil(tasksLeft.length / studyDays)) : null;

  mount.append(el("div", { class: "grid" },
    stat(days === null ? "—" : days, days === 1 ? "day to go" : "days to go"),
    stat(due.length, "due today"),
    stat(newPerDay === null ? "—" : newPerDay, "new items/day"),
    stat(unseen.length, "never seen")));

  if (days !== null && days <= 0) {
    mount.append(el("div", { class: "callout warn" },
      el("p", {}, "That date is today or in the past. Today's plan is a final pass over your weakest domain and the two all-or-nothing recipes — etcd restore and the kubeadm upgrade order.")));
    return;
  }

  mount.append(el("h2", {}, "Today"));
  const todayList = el("ul", {});
  todayList.append(el("li", {}, `Review ${due.length} due item${due.length === 1 ? "" : "s"}` +
    (newPerDay ? `, plus ${newPerDay} new one${newPerDay === 1 ? "" : "s"}` : "")));
  if (tasksPerDay) todayList.append(el("li", {}, `${tasksPerDay} timed practice task${tasksPerDay === 1 ? "" : "s"} — always against the clock`));
  todayList.append(el("li", {}, "One deliberate breakage in your own lab: stop a kubelet, corrupt a static Pod manifest, or point etcd at an empty directory, then fix it."));
  mount.append(todayList);

  const est = Math.round((due.length + (newPerDay || 0)) * 0.5 + (tasksPerDay || 0) * 8);
  mount.append(el("p", { class: "muted small" },
    `Rough estimate: ${est} minutes, assuming ~30 seconds per drill item and ~8 minutes per timed task including the review of the model solution.`));

  mount.append(el("div", { class: "toolbar" },
    el("a", { class: "btn", href: `${window.CKA_BASE}tools/review/` }, "Start today's review"),
    el("a", { class: "btn ghost", href: `${window.CKA_BASE}tools/practice/` }, "Practice tasks")));

  if (studyDays) {
    mount.append(el("h2", {}, "The shape of the run-up"));
    mount.append(el("p", { class: "muted small" },
      `${unseen.length} items you have never seen, spread over ${studyDays} study days, leaves ${buffer} days at the end for review only — no new material in the last stretch, because an item introduced two days before the exam has not been spaced at all.`));

    const weeks = Math.ceil(days / 7);
    const rows = [];
    for (let w = 0; w < Math.min(weeks, 8); w++) {
      const from = w * 7;
      const introducing = Math.max(0, Math.min(unseen.length - from * newPerDay, newPerDay * 7));
      rows.push(el("tr", {},
        el("td", {}, `Week ${w + 1}`),
        el("td", {}, from >= studyDays ? "review only" : `${introducing} new items`),
        el("td", {}, w >= weeks - 1 ? "final pass: weakest domain + the two recipes" : "daily reviews + timed tasks")));
    }
    const table = el("table", {},
      el("thead", {}, el("tr", {}, el("th", {}, "When"), el("th", {}, "New material"), el("th", {}, "Focus"))),
      el("tbody", {}, ...rows));
    const wrap = el("div", { class: "prose" });
    wrap.append(table);
    mount.append(wrap);
  }
}

function stat(v, label) {
  return el("div", { class: "stat" }, el("b", {}, String(v)), el("span", {}, label));
}

function daysBetween(a, b) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}
