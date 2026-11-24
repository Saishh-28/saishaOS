/**
 * Pure helpers for the screens that moved over from the old dashboard
 * (Study courses, Treasury, bucket list import, backup). No React, no Supabase.
 */
import { addDays } from "./logic";
import { cleanText } from "./validate";

/* ------------------------------------------------------------------ */
/* Courses and grades (University of Auckland 9-point GPA)             */
/* ------------------------------------------------------------------ */

export const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E"] as const;
export type Grade = (typeof GRADES)[number];

const GRADE_POINTS: Record<string, number> = {
  "A+": 9, A: 8, "A-": 7, "B+": 6, B: 5, "B-": 4, "C+": 3, C: 2, "C-": 1, "D+": 0, D: 0, "D-": 0, E: 0,
};

export interface CourseRow {
  id: string;
  code: string;
  name: string;
  credits: number | null;
  grade_goal: string | null;
  term: string | null;
  final_grade: string | null;
}

/** GPA over courses with a letter grade, weighted by credits (15 by default). null if none. */
export function gpa(courses: readonly Pick<CourseRow, "credits" | "final_grade">[]): number | null {
  let pts = 0;
  let cr = 0;
  for (const c of courses) {
    const p = c.final_grade ? GRADE_POINTS[c.final_grade] : undefined;
    if (p === undefined) continue;
    const credits = c.credits && c.credits > 0 ? c.credits : 15;
    pts += p * credits;
    cr += credits;
  }
  return cr ? Math.round((pts / cr) * 100) / 100 : null;
}

/** "S1 2027" → sortable number (Summer School comes before S1 in the same year). */
export function termRank(term: string | null): number {
  const m = /^(SS|S1|S2) (\d{4})$/.exec(term ?? "");
  if (!m) return -1;
  return Number(m[2]) * 10 + { SS: 0, S1: 1, S2: 2 }[m[1] as "SS" | "S1" | "S2"];
}

export const isTerm = (s: string) => termRank(s) >= 0;

/** Group courses by term, newest term first; courses without a term go last. */
export function coursesByTerm<T extends Pick<CourseRow, "term" | "code">>(courses: readonly T[]): { term: string | null; courses: T[] }[] {
  const groups = new Map<string | null, T[]>();
  for (const c of courses) {
    const k = c.term && isTerm(c.term) ? c.term : null;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.entries()]
    .sort((a, b) => termRank(b[0]) - termRank(a[0]))
    .map(([term, list]) => ({ term, courses: list.sort((x, y) => x.code.localeCompare(y.code)) }));
}

/** Course code like "STATS 220": letters, a space, digits (and an optional letter). */
export function cleanCourseCode(s: string): string | null {
  const m = /^\s*([A-Za-z]{2,10})\s*(\d{3}[A-Za-z]?)\s*$/.exec(s);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export type Currency = "INR" | "NZD";
export const CURRENCIES: { code: Currency; label: string }[] = [
  { code: "INR", label: "₹ Indian rupee" },
  { code: "NZD", label: "NZ$ New Zealand dollar" },
];
/** Back to Auckland: from this day the app suggests switching to NZ$. */
export const CURRENCY_REMINDER_DATE = "2027-02-20";

export function parseCurrency(v: unknown): Currency {
  return v === "NZD" ? "NZD" : "INR";
}

export function money(amount: number, currency: Currency): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const locale = currency === "INR" ? "en-IN" : "en-NZ";
  const s = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(Math.abs(n));
  return `${n < 0 ? "−" : ""}${currency === "INR" ? "₹" : "NZ$"}${s}`;
}

/** Show the "switch to NZ$?" reminder: on/after 20 Feb 2027, still on ₹, not dismissed. */
export function showCurrencyReminder(today: string, currency: Currency, dismissed: boolean): boolean {
  return today >= CURRENCY_REMINDER_DATE && currency === "INR" && !dismissed;
}

/** Parse a typed amount ("1,250.50" or "1250"); null if it isn't a sensible positive number. */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[,\s₹$]/g, "").replace(/^NZ/i, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

export interface TransactionRow {
  id: string;
  category_id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
}

/** Spent per category in the month of `today` (YYYY-MM). */
export function spentThisMonth(tx: readonly TransactionRow[], today: string): Map<string, number> {
  const month = today.slice(0, 7);
  const out = new Map<string, number>();
  for (const t of tx) {
    if (String(t.transaction_date).slice(0, 7) !== month) continue;
    out.set(t.category_id, (out.get(t.category_id) ?? 0) + (Number(t.amount) || 0));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Bucket list: one-time import from the old dashboard's browser storage */
/* ------------------------------------------------------------------ */

export const OLD_BUCKET_KEY = "saisha_os_bucket";
export const BUCKET_IMPORTED_FLAG = "saisha_bucket_imported_v1";

export interface BucketImport {
  title: string;
  description: string | null;
  completed: boolean;
}

/**
 * Read the old dashboard's bucket list (localStorage JSON) and return the items
 * that aren't in Supabase yet (matched by title, case-insensitive).
 */
export function bucketItemsToImport(raw: string | null, existingTitles: readonly string[]): BucketImport[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const out: BucketImport[] = [];
  for (const it of parsed.slice(0, 200)) {
    if (!it || typeof it !== "object") continue;
    const title = cleanText(String((it as any).title ?? "")).slice(0, 200);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const loc = cleanText(String((it as any).location ?? (it as any).description ?? "")).slice(0, 200);
    out.push({ title, description: loc || null, completed: (it as any).completed === true });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Backup (Settings → Backup)                                          */
/* ------------------------------------------------------------------ */

/**
 * Every table with your data, in restore order (parents before children).
 * Each row has user_id, so restoring can't touch anyone else's data (RLS).
 */
export const BACKUP_TABLES: { table: string; onConflict?: string }[] = [
  { table: "profiles", onConflict: "id" },
  { table: "settings", onConflict: "user_id" },
  { table: "user_settings", onConflict: "user_id,key" },
  { table: "plan_tasks", onConflict: "user_id,id" },
  { table: "planner_days", onConflict: "user_id,date" },
  { table: "daily_list_items", onConflict: "user_id,date,task_id" },
  { table: "task_completions", onConflict: "user_id,task_id" },
  { table: "habit_logs", onConflict: "user_id,date,habit_key" },
  { table: "health_logs", onConflict: "user_id,metric,logged_at" },
  { table: "exercise_logs", onConflict: "user_id,date,exercise_key" },
  { table: "workout_plans", onConflict: "user_id,workout,scope" },
  { table: "journal_entries", onConflict: "user_id,entry_date" },
  { table: "courses" },
  { table: "assignments" },
  { table: "career_projects" },
  { table: "songs" },
  { table: "song_versions" },
  { table: "budgets" },
  { table: "budget_categories" },
  { table: "transactions" },
  { table: "bucket_list" },
  { table: "chat_sessions" },
  { table: "chat_messages" },
];

export interface Backup {
  app: "saisha-os";
  version: 1;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/**
 * Check a backup file and prepare it for restoring into the signed-in account:
 * only known tables, rows must be objects, and user_id (or profiles.id) is
 * replaced with the current user's id.
 */
export function prepareRestore(raw: string, userId: string): { tables: { table: string; onConflict?: string; rows: Record<string, unknown>[] }[]; rows: number } {
  let b: any;
  try {
    b = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!b || b.app !== "saisha-os" || b.version !== 1 || typeof b.tables !== "object") {
    throw new Error("That isn't a Saisha OS backup (made with Settings → Backup).");
  }
  let rows = 0;
  const tables = BACKUP_TABLES.map(({ table, onConflict }) => {
    const list: unknown[] = Array.isArray(b.tables[table]) ? b.tables[table] : [];
    const clean = list
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
      .map((r) => (table === "profiles" ? { ...r, id: userId } : { ...r, user_id: userId }));
    rows += clean.length;
    return { table, onConflict, rows: clean };
  });
  return { tables, rows };
}

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

/** Days until a due date (negative = overdue). */
export function daysUntil(due: string, today: string): number {
  const d = String(due).slice(0, 10);
  let n = 0;
  if (d >= today) {
    for (let x = today; x < d && n < 4000; x = addDays(x, 1)) n++;
    return n;
  }
  for (let x = d; x < today && n < 4000; x = addDays(x, 1)) n++;
  return -n;
}
