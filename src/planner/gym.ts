/**
 * Gym sessions by weekday (pure: no React, no Supabase, no clock reads).
 *
 *   Mon, Wed, Fri  strength, A/B rotation (odd ISO week A,B,A; even B,A,B)
 *   Tue, Thu       cardio + core
 *   Sat            yoga
 *   Sun            rest (no tick needed)
 *
 * Item keys are stable names (not list positions) because exercise_logs and
 * the "Last: 10 kg" lookup refer to them. The same exercise has the same key
 * in every session (e.g. dead bugs), so its history is shared.
 */
import { WorkoutDay } from "./plan";
import { dayOfWeek, workoutFor } from "./logic";

export type SessionKind = "strength" | "cardio" | "yoga" | "rest";

export interface YogaTimer {
  /** Seconds per hold (per side for two-sided poses). */
  seconds: number;
  /** Number of holds (e.g. Chair 3 × 20 s). */
  rounds: number;
  /** 2 = do each round on the left, then the right. */
  sides: 1 | 2;
  /** Short rest between rounds. */
  restSeconds?: number;
}

export interface GymItem {
  key: string;
  name: string;
  /** Shown under the name, e.g. "3 × 8–10". */
  plan: string;
  sets?: number;
  tip?: string;
  /** Show the kg box and "Last: …". */
  weighted?: boolean;
  timer?: YogaTimer;
}

export interface GymSession {
  kind: SessionKind;
  workout: WorkoutDay | null;
  title: string;
  subtitle: string;
  items: GymItem[];
}

const DEADLIFT_TIP = "Hips back like closing a car door with your bum, flat back, weight close to your legs.";

export const STRENGTH: Record<WorkoutDay, GymItem[]> = {
  A: [
    { key: "squat", name: "Squats (goblet or barbell)", plan: "3 × 8–10", sets: 3, weighted: true },
    { key: "chest-press", name: "Dumbbell / machine chest press", plan: "3 × 10", sets: 3, weighted: true },
    { key: "db-row", name: "Dumbbell rows", plan: "3 × 10 each arm", sets: 3, weighted: true },
    { key: "hip-thrust", name: "Hip thrusts", plan: "3 × 12", sets: 3, weighted: true },
    { key: "bicep-curl", name: "Bicep curls", plan: "3 × 12", sets: 3, weighted: true },
    { key: "adductor", name: "Adductor machine / band squeeze", plan: "3 × 15", sets: 3, weighted: true },
    { key: "dead-bug", name: "Dead bugs", plan: "3 × 10", sets: 3 },
  ],
  B: [
    { key: "deadlift", name: "Deadlifts (dumbbell, kettlebell or trap bar)", plan: "3 × 8", sets: 3, weighted: true, tip: DEADLIFT_TIP },
    { key: "lat-pulldown", name: "Lat pulldown", plan: "3 × 10", sets: 3, weighted: true },
    { key: "incline-press", name: "Incline dumbbell chest press", plan: "3 × 10", sets: 3, weighted: true },
    { key: "reverse-lunge", name: "Reverse lunges", plan: "3 × 10 each leg", sets: 3, weighted: true },
    { key: "shoulder-press", name: "Shoulder press", plan: "3 × 10", sets: 3, weighted: true },
    { key: "hammer-curl", name: "Hammer curls", plan: "3 × 12", sets: 3, weighted: true },
    { key: "triceps-pushdown", name: "Triceps pushdown", plan: "3 × 12", sets: 3, weighted: true },
    { key: "plank", name: "Plank", plan: "3 × 30 s", sets: 3 },
  ],
};

export const CARDIO: GymItem[] = [
  { key: "cardio", name: "Incline walk or cycle", plan: "20–25 min · conversational pace" },
  { key: "core", name: "Core: dead bugs + plank", plan: "5 min" },
];

const t = (seconds: number, rounds = 1, sides: 1 | 2 = 1, restSeconds?: number): YogaTimer => ({ seconds, rounds, sides, restSeconds });

export const YOGA: GymItem[] = [
  { key: "yoga-cat-cow", name: "Cat-cow", plan: "1 min", timer: t(60) },
  { key: "yoga-child", name: "Child's pose", plan: "1 min", timer: t(60) },
  { key: "yoga-down-dog", name: "Downward dog", plan: "1 min", timer: t(60) },
  { key: "yoga-sun-a", name: "Sun salutation A", plan: "× 3 (about 1 min each)", timer: t(60, 3) },
  { key: "yoga-warrior-2", name: "Warrior II", plan: "30 s each side", timer: t(30, 1, 2) },
  { key: "yoga-triangle", name: "Triangle", plan: "30 s each side", timer: t(30, 1, 2) },
  { key: "yoga-chair", name: "Chair", plan: "3 × 20 s", timer: t(20, 3, 1, 10) },
  { key: "yoga-low-lunge", name: "Low lunge", plan: "45 s each side", timer: t(45, 1, 2) },
  { key: "yoga-malasana", name: "Malasana", plan: "45 s", timer: t(45) },
  { key: "yoga-butterfly", name: "Butterfly", plan: "1 min", timer: t(60) },
  { key: "yoga-wide-fold", name: "Wide-legged forward fold", plan: "1 min", timer: t(60) },
  { key: "yoga-bridge", name: "Bridge", plan: "3 × 30 s", timer: t(30, 3, 1, 10) },
  { key: "yoga-seated-fold", name: "Seated forward fold", plan: "1 min", timer: t(60) },
  { key: "yoga-twist", name: "Supine twist", plan: "45 s each side", timer: t(45, 1, 2) },
  { key: "yoga-legs-up", name: "Legs up the wall", plan: "3 min", timer: t(180) },
  { key: "yoga-savasana", name: "Savasana", plan: "3 min", timer: t(180) },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function sessionFor(date: string): GymSession {
  const dow = dayOfWeek(date);
  const w = workoutFor(date);
  if (w)
    return {
      kind: "strength",
      workout: w,
      title: w === "A" ? "Squat day" : "Deadlift day",
      subtitle: `${DAY_NAMES[dow]} · Day ${w}`,
      items: STRENGTH[w],
    };
  if (dow === 2 || dow === 4)
    return { kind: "cardio", workout: null, title: "Cardio + core", subtitle: `${DAY_NAMES[dow]} · easy effort`, items: CARDIO };
  if (dow === 6) return { kind: "yoga", workout: null, title: "Yoga", subtitle: "Saturday · slow and steady", items: YOGA };
  return { kind: "rest", workout: null, title: "Rest", subtitle: "Sunday", items: [] };
}

/** A session is complete when every item is ticked. Rest days are never "completed" (no tick needed). */
export function isSessionComplete(session: GymSession, done: (key: string) => boolean): boolean {
  return session.items.length > 0 && session.items.every((i) => done(i.key));
}

/* ------------------------------------------------------------------ */
/* Exercise logs                                                       */
/* ------------------------------------------------------------------ */

export interface ExerciseLog {
  done: boolean;
  weightKg: number | null;
  sets: number | null;
  reps: number | null;
}

/** date -> exercise_key -> log */
export type ExerciseLogs = ReadonlyMap<string, Readonly<Record<string, ExerciseLog>>>;

/** Most recent weight logged for `key` before `date`, or null. */
export function lastWeight(logs: ExerciseLogs, key: string, date: string): { date: string; weightKg: number } | null {
  let best: { date: string; weightKg: number } | null = null;
  for (const [d, byKey] of logs) {
    const w = byKey[key]?.weightKg;
    if (d < date && w != null && (!best || d > best.date)) best = { date: d, weightKg: w };
  }
  return best;
}

/** Heaviest weight logged for `key` before `date`, or null (for the NEW BEST chip). */
export function bestWeightBefore(logs: ExerciseLogs, key: string, date: string): number | null {
  let best: number | null = null;
  for (const [d, byKey] of logs) {
    const w = byKey[key]?.weightKg;
    if (d < date && w != null && (best == null || w > best)) best = w;
  }
  return best;
}

/** Parse the kg box: "", "22.5", "22,5" → number or null. Rejects nonsense. */
export function parseKg(input: string): number | null | "invalid" {
  const s = input.trim().replace(",", ".");
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return "invalid";
  const n = Number(s);
  return n > 500 ? "invalid" : n;
}

export function formatKg(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")} kg`;
}

/* ------------------------------------------------------------------ */
/* Yoga timer                                                          */
/* ------------------------------------------------------------------ */

export interface TimerSegment {
  label: string;
  seconds: number;
  rest?: boolean;
}

/** Break a timed pose into back-to-back segments; a cue plays between segments. */
export function timerSegments(timer: YogaTimer): TimerSegment[] {
  const out: TimerSegment[] = [];
  for (let r = 1; r <= timer.rounds; r++) {
    const round = timer.rounds > 1 ? `Round ${r} of ${timer.rounds}` : "";
    if (timer.sides === 2) {
      out.push({ label: [round, "Left side"].filter(Boolean).join(" · "), seconds: timer.seconds });
      out.push({ label: [round, "Switch sides: right"].filter(Boolean).join(" · "), seconds: timer.seconds });
    } else {
      out.push({ label: round || "Hold", seconds: timer.seconds });
    }
    if (timer.restSeconds && r < timer.rounds) out.push({ label: "Rest", seconds: timer.restSeconds, rest: true });
  }
  return out;
}

export function totalSeconds(timer: YogaTimer): number {
  return timerSegments(timer).reduce((a, s) => a + s.seconds, 0);
}

/** Where a timer is after `elapsed` seconds. */
export function timerState(segments: readonly TimerSegment[], elapsed: number) {
  let start = 0;
  for (let i = 0; i < segments.length; i++) {
    const end = start + segments[i].seconds;
    if (elapsed < end) return { index: i, remaining: Math.ceil(end - elapsed), finished: false };
    start = end;
  }
  return { index: segments.length - 1, remaining: 0, finished: true };
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Time zone (the planner always runs on India time)                   */
/* ------------------------------------------------------------------ */

export const TIME_ZONE = "Asia/Kolkata";

/** Calendar date and clock in a time zone, whatever the device's own zone is. */
export function clockIn(now: Date, timeZone = TIME_ZONE): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

/** "Friday 20 November" for a YYYY-MM-DD date. */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}
