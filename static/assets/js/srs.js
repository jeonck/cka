// SM-2 spaced repetition.
//
// Grades: 0 = again (blackout), 3 = hard, 4 = good, 5 = easy.
// A grade below 3 resets the repetition count and schedules the item for tomorrow;
// the ease factor is adjusted on every grade and floored at 1.3, which is the
// point below which SM-2 intervals stop growing usefully.

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;
export const MATURE_DAYS = 21;

export const GRADES = [
  { q: 0, label: "Again", key: "1", cls: "g0", hint: "reset — see it tomorrow" },
  { q: 3, label: "Hard", key: "2", cls: "g3", hint: "correct, but a struggle" },
  { q: 4, label: "Good", key: "3", cls: "g4", hint: "correct" },
  { q: 5, label: "Easy", key: "4", cls: "g5", hint: "instant recall" },
];

export function newCard() {
  return { ease: DEFAULT_EASE, interval: 0, reps: 0, lapses: 0, due: null, seen: 0, correct: 0 };
}

/** Pure SM-2 step: returns the next card state. Does not mutate the input. */
export function schedule(card, q, now = new Date()) {
  const c = { ...newCard(), ...card };
  let { ease, interval, reps, lapses } = c;

  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < MIN_EASE) ease = MIN_EASE;

  if (q < 3) {
    reps = 0;
    lapses += 1;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ease);
  }

  return {
    ease: Math.round(ease * 1000) / 1000,
    interval,
    reps,
    lapses,
    due: addDays(now, interval),
    seen: c.seen + 1,
    correct: c.correct + (q >= 3 ? 1 : 0),
    lastGrade: q,
    lastReviewed: dayKey(now),
  };
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

export function dayKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function isDue(card, on = dayKey()) {
  if (!card || !card.due) return true; // never seen — always eligible
  return card.due <= on;
}

/** 0..1, how far an item is toward a mature (21-day) interval. Unseen items score 0. */
export function maturity(card) {
  if (!card || !card.interval) return 0;
  return Math.min(card.interval / MATURE_DAYS, 1);
}
