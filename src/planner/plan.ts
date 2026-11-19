/**
 * Daily Planner plan data, ported from docs/planner-prototype.html.
 *
 * Task IDs are derived from position: `${block}-${phaseStart}-${index}`.
 * They must stay stable, because completions, daily lists and the
 * prototype backup all refer to them. Only ever APPEND to a phase array;
 * never insert, reorder or delete entries.
 */

export type Block = "deep" | "study";
export const BLOCKS: Block[] = ["deep", "study"];

export interface Phase {
  start: string; // YYYY-MM-DD
  name: string;
}

export const PHASES: Phase[] = [
  { start: "2026-11-19", name: "Setup days" },
  { start: "2026-11-23", name: "Learn GST + talk to customers" },
  { start: "2026-12-07", name: "Build version 1" },
  { start: "2027-01-04", name: "Pilots with 3 users" },
  { start: "2027-02-01", name: "First paying customer + write-up" },
];

export const DEEP: Record<string, string[]> = {
  "2026-11-19": [
    "Oppo: allow MacroDroid background activity + auto-launch + lock in recents",
    "Set scheduled power off 21:30 / on 6:55 and test it",
    "Make Spotify playlists: morning, gym, focus, sleep",
    "Build MacroDroid macros (morning, focus, evening)",
    "Host this planner on GitHub Pages and add it to home screen",
    "Put up vision board on the wall",
  ],
  "2026-11-23": [
    "GST: watch ClearTax 'GST Basics' videos",
    "GST: learn what a GSTIN is + registration basics",
    "GST: input tax credit videos (part 1)",
    "GST: input tax credit videos (part 2)",
    "GST portal tutorials: GSTR-1, GSTR-2B, GSTR-3B, IMS",
    "Explain GST to Dad using the shirt example",
    "Write down 10 GST questions you still have",
    "Ask the family CA if you can shadow them",
    "Dad: check Optum outside-business policy",
    "List 15 CA firms + shop owners to interview",
    "Write CA interview questions",
    "Customer interviews 1–3",
    "Customer interviews 4–6",
    "Customer interviews 7–10",
    "Shadow CA: day 1 notes",
    "Shadow CA: day 2 notes",
    "Try competitors: ClearTax + Zoho Books",
    "Try competitors: Tally + Vyapar",
    "Write a 1-page findings summary",
    "Decide with Dad: customer, first feature, success metric",
  ],
  "2026-12-07": [
    "Get anonymised invoices + GSTR-2B from pilot firm",
    "Python: load GSTR-2B data into pandas",
    "Python: extract invoice fields from PDFs/photos with an LLM",
    "Build exact invoice matching",
    "Add fuzzy matching (INV-044 vs 44)",
    "Generate mismatch report (CSV/Excel)",
    "Draft supplier WhatsApp message templates",
    "Agent loop: detect mismatch → message supplier → follow up",
    "Test on one full month of pilot data",
    "Demo v1 to pilot firm, note feedback",
    "Fix top 3 feedback issues",
  ],
  "2027-01-04": [
    "Onboard pilot firm 2",
    "Onboard pilot firm 3",
    "Measure time before vs after for each pilot",
    "Set up WhatsApp Business API account",
    "Weekly pilot check-ins",
    "Collect pilot testimonials",
  ],
  "2027-02-01": [
    "Decide pricing with Dad",
    "Ask pilots to convert to paid",
    "Set things up so you can run it from NZ",
    "Write GitHub README with screenshots",
    "Record 2-minute demo video",
    "Write LinkedIn post",
    "Update resume with real numbers",
  ],
};

export const STUDY: Record<string, string[]> = {
  "2026-11-19": ["Email COMPSCI 130 coordinator about tutoring", "Save CV + transcript as PDFs"],
  "2026-11-23": [
    "Update resume",
    "Update LinkedIn",
    "Book of Proof ch.1 (+3 exercises)",
    "Learn: call an LLM API from Python",
    "Book of Proof ch.2 (+3 exercises)",
    "Learn: tool use / function calling",
    "Book of Proof ch.3 (+3 exercises)",
    "Build a tiny agent in Python",
    "Book of Proof ch.4 (+3 exercises)",
    "Book of Proof ch.5 (+3 exercises)",
    "Book of Proof ch.6 (+3 exercises)",
  ],
  "2026-12-07": [
    "Install R + RStudio",
    "R4DS: data visualisation with ggplot2 (part 1)",
    "R4DS: ggplot2 (part 2)",
    "R4DS: dplyr filter + arrange",
    "R4DS: dplyr mutate + summarise + group_by",
    "R4DS: importing CSV / JSON",
    "R4DS: make your first Quarto report",
    "Mini-project: habit data → 2 charts → Quarto report",
    "Check uni email for maths dept tutor invitation",
    // Added for Saisha OS (appended so the prototype's IDs 0–8 are unchanged):
    "Saisha OS: Supabase tables + RLS for the planner",
    "Saisha OS: daily list logic (rollover + fill to 5)",
    "Saisha OS: Today/Deep/Study/Habits/Gym screens",
    "Saisha OS: Gemini evening review + validation",
    "Saisha OS: import prototype backup + deploy",
  ],
  "2027-01-04": [
    "3Blue1Brown Essence of Calculus ep. 1–4",
    "3Blue1Brown Essence of Calculus ep. 5–8",
    "3Blue1Brown Essence of Calculus ep. 9–12",
    "Stat 110 lectures 1–2",
    "Stat 110 lectures 3–4",
    "Stat 110 lectures 5–6",
    "LeetCode: 3 easy problems (week 1)",
    "LeetCode: 3 easy problems (week 2)",
    "LeetCode: 3 easy problems (week 3)",
  ],
  "2027-02-01": [
    "COMPSCI 220 textbook ch.1 (Big-O)",
    "Mark Wilson COMPSCI 220 videos (first few)",
    "COMPSCI 220 textbook ch.2",
    "LeetCode: 3 problems",
    "UoA Scientific handover plan",
    "Pack for NZ (fly 20 Feb)",
  ],
};

/**
 * Where each habit is stored.
 * - "habit": public.habit_logs (habit_key = key)
 * - "health": the existing public.health_logs row Sanctuary already uses,
 *   so the planner and Sanctuary always show the same value.
 */
export type HabitStore = { kind: "habit" } | { kind: "health"; metric: string };

export interface Habit {
  key: string;
  label: string;
  store: HabitStore;
}

export const HABITS: Habit[] = [
  { key: "gym", label: "Gym / workout", store: { kind: "habit" } },
  { key: "walk", label: "11 am walk with Dad", store: { kind: "habit" } },
  { key: "steps", label: "10k steps", store: { kind: "habit" } },
  { key: "walkLunch", label: "Walk after lunch (10–15 min)", store: { kind: "habit" } },
  { key: "walkDinner", label: "Walk after dinner (10–15 min)", store: { kind: "habit" } },
  { key: "skinAM", label: "Skincare AM", store: { kind: "health", metric: "skin_morning_done" } },
  { key: "skinPM", label: "Skincare PM", store: { kind: "health", metric: "skin_night_done" } },
  { key: "protein", label: "Protein at every meal", store: { kind: "habit" } },
  { key: "teach", label: "Teach brother (5–6:30)", store: { kind: "habit" } },
  { key: "read", label: "Read 20 pages (Deep Work)", store: { kind: "habit" } },
  { key: "phone", label: "Phone away by 9:30", store: { kind: "habit" } },
];

/** Water lives in Sanctuary's health_logs row (metric water_cups). */
export const WATER_METRIC = "water_cups";
export const WATER_MAX = 8;

export type ScheduleLink = Block | "gym" | "habits" | "review" | null;
export interface ScheduleSlot {
  time: string; // HH:MM, 24h
  label: string;
  link: ScheduleLink;
}

export const SCHEDULE: ScheduleSlot[] = [
  { time: "07:00", label: "Wake up, water, sunlight, skincare", link: null },
  { time: "07:30", label: "Gym", link: "gym" },
  { time: "08:30", label: "Breakfast with protein", link: null },
  { time: "09:00", label: "Deep work 1", link: "deep" },
  { time: "11:00", label: "Walk with Dad (~7k steps)", link: "habits" },
  { time: "12:00", label: "Deep work 2", link: "deep" },
  { time: "13:00", label: "Lunch + water, then a 10–15 min walk", link: "habits" },
  { time: "14:00", label: "Course prep & career", link: "study" },
  { time: "15:30", label: "Free time / rest", link: null },
  { time: "17:00", label: "Teach your brother", link: null },
  { time: "18:30", label: "Evening steps, reading", link: "habits" },
  { time: "20:30", label: "Evening review: plan tomorrow", link: "review" },
  { time: "21:00", label: "Sleep playlist, skincare", link: null },
  { time: "21:30", label: "Phone off", link: null },
  { time: "22:00", label: "Sleep", link: null },
];

export type WorkoutDay = "A" | "B";
/** Habit that needs no tick on rest days (Sunday). */
export const GYM_HABIT = "gym";
export interface Exercise {
  name: string;
  sets: string;
}

/**
 * LEGACY: the prototype's workout. Only used to read gym ticks from old
 * prototype backups. The current sessions live in gym.ts.
 */
export const WORKOUT: Record<WorkoutDay, Exercise[]> = {
  A: [
    { name: "Goblet squats", sets: "3 × 10" },
    { name: "Dumbbell rows", sets: "3 × 10" },
    { name: "Push-ups (knees ok)", sets: "3 × 8–12" },
    { name: "Hip thrusts", sets: "3 × 12" },
    { name: "Plank", sets: "3 × 30 s" },
  ],
  B: [
    { name: "Romanian deadlifts", sets: "3 × 10" },
    { name: "Shoulder press", sets: "3 × 10" },
    { name: "Lunges", sets: "3 × 10 each leg" },
    { name: "Lat pulldown", sets: "3 × 10" },
    { name: "Dead bugs", sets: "3 × 10" },
  ],
};

/** Max tasks the daily list is auto-filled to. */
export const DAILY_TARGET = 5;
/** Max tasks per block the AI review may propose. */
export const AI_MAX_PER_BLOCK = 6;
