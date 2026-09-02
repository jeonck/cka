// All progress lives in localStorage under one key. No backend, no accounts.
// Everything is JSON-serialisable so export/import is a straight round trip.

import { newCard, schedule, dayKey, isDue } from "./srs.js";

const KEY = "cka.progress.v1";
const SCHEMA = 1;

function blank() {
  return {
    schema: SCHEMA,
    created: new Date().toISOString(),
    cards: {},      // itemId -> SM-2 card state
    tasks: {},      // taskId -> { attempts: [...], bestSeconds }
    time: {},       // domainId -> seconds studied
    sessions: [],   // { day, type, reviewed, correct, seconds }
    examDate: null,
    settings: { newPerDay: 20 },
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : blank();
  } catch (e) {
    console.warn("progress unreadable, starting fresh", e);
    state = blank();
  }
  return state;
}

function migrate(s) {
  const base = blank();
  const merged = { ...base, ...s };
  merged.settings = { ...base.settings, ...(s.settings || {}) };
  merged.schema = SCHEMA;
  return merged;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("could not persist progress", e);
  }
  document.dispatchEvent(new CustomEvent("cka:progress"));
}

export function reset() {
  state = blank();
  save();
}

/* ---------- cards ---------- */

export function card(id) {
  return load().cards[id] || newCard();
}

export function gradeCard(id, q) {
  const s = load();
  s.cards[id] = schedule(card(id), q);
  save();
  return s.cards[id];
}

export function dueQueue(items, { domain = null, includeNew = true, limit = Infinity } = {}) {
  const s = load();
  const today = dayKey();
  const pool = items.filter((i) => !domain || i.domain === domain);
  const seen = [];
  const fresh = [];
  for (const i of pool) {
    const c = s.cards[i.id];
    if (!c || !c.due) {
      if (includeNew) fresh.push(i);
    } else if (isDue(c, today)) {
      seen.push({ i, due: c.due });
    }
  }
  // Overdue first (oldest due date), then new items.
  seen.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return [...seen.map((x) => x.i), ...fresh].slice(0, limit);
}

export function counts(items, domain = null) {
  const s = load();
  const today = dayKey();
  let due = 0, fresh = 0, total = 0;
  for (const i of items) {
    if (domain && i.domain !== domain) continue;
    total++;
    const c = s.cards[i.id];
    if (!c || !c.due) fresh++;
    else if (isDue(c, today)) due++;
  }
  return { due, fresh, total };
}

/* ---------- tasks ---------- */

export function recordTask(taskId, domain, seconds, completed) {
  const s = load();
  const t = (s.tasks[taskId] = s.tasks[taskId] || { attempts: [], bestSeconds: null });
  t.attempts.push({ day: dayKey(), seconds, completed });
  if (completed && (t.bestSeconds === null || seconds < t.bestSeconds)) t.bestSeconds = seconds;
  addTime(domain, seconds);
  save();
}

export function taskState(taskId) {
  return load().tasks[taskId] || { attempts: [], bestSeconds: null };
}

/* ---------- time + sessions ---------- */

export function addTime(domain, seconds) {
  const s = load();
  if (!domain || !seconds) return;
  s.time[domain] = (s.time[domain] || 0) + Math.round(seconds);
}

export function logSession(type, reviewed, correct, seconds) {
  const s = load();
  s.sessions.push({ day: dayKey(), type, reviewed, correct, seconds: Math.round(seconds) });
  if (s.sessions.length > 500) s.sessions = s.sessions.slice(-500);
  save();
}

export function examDate(value) {
  const s = load();
  if (value === undefined) return s.examDate;
  s.examDate = value || null;
  save();
  return s.examDate;
}

export function settings(patch) {
  const s = load();
  if (patch) {
    s.settings = { ...s.settings, ...patch };
    save();
  }
  return s.settings;
}

/* ---------- portability ---------- */

export function exportJSON() {
  return JSON.stringify({ ...load(), exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !("cards" in parsed)) {
    throw new Error("That file does not look like a CKA progress export.");
  }
  state = migrate(parsed);
  save();
  return state;
}
