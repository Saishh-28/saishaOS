/**
 * Water, made frictionless (pure: no React, no Supabase).
 *
 * - Everything is in millilitres (health_logs metric `water_ml`, shared with Sanctuary).
 * - One tap = "finished a bottle" (your bottle size) or "+250 ml glass"; other drinks count too.
 * - Anchor quests tie a glass to things you already do. Each ticked anchor adds 250 ml,
 *   unless its "from my bottle" toggle is on (then it's only a check-off, so a glass
 *   from the bottle isn't counted twice). Refill anchors are always check-offs.
 * - Gradual goal: 1.25 L/day, +0.25 L after each week with ≥5 days at the goal, up to 2 L.
 *   Never goes down, never shames.
 */
import { addDays, dayOfWeek } from "./logic";

export const GLASS_ML = 250;
export const DEFAULT_BOTTLE_ML = 1000;
export const BOTTLE_MIN_ML = 250;
export const BOTTLE_MAX_ML = 2000;
/** Upper bound for one day's total (typo guard). */
export const DAY_MAX_ML = 6000;

export const GOAL_START_ML = 1250;
export const GOAL_STEP_ML = 250;
export const GOAL_MAX_ML = 2000;
export const GOAL_DAYS_NEEDED = 5;

export interface Drink {
  key: string;
  label: string;
  ml: number;
}

/** Quick buttons for drinks that aren't plain water. */
export const DRINKS: Drink[] = [
  { key: "chaas", label: "Buttermilk / chaas", ml: 250 },
  { key: "coconut", label: "Coconut water", ml: 250 },
  { key: "nimbu", label: "Nimbu pani (unsweetened)", ml: 250 },
  { key: "tea", label: "Herbal tea", ml: 200 },
  { key: "soup", label: "Soup", ml: 250 },
];

export interface Anchor {
  /** habit_logs.habit_key */
  key: string;
  label: string;
  /** ml added when ticked (0 = check-off only, e.g. refilling the bottle). */
  ml: number;
}

export const ANCHORS: Anchor[] = [
  { key: "water-wake", label: "Glass of water right after waking (before phone)", ml: GLASS_ML },
  { key: "water-breakfast", label: "Glass before breakfast", ml: GLASS_ML },
  { key: "water-refill-1", label: "Refill bottle: start of deep work 1", ml: 0 },
  { key: "water-walk", label: "Glass after the walk with Dad", ml: GLASS_ML },
  { key: "water-refill-2", label: "Refill bottle: start of deep work 2", ml: 0 },
  { key: "water-lunch", label: "Glass before lunch", ml: GLASS_ML },
  { key: "water-dinner", label: "Glass before dinner", ml: GLASS_ML },
];

/** ml an anchor adds when ticked: 0 for check-off anchors or when "from my bottle" is on. */
export function anchorMl(anchor: Anchor, fromBottle: boolean): number {
  return fromBottle ? 0 : anchor.ml;
}

export function clampDayMl(ml: number): number {
  return Math.max(0, Math.min(DAY_MAX_ML, Math.round(ml)));
}

export function parseBottleMl(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= BOTTLE_MIN_ML && n <= BOTTLE_MAX_ML ? Math.round(n) : DEFAULT_BOTTLE_ML;
}

/** "1.25 L", "0.5 L", "2 L" */
export function litres(ml: number): string {
  return `${(Math.round(ml / 10) / 100).toString()} L`;
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

/**
 * This week's goal. Starts at 1.25 L in the week of `start`; every full week
 * since then with ≥5 days at that week's goal raises it by 0.25 L (max 2 L).
 */
export function waterGoal(history: ReadonlyMap<string, number>, start: string, today: string): { goalMl: number; weekStart: string } {
  let goal = GOAL_START_ML;
  const thisWeek = mondayOf(today);
  for (let week = mondayOf(start); week < thisWeek; week = addDays(week, 7)) {
    let hit = 0;
    for (let d = 0; d < 7; d++) if ((history.get(addDays(week, d)) ?? 0) >= goal) hit++;
    if (hit >= GOAL_DAYS_NEEDED) goal = Math.min(GOAL_MAX_ML, goal + GOAL_STEP_ML);
  }
  return { goalMl: goal, weekStart: thisWeek };
}

/** Days this week (so far) at the goal. */
export function daysAtGoalThisWeek(history: ReadonlyMap<string, number>, goalMl: number, today: string): number {
  const monday = mondayOf(today);
  let n = 0;
  for (let d = monday; d <= today; d = addDays(d, 1)) if ((history.get(d) ?? 0) >= goalMl) n++;
  return n;
}

/** Sound/sparkle milestones: crossing half the goal, then the goal. Going down plays nothing. */
export function waterMilestone(prevMl: number, nextMl: number, goalMl: number): "half" | "full" | null {
  if (nextMl <= prevMl) return null;
  if (prevMl < goalMl && nextMl >= goalMl) return "full";
  if (prevMl < goalMl / 2 && nextMl >= goalMl / 2) return "half";
  return null;
}

/** Prototype backups stored glasses; convert to ml. */
export function glassesToMl(glasses: number): number {
  return clampDayMl(Math.max(0, Math.min(8, Math.round(glasses))) * GLASS_ML);
}
