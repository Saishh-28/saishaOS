/**
 * Pure Daily Planner logic. No React, no Supabase, no clock reads:
 * every function takes "today" as an argument so it can be unit tested.
 * Behaviour mirrors docs/planner-prototype.html.
 */
import { isLegacyStudyId, STUDY_PLAN_START, StudyTrack, trackForWeekday, trackOf, trackSortOrder, TRACKS, trackTaskId } from "./study";
import {
  BLOCKS,
  Block,
  DAILY_TARGET,
  DEEP,
  GYM_HABIT,
  Habit,
  HABITS,
  PHASES,
  Phase,
  SCHEDULE,
  STUDY,
  WATER_MAX,
  WORKOUT,
  WorkoutDay,
} from "./plan";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PlanTask {
  id: string;
  block: Block;
  text: string;
  phaseStart: string; // YYYY-MM-DD
  sortOrder: number;
  isCustom: boolean; // added by hand or by the AI review, not from the plan
  isAi: boolean; // suggested by the AI review (shown with ✨)
}

export interface ListItem {
  taskId: string;
  carriedOver: boolean;
}

export type DayLists = Record<Block, ListItem[]>;

/** taskId -> date it was ticked done (YYYY-MM-DD). */
export type Completions = ReadonlyMap<string, string>;

/** Sort order used for custom tasks so they never mix into the plan queue. */
export const CUSTOM_SORT_BASE = 100_000;

/* ------------------------------------------------------------------ */
/* Dates (all YYYY-MM-DD strings, calendar maths done in UTC)          */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = parseYmd(s);
  return toYmdUTC(d) === s;
}

/** Local calendar date of a Date (the phone's own timezone, like the prototype). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, n: number): string {
  const d = parseYmd(date);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmdUTC(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string): number {
  return parseYmd(date).getUTCDay();
}

/** ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(date: string): number {
  const t = parseYmd(date);
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

function queueFromSource(src: Record<string, string[]>, block: Block): PlanTask[] {
  const out: PlanTask[] = [];
  Object.keys(src)
    .sort()
    .forEach((start) => {
      src[start].forEach((text, i) => {
        out.push({
          id: `${block}-${start}-${i}`,
          block,
          text,
          phaseStart: start,
          sortOrder: out.length,
          isCustom: false,
          isAi: false,
        });
      });
    });
  return out;
}

/** The new study tracks (R, JS, Saturday) as plan tasks; see study.ts. */
export function buildStudyTrackTasks(): PlanTask[] {
  return (Object.keys(TRACKS) as StudyTrack[]).flatMap((track) =>
    TRACKS[track].map((text, i) => ({
      id: trackTaskId(track, i),
      block: "study" as Block,
      text,
      phaseStart: STUDY_PLAN_START,
      sortOrder: trackSortOrder(track, i),
      isCustom: false,
      isAi: false,
    })),
  );
}

/**
 * Every plan task with stable IDs. Used to seed plan_tasks.
 * The old STUDY queue stays (completed tasks and past days refer to it);
 * from STUDY_PLAN_START the study block uses the tracks instead.
 */
export function buildPlanTasks(): PlanTask[] {
  return [...queueFromSource(DEEP, "deep"), ...queueFromSource(STUDY, "study"), ...buildStudyTrackTasks()];
}

/**
 * The ordered plan queue for one block, as it worked before the new study
 * plan (custom tasks and the new study-track tasks are never part of it).
 */
export function queueFor(tasks: readonly PlanTask[], block: Block): PlanTask[] {
  return tasks
    .filter((t) => t.block === block && !t.isCustom && !trackOf(t.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/** Is the new study plan (one track task per day) in force on `date`? */
export const usesStudyTracks = (date: string) => date >= STUDY_PLAN_START;

/** The study track for `date` (null on Sundays, or before the new plan). */
export function studyTrackFor(date: string): StudyTrack | null {
  return usesStudyTracks(date) ? trackForWeekday(dayOfWeek(date)) : null;
}

/** That day's track tasks, in order (empty on Sundays). */
export function studyQueue(tasks: readonly PlanTask[], date: string): PlanTask[] {
  const track = studyTrackFor(date);
  if (!track) return [];
  return tasks.filter((t) => t.block === "study" && trackOf(t.id) === track).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The queue a block draws from on `date`: study uses that day's track once the new plan starts. */
export function queueForDate(tasks: readonly PlanTask[], block: Block, date: string): PlanTask[] {
  return block === "study" && usesStudyTracks(date) ? studyQueue(tasks, date) : queueFor(tasks, block);
}

/** One study task per session under the new plan. */
export const STUDY_TRACK_TARGET = 1;

/**
 * Study list for a day under the new plan: your own unfinished custom study
 * tasks carry over; then the first unfinished task of that day's track
 * (so a missed Monday R task comes back on Wednesday). Sunday: rest.
 */
export function studyListFor(date: string, tasks: readonly PlanTask[], done: Completions, prev: readonly ListItem[] | null): ListItem[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: ListItem[] = [];
  for (const item of prev ?? []) {
    const t = byId.get(item.taskId);
    if (t && t.isCustom && t.block === "study" && !done.has(t.id) && !out.some((x) => x.taskId === t.id))
      out.push({ taskId: t.id, carriedOver: true });
  }
  const next = studyQueue(tasks, date).find((t) => !done.has(t.id));
  if (next) out.push({ taskId: next.id, carriedOver: (prev ?? []).some((i) => i.taskId === next.id) });
  return out;
}

/**
 * One-time switch for a day that was created with the old study plan:
 * drops unfinished old study tasks and adds that day's track task.
 * Returns null when nothing needs to change.
 */
export function upgradeStudyItems(items: readonly ListItem[], tasks: readonly PlanTask[], date: string, done: Completions): ListItem[] | null {
  if (!usesStudyTracks(date)) return null;
  const kept = items.filter((i) => !(isLegacyStudyId(i.taskId) && !done.has(i.taskId)));
  const hasTrack = kept.some((i) => !!trackOf(i.taskId));
  const next = hasTrack ? undefined : studyQueue(tasks, date).find((t) => !done.has(t.id) && !kept.some((i) => i.taskId === t.id));
  const out = next ? [...kept, { taskId: next.id, carriedOver: false }] : kept;
  return out.length === items.length && out.every((x, i) => x.taskId === items[i].taskId) ? null : out;
}

export function phaseFor(date: string, phases: readonly Phase[] = PHASES): Phase {
  let p = phases[0];
  for (const x of phases) if (x.start <= date) p = x;
  return p;
}

/** A plan task can be auto-added to `date` only if its phase has started and it isn't done. */
export function isEligible(task: PlanTask, date: string, done: Completions): boolean {
  return task.phaseStart <= date && !done.has(task.id);
}

/* ------------------------------------------------------------------ */
/* Daily lists                                                         */
/* ------------------------------------------------------------------ */

/**
 * Append queue tasks, in order, until the list has `target` items.
 * Current-phase tasks come first. If the current phase runs out, the next
 * future-phase tasks fill the gap (`gapFill`), so a day is never empty just
 * because a phase finished early.
 */
export function fillBlock(
  items: readonly ListItem[],
  queue: readonly PlanTask[],
  date: string,
  done: Completions,
  target: number = DAILY_TARGET,
  gapFill = true,
): ListItem[] {
  const out = [...items];
  const present = new Set(out.map((i) => i.taskId));
  const add = (ok: (t: PlanTask) => boolean) => {
    for (const t of queue) {
      if (out.length >= target) break;
      if (ok(t) && !present.has(t.id)) {
        out.push({ taskId: t.id, carriedOver: false });
        present.add(t.id);
      }
    }
  };
  add((t) => isEligible(t, date, done));
  if (gapFill) add((t) => !done.has(t.id));
  return out;
}

/**
 * Build a brand-new day's lists (called only the first time a day is opened):
 * 1. carry over unfinished tasks from the most recent previous day,
 * 2. fill from the plan queue, in order, up to `target`.
 * Carried tasks are kept even if that makes the list longer than `target`.
 */
export function createDayLists(args: {
  date: string;
  tasks: readonly PlanTask[];
  done: Completions;
  prev: DayLists | null;
  target?: number;
}): DayLists {
  const { date, tasks, done, prev, target = DAILY_TARGET } = args;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const day = { deep: [], study: [] } as DayLists;
  for (const b of BLOCKS) {
    const carried: ListItem[] = [];
    const seen = new Set<string>();
    for (const item of prev?.[b] ?? []) {
      const task = byId.get(item.taskId);
      if (!task || task.block !== b || done.has(item.taskId) || seen.has(item.taskId)) continue;
      carried.push({ taskId: item.taskId, carriedOver: true });
      seen.add(item.taskId);
    }
    day[b] =
      b === "study" && usesStudyTracks(date)
        ? studyListFor(date, tasks, done, prev?.study ?? null)
        : fillBlock(carried, queueFor(tasks, b), date, done, target);
  }
  return day;
}

/** The most recent date strictly before `date`, or null. */
export function previousDate(existingDates: Iterable<string>, date: string): string | null {
  let best: string | null = null;
  for (const d of existingDates) if (d < date && (best === null || d > best)) best = d;
  return best;
}

/**
 * "Pull next task from the plan": add one more eligible task; if the current
 * phases are exhausted, take the next not-done task from a future phase.
 */
export function pullNext(
  items: readonly ListItem[],
  queue: readonly PlanTask[],
  date: string,
  done: Completions,
): { items: ListItem[]; added: PlanTask | null; early: boolean } {
  const filled = fillBlock(items, queue, date, done, items.length + 1, false);
  if (filled.length > items.length) {
    const id = filled[filled.length - 1].taskId;
    return { items: filled, added: queue.find((t) => t.id === id) ?? null, early: false };
  }
  const present = new Set(items.map((i) => i.taskId));
  const next = queue.find((t) => !done.has(t.id) && !present.has(t.id));
  if (!next) return { items: [...items], added: null, early: false };
  return { items: [...items, { taskId: next.id, carriedOver: false }], added: next, early: true };
}

/**
 * Remove a task from today. A plan task simply leaves the list and goes back
 * into the queue (it will be offered again). A custom task should be deleted.
 */
export function removeFromDay(
  items: readonly ListItem[],
  task: Pick<PlanTask, "id" | "isCustom">,
): { items: ListItem[]; deleteTask: boolean } {
  return { items: items.filter((i) => i.taskId !== task.id), deleteTask: task.isCustom };
}

/** Next `n` not-done plan tasks that aren't already in `exclude` (future phases included). */
export function upcoming(
  queue: readonly PlanTask[],
  done: Completions,
  exclude: ReadonlySet<string>,
  n: number,
): PlanTask[] {
  return queue.filter((t) => !done.has(t.id) && !exclude.has(t.id)).slice(0, n);
}

/* ------------------------------------------------------------------ */
/* Gym                                                                 */
/* ------------------------------------------------------------------ */

const STRENGTH_DAYS = [1, 3, 5]; // Mon, Wed, Fri

/** Odd ISO week: A, B, A. Even ISO week: B, A, B. Other days: rest (null). */
export function workoutFor(date: string): WorkoutDay | null {
  const idx = STRENGTH_DAYS.indexOf(dayOfWeek(date));
  if (idx === -1) return null;
  const seq: WorkoutDay[] = isoWeek(date) % 2 === 1 ? ["A", "B", "A"] : ["B", "A", "B"];
  return seq[idx];
}

export function gymKey(w: WorkoutDay, i: number): string {
  return `gym:${w}:${i}`;
}

export function isWorkoutComplete(w: WorkoutDay, ticks: Readonly<Record<string, boolean>>): boolean {
  return WORKOUT[w].every((_, i) => !!ticks[gymKey(w, i)]);
}

/** Habits that apply on `date`. Sunday is a rest day, so the gym habit needs no tick. */
export function habitsOn(date: string): Habit[] {
  return dayOfWeek(date) === 0 ? HABITS.filter((h) => h.key !== GYM_HABIT) : HABITS;
}

/**
 * Everything ticked on `date`: tasks finished that day, habits, exercises.
 * The next tick plays note number ticksOn(...) + 1 (see sound.ts).
 */
export function ticksOn(args: {
  date: string;
  done: Completions;
  habits: Readonly<Record<string, boolean>>;
  exercises: Readonly<Record<string, { done: boolean }>>;
}): number {
  let n = 0;
  for (const d of args.done.values()) if (d === args.date) n++;
  n += Object.values(args.habits).filter(Boolean).length;
  n += Object.values(args.exercises).filter((e) => e.done).length;
  return n;
}

/* ------------------------------------------------------------------ */
/* Today view                                                          */
/* ------------------------------------------------------------------ */

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Index of the schedule slot that contains `minutes` (since midnight), or -1 before the first slot. */
export function currentSlotIndex(minutes: number): number {
  let cur = -1;
  SCHEDULE.forEach((s, i) => {
    if (toMinutes(s.time) <= minutes) cur = i;
  });
  return cur;
}

export function formatTime(hhmm: string): string {
  let [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}${m ? ":" + pad(m) : ""}${ap}`;
}

export function greeting(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/* ------------------------------------------------------------------ */
/* Rest days                                                           */
/* ------------------------------------------------------------------ */

/** habit_logs key for a day you marked "Rest / sick day". */
export const REST_DAY_KEY = "restDay";
/** Rest / sick days you can mark per week (Mon–Sun); Sundays are rest anyway and don't count. */
export const REST_DAYS_PER_WEEK = 2;
/** On a rest day only these count (plus the water goal): no deep work, study or gym. */
export const REST_DAY_HABITS = ["skinAM", "skinPM", "walkLunch", "walkDinner"];

/** Sundays, and days marked "Rest / sick day". */
export function isRestDay(date: string, habits: Readonly<Record<string, boolean>>): boolean {
  return dayOfWeek(date) === 0 || !!habits[REST_DAY_KEY];
}

/** Rest / sick days still available in `date`'s week (Mon–Sun). */
export function restDaysLeft(habitsByDate: ReadonlyMap<string, Readonly<Record<string, boolean>>>, date: string): number {
  const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
  let used = 0;
  for (let i = 0; i < 6; i++) if (habitsByDate.get(addDays(monday, i))?.[REST_DAY_KEY]) used++;
  return Math.max(0, REST_DAYS_PER_WEEK - used);
}

/**
 * Overall progress: tasks + habits + (reaching the water goal counts as one item).
 * On a rest day (when `date` is given): only the basic habits + water.
 */
export function dayProgress(args: {
  lists: DayLists;
  done: Completions;
  habits: Readonly<Record<string, boolean>>;
  /** Water drunk today, in ml. */
  water: number;
  /** This week's water goal in ml (see water.ts waterGoal); defaults to the starting goal, 1.25 L. */
  waterGoalMl?: number;
  /** When given, only the habits that apply on that date count (see habitsOn). */
  date?: string;
}): { done: number; total: number; pct: number; rest: boolean } {
  const waterDone = args.water >= (args.waterGoalMl ?? 1250) ? 1 : 0;
  if (args.date && isRestDay(args.date, args.habits)) {
    const done = REST_DAY_HABITS.filter((k) => args.habits[k]).length + waterDone;
    const total = REST_DAY_HABITS.length + 1;
    return { done, total, pct: Math.round((done / total) * 100), rest: true };
  }
  const habits = args.date ? habitsOn(args.date) : HABITS;
  const ids = [...args.lists.deep, ...args.lists.study].map((i) => i.taskId);
  const tdone = ids.filter((id) => args.done.has(id)).length;
  const hdone = habits.filter((h) => args.habits[h.key]).length;
  const total = ids.length + habits.length + 1;
  const doneAll = tdone + hdone + waterDone;
  return { done: doneAll, total, pct: Math.round((doneAll / total) * 100), rest: false };
}

/* ------------------------------------------------------------------ */
/* CSV export (date, category, item, done)                            */
/* ------------------------------------------------------------------ */

export interface CsvDay {
  date: string;
  lists: DayLists;
  habits: Readonly<Record<string, boolean>>;
  water: number;
}

/**
 * One row per task per day, one per habit per day, one water row per day.
 * A task counts as done on a day if it was ticked on or before that day
 * (so a task carried from Monday and finished on Tuesday is 0 on Monday, 1 on Tuesday).
 */
export function csvRows(days: readonly CsvDay[], tasksById: ReadonlyMap<string, PlanTask>, done: Completions) {
  const rows: (string | number)[][] = [["date", "category", "item", "done"]];
  [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((d) => {
      for (const b of BLOCKS) {
        for (const item of d.lists[b]) {
          const doneDate = done.get(item.taskId);
          rows.push([d.date, b, tasksById.get(item.taskId)?.text ?? "(removed task)", doneDate && doneDate <= d.date ? 1 : 0]);
        }
      }
      for (const h of habitsOn(d.date)) rows.push([d.date, "habit", h.label, d.habits[h.key] ? 1 : 0]);
      rows.push([d.date, "water", "ml", d.water || 0]);
    });
  return rows;
}

export function toCsv(rows: readonly (string | number)[][]): string {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/* ------------------------------------------------------------------ */
/* Prototype backup import                                             */
/* ------------------------------------------------------------------ */

export interface PrototypeDay {
  deep: string[];
  study: string[];
  carried: string[];
  habits: Record<string, boolean>;
  water: number;
  gymLog?: Record<string, boolean>;
  fromAI?: boolean;
}

export interface PrototypeBackup {
  days: Record<string, PrototypeDay>;
  done: Record<string, string>;
  custom: Record<string, { text: string; block: Block }>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Parse and validate the JSON the prototype's "Copy backup" button produces. Throws with a readable message. */
export function parsePrototypeBackup(input: string | unknown): PrototypeBackup {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new Error("That isn't valid JSON. Paste the whole backup text.");
    }
  }
  if (!isObj(raw) || !isObj(raw.days)) throw new Error("That doesn't look like a planner backup (no \"days\").");
  const done = isObj(raw.done) ? raw.done : {};
  const custom = isObj(raw.custom) ? raw.custom : {};

  const out: PrototypeBackup = { days: {}, done: {}, custom: {} };
  for (const [date, d] of Object.entries(raw.days)) {
    if (!isYmd(date)) throw new Error(`Bad date in backup: ${date}`);
    if (!isObj(d) || !isStrArr(d.deep) || !isStrArr(d.study)) throw new Error(`Day ${date} is malformed.`);
    const habits: Record<string, boolean> = {};
    if (isObj(d.habits)) for (const [k, v] of Object.entries(d.habits)) habits[k] = v === true;
    const gymLog: Record<string, boolean> = {};
    if (isObj(d.gymLog)) for (const [k, v] of Object.entries(d.gymLog)) gymLog[k] = v === true;
    const water = typeof d.water === "number" ? Math.max(0, Math.min(WATER_MAX, Math.round(d.water))) : 0;
    out.days[date] = {
      deep: d.deep,
      study: d.study,
      carried: isStrArr(d.carried) ? d.carried : [],
      habits,
      water,
      gymLog,
      fromAI: d.fromAI === true,
    };
  }
  for (const [id, date] of Object.entries(done)) {
    if (isYmd(date)) out.done[id] = date;
  }
  for (const [id, c] of Object.entries(custom)) {
    if (isObj(c) && typeof c.text === "string" && (c.block === "deep" || c.block === "study")) {
      out.custom[id] = { text: c.text, block: c.block };
    }
  }
  return out;
}

export interface ImportDay {
  date: string;
  lists: DayLists;
  habits: Record<string, boolean>; // habit key -> done (includes skinAM/skinPM)
  gymTicks: Record<string, boolean>; // gym:A:0 -> done
  water: number;
  fromAi: boolean;
}

export interface ImportPlan {
  customTasks: PlanTask[];
  days: ImportDay[];
  completions: { taskId: string; doneDate: string }[];
  skipped: string[]; // human-readable notes about things that couldn't be imported
}

/**
 * Turn a parsed backup into rows to write. `planTasks` is the user's current
 * plan (so we know which IDs are real). Custom prototype tasks become custom
 * plan_tasks with the same ID; references to IDs that no longer exist are skipped.
 */
export function backupToImportPlan(backup: PrototypeBackup, planTasks: readonly PlanTask[]): ImportPlan {
  const known = new Map(planTasks.map((t) => [t.id, t]));
  const skipped: string[] = [];

  // First date each custom task appears on (becomes its phase_start).
  const firstSeen = new Map<string, string>();
  for (const date of Object.keys(backup.days).sort()) {
    const d = backup.days[date];
    for (const id of [...d.deep, ...d.study]) if (!firstSeen.has(id)) firstSeen.set(id, date);
  }

  const customTasks: PlanTask[] = [];
  let n = planTasks.filter((t) => t.isCustom).length;
  for (const [id, c] of Object.entries(backup.custom)) {
    if (known.has(id)) {
      if (known.get(id)!.block !== c.block) skipped.push(`Custom task ${id} clashes with an existing task in another block.`);
      continue; // already imported earlier: re-running the import is safe
    }
    const phaseStart = firstSeen.get(id) ?? backup.done[id] ?? Object.keys(backup.days).sort()[0];
    if (!phaseStart) {
      skipped.push(`Custom task "${c.text}" isn't on any day.`);
      continue;
    }
    const task: PlanTask = {
      id,
      block: c.block,
      text: c.text,
      phaseStart,
      sortOrder: CUSTOM_SORT_BASE + n++,
      isCustom: true,
      isAi: c.text.startsWith("✨"),
    };
    customTasks.push(task);
    known.set(id, task);
  }

  const days: ImportDay[] = [];
  for (const date of Object.keys(backup.days).sort()) {
    const d = backup.days[date];
    const carried = new Set(d.carried);
    const lists = { deep: [], study: [] } as DayLists;
    for (const b of BLOCKS) {
      const seen = new Set<string>();
      for (const id of d[b]) {
        const t = known.get(id);
        if (!t) {
          skipped.push(`${date}: task ${id} no longer exists (removed custom task).`);
          continue;
        }
        if (t.block !== b) {
          skipped.push(`${date}: task ${id} is listed under the wrong block.`);
          continue;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        lists[b].push({ taskId: id, carriedOver: carried.has(id) });
      }
    }
    const habits: Record<string, boolean> = {};
    for (const h of HABITS) habits[h.key] = !!d.habits[h.key];
    const gymTicks: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(d.gymLog ?? {})) {
      const m = /^([AB])(\d+)$/.exec(k);
      if (m && Number(m[2]) < WORKOUT[m[1] as WorkoutDay].length) gymTicks[gymKey(m[1] as WorkoutDay, Number(m[2]))] = v;
    }
    days.push({ date, lists, habits, gymTicks, water: d.water, fromAi: !!d.fromAI });
  }

  const completions: { taskId: string; doneDate: string }[] = [];
  for (const [taskId, doneDate] of Object.entries(backup.done)) {
    if (known.has(taskId)) completions.push({ taskId, doneDate });
    else skipped.push(`Completion for unknown task ${taskId} skipped.`);
  }

  return { customTasks, days, completions, skipped };
}
