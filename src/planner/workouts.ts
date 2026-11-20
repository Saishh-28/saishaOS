/**
 * Strength workouts you can change: swap an exercise, reorder, add or remove,
 * either "just today" or "always" (pure: no React, no Supabase).
 *
 * A workout plan is a list of items. Each item names the exercise actually
 * done (`key`) and the default exercise it stands in for (`planned`, null for
 * an extra one you added). Logs store both, so "Last: X kg" and personal bests
 * follow the exercise you really did.
 *
 *   effective list for a day = that day's override ?? the "always" plan ?? the default
 */
import { WorkoutDay } from "./plan";
import { GymItem, GymSession, sessionFor, STRENGTH } from "./gym";

export type MuscleGroup =
  | "quads"
  | "glutes-hinge"
  | "chest"
  | "back-vertical"
  | "back-row"
  | "single-leg"
  | "biceps"
  | "triceps"
  | "shoulders"
  | "adductors"
  | "core";

export interface CatalogueEntry extends GymItem {
  group: MuscleGroup;
  /** Hand-picked alternatives, shown first. Others in the same group follow. */
  alts?: string[];
}

const DEFAULT_GROUP: Record<string, { group: MuscleGroup; alts?: string[] }> = {
  squat: { group: "quads", alts: ["leg-press", "bulgarian-split-squat"] },
  "chest-press": { group: "chest", alts: ["incline-press", "machine-fly"] },
  "db-row": { group: "back-row", alts: ["seated-cable-row", "chest-supported-row"] },
  "hip-thrust": { group: "glutes-hinge", alts: ["deadlift", "glute-bridge", "cable-kickback"] },
  "bicep-curl": { group: "biceps", alts: ["hammer-curl", "cable-curl"] },
  adductor: { group: "adductors", alts: ["sumo-squat", "copenhagen-plank"] },
  "dead-bug": { group: "core", alts: ["bird-dog", "plank"] },
  deadlift: { group: "glutes-hinge", alts: ["romanian-deadlift", "hip-thrust"] },
  "lat-pulldown": { group: "back-vertical", alts: ["assisted-pullup", "seated-cable-row"] },
  "incline-press": { group: "chest", alts: ["chest-press", "machine-fly"] },
  "reverse-lunge": { group: "single-leg", alts: ["step-up", "split-squat"] },
  "shoulder-press": { group: "shoulders", alts: ["arnold-press", "lateral-raise"] },
  "hammer-curl": { group: "biceps", alts: ["bicep-curl", "cable-curl"] },
  "triceps-pushdown": { group: "triceps", alts: ["overhead-triceps-extension", "assisted-dips"] },
  plank: { group: "core", alts: ["dead-bug", "side-plank"] },
};

const EXTRA: CatalogueEntry[] = [
  { key: "leg-press", name: "Leg press", plan: "3 × 10", sets: 3, weighted: true, group: "quads" },
  { key: "bulgarian-split-squat", name: "Bulgarian split squats", plan: "3 × 8 each leg", sets: 3, weighted: true, group: "quads" },
  { key: "machine-fly", name: "Machine chest fly", plan: "3 × 12", sets: 3, weighted: true, group: "chest" },
  { key: "seated-cable-row", name: "Seated cable row", plan: "3 × 10", sets: 3, weighted: true, group: "back-row" },
  { key: "chest-supported-row", name: "Chest-supported dumbbell row", plan: "3 × 10", sets: 3, weighted: true, group: "back-row" },
  { key: "glute-bridge", name: "Glute bridges", plan: "3 × 12", sets: 3, weighted: true, group: "glutes-hinge" },
  { key: "cable-kickback", name: "Cable kickbacks", plan: "3 × 12 each leg", sets: 3, weighted: true, group: "glutes-hinge" },
  { key: "romanian-deadlift", name: "Romanian deadlifts", plan: "3 × 10", sets: 3, weighted: true, group: "glutes-hinge" },
  { key: "cable-curl", name: "Cable curls", plan: "3 × 12", sets: 3, weighted: true, group: "biceps" },
  { key: "sumo-squat", name: "Sumo squats", plan: "3 × 12", sets: 3, weighted: true, group: "adductors" },
  { key: "copenhagen-plank", name: "Copenhagen plank (knees ok)", plan: "3 × 20 s each side", sets: 3, group: "adductors" },
  { key: "bird-dog", name: "Bird dogs", plan: "3 × 10 each side", sets: 3, group: "core" },
  { key: "side-plank", name: "Side plank", plan: "3 × 20 s each side", sets: 3, group: "core" },
  { key: "assisted-pullup", name: "Assisted pull-ups", plan: "3 × 6–8", sets: 3, weighted: true, group: "back-vertical" },
  { key: "step-up", name: "Step-ups", plan: "3 × 10 each leg", sets: 3, weighted: true, group: "single-leg" },
  { key: "split-squat", name: "Split squats", plan: "3 × 10 each leg", sets: 3, weighted: true, group: "single-leg" },
  { key: "arnold-press", name: "Arnold press", plan: "3 × 10", sets: 3, weighted: true, group: "shoulders" },
  { key: "lateral-raise", name: "Lateral raises", plan: "3 × 12", sets: 3, weighted: true, group: "shoulders" },
  { key: "overhead-triceps-extension", name: "Overhead triceps extension", plan: "3 × 12", sets: 3, weighted: true, group: "triceps" },
  { key: "assisted-dips", name: "Assisted dips", plan: "3 × 8", sets: 3, weighted: true, group: "triceps" },
];

/** Every strength exercise the app knows, by key. */
export const CATALOGUE: ReadonlyMap<string, CatalogueEntry> = new Map(
  [
    ...[...STRENGTH.A, ...STRENGTH.B].map((i) => ({ ...i, ...DEFAULT_GROUP[i.key] }) as CatalogueEntry),
    ...EXTRA,
  ].map((e) => [e.key, e]),
);

/** Alternatives for an exercise: hand-picked first, then the rest of its muscle group. */
export function alternativesFor(key: string): CatalogueEntry[] {
  const me = CATALOGUE.get(key);
  if (!me) return [];
  const out: CatalogueEntry[] = [];
  const add = (k: string) => {
    const e = CATALOGUE.get(k);
    if (e && e.key !== key && !out.some((x) => x.key === e.key)) out.push(e);
  };
  (me.alts ?? []).forEach(add);
  for (const e of CATALOGUE.values()) if (e.group === me.group) add(e.key);
  return out;
}

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export interface PlanItem {
  /** Exercise actually done (catalogue key or custom-…). */
  key: string;
  /** Default exercise it replaces; null for an extra you added. */
  planned: string | null;
  /** Only for custom ("Other…") exercises. */
  name?: string;
}

/** "always" or a YYYY-MM-DD date ("just today"). */
export type PlanScope = string;
export const ALWAYS: PlanScope = "always";

/** workout_plans rows: `${workout}|${scope}` -> items. */
export type WorkoutPlans = ReadonlyMap<string, PlanItem[]>;
export const planKey = (w: WorkoutDay, scope: PlanScope) => `${w}|${scope}`;

export function defaultPlan(w: WorkoutDay): PlanItem[] {
  return STRENGTH[w].map((i) => ({ key: i.key, planned: i.key }));
}

export function effectivePlan(plans: WorkoutPlans, w: WorkoutDay, date: string): PlanItem[] {
  return plans.get(planKey(w, date)) ?? plans.get(planKey(w, ALWAYS)) ?? defaultPlan(w);
}

export const CUSTOM_PREFIX = "custom-";
export const CUSTOM_NAME_MAX = 60;

/** Key for an "Other…" exercise typed by hand. Same name, same key, so its history is shared. */
export function customKey(name: string): string | null {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40 - CUSTOM_PREFIX.length)
    .replace(/-+$/, "");
  return slug ? CUSTOM_PREFIX + slug : null;
}

/** Display data for a plan item (catalogue entry, or a simple custom one). */
export function itemDetails(item: PlanItem): GymItem {
  const e = CATALOGUE.get(item.key);
  if (e) return e;
  return { key: item.key, name: item.name || item.key.replace(CUSTOM_PREFIX, "").replace(/-/g, " "), plan: "3 sets", sets: 3, weighted: true };
}

/** The day's session with your plan applied (only strength days change). */
export function sessionWithPlans(date: string, plans: WorkoutPlans): GymSession & { plan: PlanItem[] } {
  const s = sessionFor(date);
  if (s.kind !== "strength" || !s.workout) return { ...s, plan: s.items.map((i) => ({ key: i.key, planned: i.key })) };
  const plan = effectivePlan(plans, s.workout, date);
  return { ...s, items: plan.map(itemDetails), plan };
}

/* ------------------------------------------------------------------ */
/* Edits (each returns a new list; the caller saves it for a scope)    */
/* ------------------------------------------------------------------ */

export function swapItem(list: readonly PlanItem[], index: number, to: { key: string; name?: string }): PlanItem[] {
  // The same exercise twice in one day would share one log row, so that's not allowed.
  if (list.some((it, i) => i !== index && it.key === to.key)) return [...list];
  return list.map((it, i) => (i === index ? { key: to.key, planned: it.planned, ...(to.name ? { name: to.name } : {}) } : it));
}

export function moveItem(list: readonly PlanItem[], index: number, delta: -1 | 1): PlanItem[] {
  const j = index + delta;
  if (j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[index], out[j]] = [out[j], out[index]];
  return out;
}

export function removeItem(list: readonly PlanItem[], index: number): PlanItem[] {
  return list.filter((_, i) => i !== index);
}

export const MAX_ITEMS = 12;

export function addItem(list: readonly PlanItem[], to: { key: string; name?: string }): PlanItem[] {
  if (list.length >= MAX_ITEMS || list.some((i) => i.key === to.key)) return [...list];
  return [...list, { key: to.key, planned: null, ...(to.name ? { name: to.name } : {}) }];
}

/**
 * Apply an edit "just today" or "always".
 * - Just today: edits today's list (starting from what today shows) and saves it as today's override.
 * - Always: edits the permanent plan; if today already has its own override, the same edit is applied there too.
 * Returns the rows to write (null = delete the row because it equals what it would fall back to).
 */
export function applyEdit(
  plans: WorkoutPlans,
  w: WorkoutDay,
  date: string,
  scope: "today" | "always",
  edit: (list: PlanItem[]) => PlanItem[],
): { scope: PlanScope; items: PlanItem[] | null }[] {
  const today = plans.get(planKey(w, date));
  if (scope === "today") {
    const next = edit(effectivePlan(plans, w, date));
    const fallback = plans.get(planKey(w, ALWAYS)) ?? defaultPlan(w);
    return [{ scope: date, items: samePlan(next, fallback) ? null : next }];
  }
  const permanent = edit(plans.get(planKey(w, ALWAYS)) ?? defaultPlan(w));
  const out: { scope: PlanScope; items: PlanItem[] | null }[] = [
    { scope: ALWAYS, items: samePlan(permanent, defaultPlan(w)) ? null : permanent },
  ];
  if (today) {
    const t = edit(today);
    out.push({ scope: date, items: samePlan(t, permanent) ? null : t });
  }
  return out;
}

export function samePlan(a: readonly PlanItem[], b: readonly PlanItem[]): boolean {
  return a.length === b.length && a.every((x, i) => x.key === b[i].key && x.planned === b[i].planned && (x.name ?? "") === (b[i].name ?? ""));
}

/* ------------------------------------------------------------------ */
/* "My workouts": what's different from the default, and how to undo  */
/* ------------------------------------------------------------------ */

export type PlanChange =
  | { kind: "swapped"; planned: string; key: string; name?: string }
  | { kind: "added"; key: string; name?: string }
  | { kind: "removed"; planned: string }
  | { kind: "reordered" };

export function planChanges(w: WorkoutDay, list: readonly PlanItem[]): PlanChange[] {
  const def = defaultPlan(w);
  const out: PlanChange[] = [];
  for (const it of list) {
    if (it.planned === null) out.push({ kind: "added", key: it.key, name: it.name });
    else if (it.key !== it.planned) out.push({ kind: "swapped", planned: it.planned, key: it.key, name: it.name });
  }
  for (const d of def) if (!list.some((i) => i.planned === d.planned)) out.push({ kind: "removed", planned: d.key });
  const order = list.filter((i) => i.planned).map((i) => def.findIndex((d) => d.planned === i.planned));
  if (order.some((v, i) => i > 0 && v < order[i - 1])) out.push({ kind: "reordered" });
  return out;
}

/** Undo one permanent change. */
export function undoChange(w: WorkoutDay, list: readonly PlanItem[], change: PlanChange): PlanItem[] {
  const def = defaultPlan(w);
  switch (change.kind) {
    case "swapped":
      return list.map((i) => (i.planned === change.planned ? { key: change.planned, planned: change.planned } : i));
    case "added":
      return list.filter((i) => !(i.planned === null && i.key === change.key));
    case "removed": {
      const idx = def.findIndex((d) => d.key === change.planned);
      // Put it back just before the next default exercise that is still in the list.
      const after = def.slice(idx + 1).map((d) => d.planned);
      const at = list.findIndex((i) => i.planned !== null && after.includes(i.planned));
      const item = { key: change.planned, planned: change.planned };
      return at === -1 ? [...list, item] : [...list.slice(0, at), item, ...list.slice(at)];
    }
    case "reordered": {
      const rank = (i: PlanItem) => (i.planned === null ? Infinity : def.findIndex((d) => d.planned === i.planned));
      return [...list].map((i, n) => ({ i, n })).sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n).map((x) => x.i);
    }
  }
}

/** Clean up plan rows read from the database (drop anything malformed). */
export function parsePlanItems(raw: unknown): PlanItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PlanItem[] = [];
  for (const r of raw.slice(0, MAX_ITEMS)) {
    if (!r || typeof r !== "object") continue;
    const { key, planned, name } = r as Record<string, unknown>;
    if (typeof key !== "string" || !/^[a-z0-9-]{1,40}$/.test(key)) continue;
    if (planned !== null && (typeof planned !== "string" || !/^[a-z0-9-]{1,40}$/.test(planned))) continue;
    out.push({ key, planned: planned as string | null, ...(typeof name === "string" && name ? { name: name.slice(0, CUSTOM_NAME_MAX) } : {}) });
  }
  return out;
}
