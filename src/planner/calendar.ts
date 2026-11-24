/**
 * Phase 3: progress calendar for the 13-week journey (19 Nov 2026 → 20 Feb 2027).
 * Pure functions; everything is computed from your planner data and XP.
 */
import { addDays, dayOfWeek } from "./logic";
import { DayMark, DayResult, levelInfo, Skill, SKILL_KEYS, XpEvent } from "./game";

export const JOURNEY_START = "2026-11-19";
export const JOURNEY_END = "2027-02-20";
export const JOURNEY_WEEKS = 13;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** "Week X of 13" (7-day blocks from 19 Nov; the last one runs to 20 Feb). */
export function journeyWeek(today: string): number {
  return Math.min(JOURNEY_WEEKS, Math.max(1, Math.floor(daysBetween(JOURNEY_START, today) / 7) + 1));
}

export interface JourneyWeek {
  n: number;
  start: string;
  end: string;
  /** Average % of its finished working days (rest days and today left out); null if none yet. */
  pct: number | null;
  current: boolean;
}

export function journeyWeeks(dayOn: (d: string) => DayResult, today: string): JourneyWeek[] {
  const cur = today < JOURNEY_START ? 0 : journeyWeek(today);
  return Array.from({ length: JOURNEY_WEEKS }, (_, i) => {
    const start = addDays(JOURNEY_START, 7 * i);
    const end = i === JOURNEY_WEEKS - 1 ? JOURNEY_END : addDays(start, 6);
    const pcts: number[] = [];
    // Today is still going, so only finished days count.
    for (let d = start; d <= end && d < today; d = addDays(d, 1)) {
      const r = dayOn(d);
      if (!r.rest) pcts.push(r.pct);
    }
    return { n: i + 1, start, end, pct: avg(pcts), current: i + 1 === cur };
  });
}

/** Best finished-or-current week so far. */
export function bestWeek(weeks: readonly JourneyWeek[]): JourneyWeek | null {
  return weeks.filter((w) => w.pct != null).reduce<JourneyWeek | null>((b, w) => (!b || w.pct! > b.pct! ? w : b), null);
}

/* ------------------------------------------------------------------ */
/* Month grid                                                          */
/* ------------------------------------------------------------------ */

/** "2026-12" → the days of that month, with Monday-first blanks before the 1st. */
export function monthCells(ym: string): (string | null)[] {
  const first = `${ym}-01`;
  const blanks = (dayOfWeek(first) + 6) % 7;
  const out: (string | null)[] = Array(blanks).fill(null);
  for (let d = first; d.slice(0, 7) === ym; d = addDays(d, 1)) out.push(d);
  return out;
}

export const JOURNEY_MONTHS = ["2026-11", "2026-12", "2027-01", "2027-02"];

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function monthName(ym: string): string {
  return new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type Tone = "outside" | "future" | "today" | "rest" | "gold" | "aqua" | "dim";

/** Colour of a day: ≥ 80% gold, 50–79% aqua, < 50% dim; rest days, future days and today have their own look. */
export function dayTone(date: string, today: string, r: DayResult | null): Tone {
  if (date < JOURNEY_START || date > JOURNEY_END) return "outside";
  if (date > today) return "future";
  if (date === today) return "today";
  if (!r) return "dim";
  if (r.rest) return "rest";
  return r.pct >= 80 ? "gold" : r.pct >= 50 ? "aqua" : "dim";
}

/** Average % of the month's finished working days (in the journey; today left out). */
export function monthAverage(dayOn: (d: string) => DayResult, ym: string, today: string): number | null {
  const pcts: number[] = [];
  for (const d of monthCells(ym)) {
    if (!d || d < JOURNEY_START || d >= today || d > JOURNEY_END) continue;
    const r = dayOn(d);
    if (!r.rest) pcts.push(r.pct);
  }
  return avg(pcts);
}

export function xpInMonth(events: readonly XpEvent[], ym: string): number {
  return events.reduce((s, e) => s + (e.date.slice(0, 7) === ym ? e.amount : 0), 0);
}

/** Days your player level went up (from XP by day, in order). */
export function levelUpDays(events: readonly XpEvent[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount);
  const out = new Map<string, number>();
  let total = 0;
  let level = 1;
  for (const d of [...byDate.keys()].sort()) {
    total += byDate.get(d)!;
    const now = levelInfo(total).level;
    if (now > level) out.set(d, now);
    level = Math.max(level, now);
  }
  return out;
}

export interface SkillGrowth {
  skill: Skill;
  xp: number;
  /** Levels gained in the month. */
  gain: number;
  level: number;
}

/** XP and levels gained per skill in a month (most XP first). */
export function skillGrowth(events: readonly XpEvent[], ym: string): SkillGrowth[] {
  const before = Object.fromEntries(SKILL_KEYS.map((k) => [k, 0])) as Record<Skill, number>;
  const during = { ...before };
  for (const e of events) {
    const m = e.date.slice(0, 7);
    if (m < ym) before[e.skill] += e.amount;
    else if (m === ym) during[e.skill] += e.amount;
  }
  return SKILL_KEYS.map((k) => {
    const start = levelInfo(before[k]).level;
    const end = levelInfo(before[k] + during[k]).level;
    return { skill: k, xp: during[k], gain: end - start, level: end };
  }).sort((a, b) => b.xp - a.xp);
}

const SKILL_NAME: Record<Skill, string> = { body: "Body", mind: "Mind", business: "Business", glow: "Glow", family: "Family" };

const short = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Lumi's line under the calendar: the brightest week so far and the fastest-growing skill. */
export function calendarLine(best: JourneyWeek | null, growth: readonly SkillGrowth[]): string {
  const top = growth.find((g) => g.xp > 0);
  const week = best ? `Your brightest week: ${short(best.start)}–${short(best.end)} at ${best.pct}%.` : "Your first week is just beginning.";
  return top ? `${week} ${SKILL_NAME[top.skill]} grew fastest this month!` : week;
}

/** Marks for the grid: shield used (from the streak). */
export const isShieldDay = (marks: ReadonlyMap<string, DayMark>, d: string) => marks.get(d) === "shield";
