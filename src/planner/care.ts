/**
 * Phase 2.5: Care (Moonlit Garden). Skincare routine steps, skin log,
 * hair wash days, journal, book notes, trends. Pure functions.
 */
import { addDays } from "./logic";
import type { Earned } from "./game";

export type Routine = "am" | "pm";

export interface CareStep {
  id: string;
  routine: Routine;
  label: string;
  /** Only a few times a week (e.g. salicylic acid: 3). Optional on other nights. */
  perWeek: number | null;
  sortOrder: number;
}

/** Your routine (editable in the app; seeded once). */
export const SEED_STEPS: CareStep[] = [
  { id: "am-cleanser", routine: "am", label: "Cleanser", perWeek: null, sortOrder: 1 },
  { id: "am-niacinamide", routine: "am", label: "Niacinamide", perWeek: null, sortOrder: 2 },
  { id: "am-sunscreen", routine: "am", label: "Sunscreen", perWeek: null, sortOrder: 3 },
  { id: "pm-cleanser", routine: "pm", label: "Cleanser", perWeek: null, sortOrder: 1 },
  { id: "pm-salicylic", routine: "pm", label: "2% salicylic acid", perWeek: 3, sortOrder: 2 },
  { id: "pm-moisturiser", routine: "pm", label: "Moisturiser", perWeek: null, sortOrder: 3 },
];

/** The habit each routine ticks (shared with Habits and Sanctuary via health_logs). */
export const ROUTINE_HABIT: Record<Routine, string> = { am: "skinAM", pm: "skinPM" };

export const BREAKOUT_AREAS = ["face", "back", "shoulders", "buttocks"] as const;
export type BreakoutArea = (typeof BREAKOUT_AREAS)[number];

export interface SkinLog {
  date: string;
  steps: string[];
  rating: number | null;
  areas: BreakoutArea[];
  note: string | null;
}

export const HAIR_ITEMS = [
  { id: "pre_oil", label: "Pre-wash oiling" },
  { id: "shampoo", label: "Shampoo" },
  { id: "conditioner", label: "Conditioner" },
  { id: "deep_mask", label: "Deep conditioning mask" },
  { id: "protein_mask", label: "Protein mask" },
  { id: "clarifying", label: "Clarifying wash" },
] as const;
export type HairItem = (typeof HAIR_ITEMS)[number]["id"];

export interface HairLog {
  date: string;
  items: HairItem[];
  products: string | null;
  shedding: number | null;
  note: string | null;
}

export const CARE_LOG_XP = 5;
export const JOURNAL_XP = 5;
export const BOOK_NOTE_XP = 10;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/* ------------------------------------------------------------------ */
/* Skincare                                                            */
/* ------------------------------------------------------------------ */

export function stepsFor(steps: readonly CareStep[], routine: Routine): CareStep[] {
  return steps.filter((s) => s.routine === routine).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** A routine is done when every everyday step is ticked (few-times-a-week steps are optional). */
export function routineDone(steps: readonly CareStep[], routine: Routine, done: readonly string[]): boolean {
  const req = stepsFor(steps, routine).filter((s) => !s.perWeek);
  return req.length > 0 && req.every((s) => done.includes(s.id));
}

export interface StepHint {
  due: boolean;
  usedToday: boolean;
  text: string;
}

const weekday = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

/**
 * "Tonight?" for a few-times-a-week step: due when you've used it fewer than
 * `perWeek` times in the last 7 days and not yesterday (a night off between uses).
 */
export function stepHint(step: CareStep, logs: readonly SkinLog[], today: string): StepHint | null {
  if (!step.perWeek) return null;
  const uses = logs.filter((l) => l.steps.includes(step.id)).map((l) => l.date).sort();
  const usedToday = uses.includes(today);
  const past = uses.filter((d) => d < today);
  const last = past.at(-1) ?? null;
  const week = past.filter((d) => d >= addDays(today, -6)).length;
  if (usedToday) return { due: false, usedToday, text: `Done tonight ✓ · ${week + 1} of ${step.perWeek} this week` };
  const since = last ? daysBetween(last, today) : null;
  if (week >= step.perWeek) return { due: false, usedToday, text: `Not tonight: ${week} of ${step.perWeek} this week already` };
  if (since === 1) return { due: false, usedToday, text: "Not tonight: you used it yesterday" };
  const lastText = last ? `last used ${weekday(last)} (${since} days ago)` : "not used yet";
  return { due: true, usedToday, text: `Tonight? ${lastText} · ${week} of ${step.perWeek} this week` };
}

/* ------------------------------------------------------------------ */
/* Hair                                                                */
/* ------------------------------------------------------------------ */

export const PROTEIN_MASK_DAYS = 14;
export const CLARIFYING_DAYS = 18;

export interface HairReminder {
  item: HairItem;
  text: string;
}

/** "Protein mask due" after > 14 days, "Clarifying wash due" after > 18 days (or if never logged). */
export function hairReminders(logs: readonly HairLog[], today: string): HairReminder[] {
  const out: HairReminder[] = [];
  const check = (item: HairItem, days: number, label: string) => {
    const last = logs.filter((l) => l.items.includes(item) && l.date <= today).map((l) => l.date).sort().at(-1);
    if (!last) out.push({ item, text: `${label} due (none logged yet)` });
    else if (daysBetween(last, today) > days) out.push({ item, text: `${label} due (${daysBetween(last, today)} days since the last one)` });
  };
  check("protein_mask", PROTEIN_MASK_DAYS, "Protein mask");
  check("clarifying", CLARIFYING_DAYS, "Clarifying wash");
  return out;
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export const JOURNAL_PROMPTS = [
  "What felt light today?",
  "One thing I'm proud of today:",
  "What drained me, and what would help tomorrow?",
  "A small moment I want to remember:",
  "What would make tomorrow 1% better?",
  "Who or what am I grateful for today?",
  "What did my body need today?",
];

/** Today's rotating prompt. */
export const journalPrompt = (date: string) => JOURNAL_PROMPTS[Number(date.slice(8, 10)) % JOURNAL_PROMPTS.length];

/* ------------------------------------------------------------------ */
/* XP                                                                  */
/* ------------------------------------------------------------------ */

export interface CareData {
  skin?: readonly SkinLog[];
  hair?: readonly HairLog[];
  /** Days with a (non-empty) journal entry. Only dates: the text never leaves the Care screen. */
  journalDates?: readonly string[];
  bookNotes?: readonly { id: string; date: string; section: string }[];
}

/** A skin log counts once you rate your skin or note something (the routine ticks already give Habit XP). */
export const isSkinLogged = (l: SkinLog) => l.rating != null || l.areas.length > 0 || !!l.note?.trim();
/** A hair log counts on a wash day (anything ticked). */
export const isHairLogged = (l: HairLog) => l.items.length > 0;

export function careXp(d: CareData, inRange: (date: string) => boolean): Earned[] {
  const out: Earned[] = [];
  for (const l of d.skin ?? [])
    if (inRange(l.date) && isSkinLogged(l)) out.push({ source: `skinlog:${l.date}`, skill: "glow", amount: CARE_LOG_XP, date: l.date, reason: "Skin log" });
  for (const l of d.hair ?? [])
    if (inRange(l.date) && isHairLogged(l)) out.push({ source: `hairlog:${l.date}`, skill: "glow", amount: CARE_LOG_XP, date: l.date, reason: "Hair wash day" });
  for (const date of d.journalDates ?? [])
    if (inRange(date)) out.push({ source: `journal:${date}`, skill: "mind", amount: JOURNAL_XP, date, reason: "Journal entry" });
  for (const n of d.bookNotes ?? [])
    if (inRange(n.date)) out.push({ source: `booknote:${n.id}`, skill: "mind", amount: BOOK_NOTE_XP, date: n.date, reason: `Book note: ${n.section}`.slice(0, 120) });
  return out;
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */

export interface TrendPoint {
  date: string;
  skin: number | null;
  shedding: number | null;
  /** Water as a share of that day's goal (0–1+). */
  water: number;
  /** After-meal walks that day (0–2). */
  walks: number;
}

export function careTrend(args: {
  skin: readonly SkinLog[];
  hair: readonly HairLog[];
  water: ReadonlyMap<string, number>;
  habits: ReadonlyMap<string, Readonly<Record<string, boolean>>>;
  goalOn: (date: string) => number;
  today: string;
  days?: number;
}): TrendPoint[] {
  const n = args.days ?? 30;
  const out: TrendPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(args.today, -i);
    const h = args.habits.get(date) ?? {};
    out.push({
      date,
      skin: args.skin.find((l) => l.date === date)?.rating ?? null,
      shedding: args.hair.find((l) => l.date === date)?.shedding ?? null,
      water: (args.water.get(date) ?? 0) / Math.max(1, args.goalOn(date)),
      walks: (h.walkLunch ? 1 : 0) + (h.walkDinner ? 1 : 0),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

const HAIR_LABEL = Object.fromEntries(HAIR_ITEMS.map((i) => [i.id, i.label]));

/** Care rows for the CSV export (date, category, item, value). */
export function careCsvRows(args: {
  steps: readonly CareStep[];
  skin: readonly SkinLog[];
  hair: readonly HairLog[];
  journal: readonly { date: string; content: string; shared: boolean }[];
  books: readonly { id: string; title: string }[];
  notes: readonly { bookId: string; date: string; section: string; mainIdea: string | null; experiment: string | null; result: string | null }[];
}): (string | number)[][] {
  const label = new Map(args.steps.map((s) => [s.id, `${s.routine.toUpperCase()} ${s.label}`]));
  const rows: (string | number)[][] = [];
  for (const l of [...args.skin].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const s of l.steps) rows.push([l.date, "skincare", label.get(s) ?? s, "done"]);
    if (l.rating != null) rows.push([l.date, "skin", "rating (1–5)", l.rating]);
    if (l.areas.length) rows.push([l.date, "skin", "breakout areas", l.areas.join(" ")]);
    if (l.note) rows.push([l.date, "skin", "note", l.note]);
  }
  for (const l of [...args.hair].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const i of l.items) rows.push([l.date, "hair", HAIR_LABEL[i] ?? i, "done"]);
    if (l.products) rows.push([l.date, "hair", "products", l.products]);
    if (l.shedding != null) rows.push([l.date, "hair", "shedding / breakage (1–5)", l.shedding]);
    if (l.note) rows.push([l.date, "hair", "note", l.note]);
  }
  for (const j of [...args.journal].sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([j.date, "journal", j.shared ? "entry (shared with Lumi)" : "entry (private)", j.content]);
  const title = new Map(args.books.map((b) => [b.id, b.title]));
  for (const n of [...args.notes].sort((a, b) => a.date.localeCompare(b.date))) {
    const t = title.get(n.bookId) ?? "Book";
    rows.push([n.date, "book", `${t} · ${n.section} · main idea`, n.mainIdea ?? ""]);
    if (n.experiment) rows.push([n.date, "book", `${t} · ${n.section} · experiment`, n.experiment]);
    if (n.result) rows.push([n.date, "book", `${t} · ${n.section} · result`, n.result]);
  }
  return rows;
}
