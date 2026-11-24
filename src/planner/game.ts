/**
 * The game (Phase 2a): XP, player level, five skills, forgiving streaks.
 *
 * XP is worked out from what you actually did (tasks, habits, workouts,
 * water, the evening review, personal bests) and written to xp_events, a
 * table rows are only ever added to. `earnedXp` says what you have earned
 * right now; `reconcileXp` turns the difference with what's stored into new
 * rows (a minus row when something is unticked). That one path covers the
 * backfill from 19 Nov, normal ticks, unticks and two phones at once.
 *
 * Levels and streaks are computed, never stored.
 */
import { addDays, Completions, DayLists, dayProgress, PlanTask } from "./logic";
import { Block, GYM_HABIT, HABITS } from "./plan";
import { ExerciseLogs, sessionFor } from "./gym";
import { Boss, GermanLesson, questXp } from "./quests";
import { MealLog, mealXp } from "./meals";
import { CareData, careXp } from "./care";

export type Skill = "body" | "mind" | "business" | "glow" | "family";

export interface SkillInfo {
  key: Skill;
  name: string;
  island: string;
  /** Planner screen the island opens. */
  path: string;
}

export const SKILLS: SkillInfo[] = [
  { key: "body", name: "Body", island: "Crystal Mountains", path: "/planner/gym" },
  { key: "mind", name: "Mind", island: "Library of Stars", path: "/planner/study" },
  { key: "business", name: "Business", island: "Market Square", path: "/planner/deep" },
  { key: "glow", name: "Glow", island: "Moonlit Garden", path: "/planner/habits" },
  { key: "family", name: "Family", island: "Riverside Cottage", path: "/planner/habits" },
];
export const SKILL_KEYS = SKILLS.map((s) => s.key);
export const isSkill = (v: unknown): v is Skill => SKILL_KEYS.includes(v as Skill);

/** XP is counted from this day (the start of the 13-week journey). */
export const GAME_START = "2026-11-19";

export const XP = {
  task: 10,
  strength: 30,
  yoga: 25,
  cardio: 20,
  habit: 5,
  water: 10,
  review: 10,
  pb: 15,
} as const;

export const BLOCK_SKILL: Record<Block, Skill> = { deep: "business", study: "mind" };

/** The skill each habit trains. The gym habit isn't here: the workout itself earns the XP. */
export const HABIT_SKILL: Record<string, Skill> = {
  walk: "family", // with Dad
  steps: "body",
  walkLunch: "body",
  walkDinner: "body",
  skinAM: "glow",
  skinPM: "glow",
  protein: "glow",
  phone: "glow",
  teach: "family",
  read: "mind",
};

/** Something that earns XP right now. */
export interface Earned {
  source: string;
  skill: Skill;
  amount: number;
  date: string;
  reason: string;
}

/** A stored xp_events row. */
export interface XpEvent extends Earned {
  eventKey: string;
}

export interface GameData extends CareData {
  tasks: readonly PlanTask[];
  done: Completions;
  days: ReadonlyMap<string, { lists: DayLists; fromAi: boolean }>;
  habits: ReadonlyMap<string, Readonly<Record<string, boolean>>>;
  water: ReadonlyMap<string, number>;
  exercises: ExerciseLogs;
  /** Nicos Weg lessons done (Phase 2b). */
  german?: readonly GermanLesson[];
  /** Boss battles (Phase 2b). */
  bosses?: readonly Boss[];
  /** The Monday Strength Level 2 was reached (Phase 2c), for the boss battle. */
  strengthL2On?: string | null;
  /** Meals you logged (Phase 3b). */
  meals?: readonly MealLog[];
}

const inRange = (date: string, today: string) => date >= GAME_START && date <= today;
const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Everything that earns XP from GAME_START to `today`. */
export function earnedXp(d: GameData, today: string, waterGoalOn: (date: string) => number): Earned[] {
  const out: Earned[] = [];
  const byId = new Map(d.tasks.map((t) => [t.id, t] as const));

  for (const [taskId, date] of d.done) {
    const t = byId.get(taskId);
    if (!t || !inRange(date, today)) continue;
    out.push({ source: `task:${taskId}`, skill: BLOCK_SKILL[t.block], amount: XP.task, date, reason: clip(`Task: ${t.text}`) });
  }

  for (const [date, ticks] of d.habits) {
    if (!inRange(date, today)) continue;
    for (const h of HABITS) {
      const skill = HABIT_SKILL[h.key];
      if (skill && ticks[h.key]) out.push({ source: `habit:${date}:${h.key}`, skill, amount: XP.habit, date, reason: clip(`Habit: ${h.label}`) });
    }
    // The gym habit is ticked when the last exercise of the day's session is.
    if (ticks[GYM_HABIT]) {
      const kind = sessionFor(date).kind;
      if (kind !== "rest")
        out.push({ source: `workout:${date}`, skill: "body", amount: XP[kind], date, reason: `${kind[0].toUpperCase()}${kind.slice(1)} workout` });
    }
  }

  for (const [date, ml] of d.water) {
    if (inRange(date, today) && ml >= waterGoalOn(date))
      out.push({ source: `water:${date}`, skill: "glow", amount: XP.water, date, reason: "Water goal reached" });
  }

  // A list approved in the evening review is saved as the next day, marked from_ai.
  for (const [date, rec] of d.days) {
    const reviewed = addDays(date, -1);
    if (rec.fromAi && inRange(reviewed, today))
      out.push({ source: `review:${reviewed}`, skill: "mind", amount: XP.review, date: reviewed, reason: "Evening review approved" });
  }

  // Personal best: heavier than anything logged for that exercise before.
  const best = new Map<string, number>();
  for (const date of [...d.exercises.keys()].sort()) {
    const logs = d.exercises.get(date)!;
    for (const [key, log] of Object.entries(logs)) {
      const w = log.weightKg;
      if (w == null) continue;
      const prev = best.get(key);
      if (prev != null && w > prev && inRange(date, today))
        out.push({ source: `pb:${date}:${key}`, skill: "body", amount: XP.pb, date, reason: `New best: ${w} kg` });
      if (prev == null || w > prev) best.set(key, w);
    }
  }
  // Daily / weekly quests, Nicos Weg lessons, beaten bosses.
  out.push(...questXp(d, today, (date) => inRange(date, today)));
  out.push(...mealXp(d.meals ?? [], (date) => inRange(date, today)));
  out.push(...careXp(d, (date) => inRange(date, today)));
  return out;
}

/**
 * New rows that make the stored events match what's earned now.
 * Each source's rows are numbered (#0 earn, #1 untick, #2 earn again, …), and
 * the number is part of the unique key, so two phones writing the same change
 * produce the same key and the database keeps one.
 */
export function reconcileXp(earned: readonly Earned[], events: readonly XpEvent[]): XpEvent[] {
  const net = new Map<string, { sum: number; count: number; last: XpEvent }>();
  for (const e of events) {
    const n = net.get(e.source) ?? { sum: 0, count: 0, last: e };
    net.set(e.source, { sum: n.sum + e.amount, count: n.count + 1, last: e });
  }
  const out: XpEvent[] = [];
  const now = new Set<string>();
  for (const e of earned) {
    if (now.has(e.source)) continue;
    now.add(e.source);
    const n = net.get(e.source);
    if (!n || n.sum <= 0) out.push({ ...e, amount: e.amount - (n?.sum ?? 0), eventKey: `${e.source}#${n?.count ?? 0}` });
  }
  for (const [source, n] of net) {
    if (n.sum > 0 && !now.has(source))
      out.push({ source, skill: n.last.skill, amount: -n.sum, date: n.last.date, reason: clip(`Unticked: ${n.last.reason}`), eventKey: `${source}#${n.count}` });
  }
  return out.filter((e) => e.amount !== 0);
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/** Level n needs 100 × n XP to reach level n + 1. */
export const xpForLevel = (n: number) => 100 * n;

/** Total XP needed to reach `level` (level 1 = 0). */
export const totalXpFor = (level: number) => (100 * (level - 1) * level) / 2;

export function titleFor(level: number): string {
  if (level >= 15) return "Guardian of the Kingdom";
  if (level >= 10) return "Starkeeper";
  if (level >= 5) return "Dreamweaver";
  return "Apprentice";
}

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  /** XP earned inside this level, and needed for the next one. */
  into: number;
  needed: number;
  pct: number;
}

export function levelInfo(xp: number): LevelInfo {
  const total = Math.max(0, xp);
  let level = 1;
  while (total >= totalXpFor(level + 1)) level++;
  const into = total - totalXpFor(level);
  const needed = xpForLevel(level);
  return { level, title: titleFor(level), xp: total, into, needed, pct: Math.floor((into / needed) * 100) };
}

export function xpTotals(events: readonly XpEvent[]): { total: number; bySkill: Record<Skill, number>; byDate: Map<string, number> } {
  const bySkill = { body: 0, mind: 0, business: 0, glow: 0, family: 0 } as Record<Skill, number>;
  const byDate = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    total += e.amount;
    bySkill[e.skill] += e.amount;
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount);
  }
  return { total, bySkill, byDate };
}

/* ------------------------------------------------------------------ */
/* Streaks that forgive                                                */
/* ------------------------------------------------------------------ */

/** A day counts towards the streak at this % of its tasks + habits (+ water). */
export const STREAK_DAY_PCT = 60;
export const SHIELD_EVERY = 7;
export const MAX_SHIELDS = 3;

export type DayMark = "good" | "grace" | "shield" | "miss" | "rest";

export interface StreakInfo {
  /** Good days in the current streak. */
  current: number;
  best: number;
  shields: number;
  /** How each finished day (and today, once it counts) went. */
  marks: Map<string, DayMark>;
  /** The last non-rest day was the one forgiven miss: missing today too would break the streak (unless a shield saves it). */
  atRisk: boolean;
}

export interface DayResult {
  pct: number;
  rest: boolean;
}

/**
 * Walk the days from GAME_START. Rest days (Sundays, rest / sick days) are
 * skipped: they neither break nor extend the streak. Otherwise a day is good
 * at >= 60%. One missed day is forgiven; a second miss in a row (rest days in
 * between don't count) uses a shield if there is one, otherwise the streak
 * breaks. Every 7 good days in a streak earn a shield (max 3).
 * Today only counts once it is good or rest (it can't be a miss until it's over).
 */
export function streakInfo(dayOn: (date: string) => DayResult, today: string, start = GAME_START): StreakInfo {
  const marks = new Map<string, DayMark>();
  let current = 0;
  let best = 0;
  let shields = 0;
  let missRun = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const day = dayOn(d);
    if (day.rest) {
      marks.set(d, "rest");
      continue;
    }
    const good = day.pct >= STREAK_DAY_PCT;
    if (d === today && !good) break;
    if (good) {
      current++;
      missRun = 0;
      if (current % SHIELD_EVERY === 0) shields = Math.min(MAX_SHIELDS, shields + 1);
      marks.set(d, "good");
    } else if (current > 0 && missRun === 0) {
      missRun = 1;
      marks.set(d, "grace");
    } else if (current > 0 && shields > 0) {
      shields--;
      marks.set(d, "shield");
    } else {
      current = 0;
      missRun = 0;
      marks.set(d, "miss");
    }
    best = Math.max(best, current);
  }
  let last = addDays(today, -1);
  while (marks.get(last) === "rest") last = addDays(last, -1);
  return { current, best, shields, marks, atRisk: marks.get(last) === "grace" && !marks.has(today) };
}

/** A day's % and whether it's a rest day, from the planner data (a working day without a list counts as 0%). */
export function dayResult(d: GameData, date: string, waterGoalMl: number): DayResult {
  const rec = d.days.get(date);
  const habits = d.habits.get(date) ?? {};
  const lists = rec?.lists ?? { deep: [], study: [] };
  const p = dayProgress({ lists, done: d.done, habits, water: d.water.get(date) ?? 0, waterGoalMl, date });
  return { pct: rec || p.rest ? p.pct : 0, rest: p.rest };
}

/** Ticks still needed today for it to count (0 when it already does). */
export function ticksToCount(done: number, total: number): number {
  return Math.max(0, Math.ceil((STREAK_DAY_PCT / 100) * total) - done);
}

/* ------------------------------------------------------------------ */
/* Lumi on the kingdom                                                 */
/* ------------------------------------------------------------------ */

export function kingdomLine(args: {
  level: LevelInfo;
  /** Today is a rest day (Sunday, or marked rest / sick). */
  rest?: boolean;
  streak: StreakInfo;
  ticksLeft: number;
  /** Lumi's usual line for this time of day (screens.tsx). */
  fallback: string;
}): string {
  const { level, streak, ticksLeft } = args;
  const toNext = level.needed - level.into;
  if (args.rest) return "Rest day. Water, skincare and two short walks are plenty. Your streak is safe.";
  if (streak.atRisk && ticksLeft > 0)
    return `Yesterday slipped, and that's okay. ${ticksLeft} more tick${ticksLeft > 1 ? "s" : ""} today keeps your ${streak.current}-day streak glowing.`;
  if (toNext <= 30) return `Only ${toNext} XP until Level ${level.level + 1}. The kingdom is holding its breath ✨`;
  if (ticksLeft > 0 && ticksLeft <= 3) return `${ticksLeft} more tick${ticksLeft > 1 ? "s" : ""} and today counts for your streak.`;
  return args.fallback;
}
