/**
 * Phase 2c: strength and yoga levels (consistency-based), Comeback week and
 * double progression. Pure functions; levels are worked out from your gym
 * ticks and only ever go up (the highest level reached is also kept in
 * user_settings, so unticking an old session can't take a level away).
 *
 * Levels are checked every Monday on the last 4 full weeks:
 *   Strength: ≥ 10 of 12 sessions   Yoga: ≥ 3 of 4 sessions
 *   and ≥ 4 weeks at the current level. Max level 3. Never down.
 */
import { addDays, dayOfWeek } from "./logic";
import { ExerciseLogs, GymItem, GymSession, sessionFor, YogaTimer } from "./gym";

export type Track = "strength" | "yoga";
export const MAX_TRAINING_LEVEL = 3;
export const TRAINING_START = "2026-11-19";

const RULES: Record<Track, { need: number; of: number }> = {
  strength: { need: 10, of: 12 },
  yoga: { need: 3, of: 4 },
};
const WINDOW_DAYS = 28;
const MIN_DAYS_AT_LEVEL = 28;

export type Habits = ReadonlyMap<string, Readonly<Record<string, boolean>>>;

/** Was that day's session (of this kind) completed? (The gym habit is ticked when the last item is.) */
export function sessionDone(habits: Habits, date: string, track: Track): boolean {
  return !!habits.get(date)?.gym && sessionFor(date).kind === track;
}

export function sessionsBetween(habits: Habits, from: string, to: string, track: Track): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (sessionDone(habits, d, track)) n++;
  return n;
}

const nextMonday = (date: string) => addDays(date, ((8 - dayOfWeek(date)) % 7) || 7);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export interface LevelStep {
  level: number;
  /** The Monday it was reached (TRAINING_START for level 1). */
  since: string;
  /** Sessions in the 4 weeks that earned it. */
  sessions?: number;
}

export interface TrackLevel {
  level: number;
  since: string;
  history: LevelStep[];
  /** Sessions done so far in the window the next Monday check will look at. */
  window: { done: number; need: number; of: number; checkOn: string };
}

/** Level history for one track, walking each Monday from the start to `today`. */
export function trackLevel(habits: Habits, track: Track, today: string, start = TRAINING_START): TrackLevel {
  const rule = RULES[track];
  const history: LevelStep[] = [{ level: 1, since: start }];
  for (let m = nextMonday(start); m <= today; m = addDays(m, 7)) {
    const cur = history[history.length - 1];
    if (cur.level >= MAX_TRAINING_LEVEL) break;
    const n = sessionsBetween(habits, addDays(m, -WINDOW_DAYS), addDays(m, -1), track);
    if (n >= rule.need && daysBetween(cur.since, m) >= MIN_DAYS_AT_LEVEL) history.push({ level: cur.level + 1, since: m, sessions: n });
  }
  const cur = history[history.length - 1];
  // Today's check (on a Monday) has already happened above; the next one is next Monday.
  const checkOn = nextMonday(today);
  const done = sessionsBetween(habits, addDays(checkOn, -WINDOW_DAYS), today, track);
  return { level: cur.level, since: cur.since, history, window: { done, need: rule.need, of: rule.of, checkOn } };
}

/** The level that applied on `date` (for showing past days as they were). */
export function levelOn(t: TrackLevel, date: string): number {
  let lv = 1;
  for (const s of t.history) if (s.since <= date) lv = Math.max(lv, s.level);
  return lv;
}

/** Stored highest levels (user_settings.training_levels). */
export type StoredLevels = Partial<Record<Track, { level: number; since: string }>>;

export function parseStoredLevels(v: unknown): StoredLevels {
  const out: StoredLevels = {};
  if (!v || typeof v !== "object") return out;
  for (const k of ["strength", "yoga"] as Track[]) {
    const x = (v as any)[k];
    if (x && Number.isInteger(x.level) && x.level >= 1 && x.level <= MAX_TRAINING_LEVEL && typeof x.since === "string") out[k] = { level: x.level, since: x.since };
  }
  return out;
}

/** Never level down: the computed level, unless a higher one was reached before. */
export function withStored(t: TrackLevel, stored: StoredLevels[Track]): TrackLevel {
  if (!stored || stored.level <= t.level) return t;
  return { ...t, level: stored.level, since: stored.since, history: [...t.history.filter((s) => s.level < stored.level), { level: stored.level, since: stored.since }] };
}

/* ------------------------------------------------------------------ */
/* Comeback week                                                       */
/* ------------------------------------------------------------------ */

export const COMEBACK_PCT = 0.8;

/**
 * Comeback week: fewer than half the strength sessions (< 3 of 6) in the
 * two full weeks before this one. Only once two full weeks of the journey
 * have passed.
 */
export function isComebackWeek(habits: Habits, date: string, start = TRAINING_START): boolean {
  const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
  const from = addDays(monday, -14);
  const firstFullWeek = dayOfWeek(start) === 1 ? start : nextMonday(start);
  if (from < firstFullWeek) return false;
  return sessionsBetween(habits, from, addDays(monday, -1), "strength") < 3;
}

const roundHalf = (kg: number) => Math.round(kg * 2) / 2;

/* ------------------------------------------------------------------ */
/* Sessions by level                                                   */
/* ------------------------------------------------------------------ */

/** Exercises that go to 4 sets at Strength Level 3. */
export const L3_FOUR_SETS = ["squat", "deadlift", "hip-thrust", "chest-press", "lat-pulldown"];
export const L1_NOTE = "light weights, focus on form";

function fmtSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** Plan text for a timed pose, e.g. "3 × 35 s", "45 s each side". */
export function timerPlan(t: YogaTimer): string {
  const hold = fmtSeconds(t.seconds) + (t.sides === 2 ? " each side" : "");
  return t.rounds > 1 ? `${t.rounds} × ${hold}` : hold;
}

const WARRIOR_1: GymItem = { key: "yoga-warrior-1", name: "Warrior I", plan: "30 s each side", timer: { seconds: 30, rounds: 1, sides: 2 } };
const PIGEON: GymItem = { key: "yoga-pigeon", name: "Pigeon", plan: "45 s each side", timer: { seconds: 45, rounds: 1, sides: 2 } };

/** The session with your levels applied (strength sets / notes, yoga holds and poses). */
export function sessionAtLevel<S extends GymSession>(s: S, levels: { strength: number; yoga: number }): S {
  if (s.kind === "strength") {
    const lv = levels.strength;
    return {
      ...s,
      items: s.items.map((i) => {
        if (!i.weighted) return i;
        if (lv >= 3 && L3_FOUR_SETS.includes(i.key)) return { ...i, sets: 4, plan: i.plan.replace(/^\d+\s*×/, "4 ×") };
        if (lv === 1) return { ...i, plan: `${i.plan} · ${L1_NOTE}` };
        return i;
      }),
    };
  }
  if (s.kind === "yoga" && levels.yoga >= 2) {
    const lv = levels.yoga;
    const items: GymItem[] = [];
    for (const i of s.items) {
      if (!i.timer) {
        items.push(i);
        continue;
      }
      if (i.key === "yoga-sun-a") {
        const rounds = lv >= 3 ? 5 : 4;
        items.push({ ...i, plan: `× ${rounds} (about 1 min each)`, timer: { ...i.timer, rounds } });
      } else {
        const timer = { ...i.timer, seconds: i.timer.seconds + 15 };
        items.push({ ...i, plan: timerPlan(timer), timer });
      }
      if (lv >= 3 && i.key === "yoga-warrior-2") items.push(WARRIOR_1);
      if (lv >= 3 && i.key === "yoga-low-lunge") items.push(PIGEON);
    }
    return { ...s, items };
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Weight suggestions + double progression                             */
/* ------------------------------------------------------------------ */

/** "3 × 8–10" → { lo: 8, hi: 10 }; "3 × 10 each arm" → { lo: 10, hi: 10 }. */
export function repRange(plan: string): { lo: number; hi: number } | null {
  const m = /^\s*\d+\s*×\s*(\d+)(?:\s*[–-]\s*(\d+))?(.*)$/.exec(plan);
  // "3 × 30 s" is a hold, not reps
  if (!m || /^\s*(s|min)\b/.test(m[3])) return null;
  const lo = Number(m[1]);
  return { lo, hi: m[2] ? Number(m[2]) : lo };
}

/** Weight step when you're ready to progress. */
export function stepKg(key: string): number {
  if (key === "squat" || key === "deadlift") return 2.5;
  if (key === "hip-thrust" || key === "reverse-lunge" || key === "adductor") return 2;
  return 1;
}

export interface WeightSuggestion {
  kg: number;
  reps: number | null;
  why: "progress" | "same" | "comeback";
  text: string;
}

/** Last sessions (before `date`) where this exercise was done with a weight, newest first. */
function history(logs: ExerciseLogs, key: string, date: string) {
  return [...logs.entries()]
    .filter(([d, l]) => d < date && l[key]?.done && l[key]?.weightKg != null)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([d, l]) => ({ date: d, ...l[key] }));
}

/**
 * What to lift today. Comeback week (any level): ~80% of last time.
 * From Strength Level 2: same as last time, or, after two sessions in a row
 * with every set at the top of the rep range, + the step and back to the
 * bottom of the range (double progression).
 */
export function suggestWeight(logs: ExerciseLogs, item: GymItem, date: string, opts: { level: number; comeback: boolean }): WeightSuggestion | null {
  if (!item.weighted) return null;
  const h = history(logs, item.key, date);
  const last = h[0];
  if (!last || last.weightKg == null) return null;
  const range = repRange(item.plan);
  if (opts.comeback) {
    const kg = roundHalf(last.weightKg * COMEBACK_PCT);
    return { kg, reps: range?.lo ?? null, why: "comeback", text: `Comeback week: ${kg} kg (about 80% of last time)` };
  }
  if (opts.level < 2) return null;
  const prev = h[1];
  const atTop = (x: typeof last | undefined) => !!x && !!range && x.reps != null && x.reps >= range.hi;
  if (range && atTop(last) && atTop(prev) && prev!.weightKg === last.weightKg) {
    const kg = last.weightKg + stepKg(item.key);
    return { kg, reps: range.lo, why: "progress", text: `Ready to progress: ${kg} kg × ${range.lo}` };
  }
  const goal = range ? (range.hi > range.lo ? `, aim for ${range.hi} reps` : "") : "";
  return { kg: last.weightKg, reps: range?.hi ?? null, why: "same", text: `Try ${last.weightKg} kg again${goal}` };
}
