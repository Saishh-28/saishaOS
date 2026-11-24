/**
 * Study plan for the 2:00–3:30 block, from 24 Nov 2026 to 20 Feb 2027
 * (replaces the old STUDY queue from that date; old tasks stay in the
 * database as history but are no longer offered).
 *
 *   Mon, Wed, Fri  R track        (r4ds.hadley.nz 2nd edition + quarto.org)
 *   Tue, Thu       JS track       (javascript.info → TypeScript handbook → react.dev/learn)
 *   Sat            light review / German (alternating)
 *   Sun            rest
 *
 * One task per session. Each day gets the first unfinished task of its
 * track, so a missed Monday task simply comes back on Wednesday.
 *
 * Task IDs encode the track (study-r-01, study-js-01, study-sat-01) and must
 * stay stable: only ever APPEND to these lists.
 */

export type StudyTrack = "r" | "js" | "sat";

/** First day of the new study plan. Days before it keep the old behaviour. */
export const STUDY_PLAN_START = "2026-11-24";
export const STUDY_PLAN_END = "2027-02-20";

export const TRACK_LABEL: Record<StudyTrack, string> = {
  r: "R (r4ds + Quarto)",
  js: "JavaScript → TypeScript → React",
  sat: "Light review / German",
};

const PRACTICE = [
  "Data visualisation",
  "Data transformation",
  "Tidy data",
  "Data import",
  "Joins",
  "Strings and regular expressions",
  "Factors and dates/times",
  "Functions",
  "Iteration",
  "Quarto",
];

const STATS220_PREVIEW = [
  "file formats and text encodings",
  "XML and XPath",
  "JSON",
  "databases and SQL basics",
  "regular expressions in data work",
  "HTML and CSS for data on the web",
  "web data and APIs",
  "data cleaning and processing in R",
  "how computers store numbers and text",
  "data storage, privacy and ethics",
];

export const R_TRACK: string[] = [
  "Read r4ds 'Workflow: basics' and install R + RStudio",
  "Read r4ds 'Data visualization' with ggplot2 (part 1)",
  "Read r4ds 'Layers' and facets in ggplot2 (part 2)",
  "Read r4ds 'Data transformation': filter, arrange, select",
  "Read r4ds 'Data transformation': mutate, summarise, group_by",
  "Read r4ds 'Data tidying' (tidyr: pivot_longer / pivot_wider)",
  "Read r4ds 'Data import' (readr)",
  "Read r4ds 'Joins'",
  "Read r4ds 'Strings' and 'Regular expressions'",
  "Read r4ds 'Factors' and 'Dates and times'",
  "Read r4ds 'Functions'",
  "Read r4ds 'Iteration' (purrr / across)",
  "Read quarto.org 'Get started' and make your first Quarto report",
  "Read quarto.org HTML output + parameters (dynamic reporting)",
  "Read about JSON and APIs in R (jsonlite / httr2)",
  "Read r4ds 'Web scraping' (rvest)",
  "Read and write an automation script: fetch → clean → report",
  "Mini-project: your Saisha OS CSV → 3 charts → Quarto report",
  "Mini-project 2: scrape/collect a public dataset → cleaned table → HTML report",
  // 20–39: alternate practice and STATS 220 previews until 20 Feb
  ...PRACTICE.flatMap((p, i) => [
    `Practice: redo the '${p}' exercises without notes`,
    `Read STATS 220 topic preview: ${STATS220_PREVIEW[i]}`,
  ]),
];

export const JS_TRACK: string[] = [
  "Read javascript.info: variables, data types, operators",
  "Read javascript.info: conditionals and loops",
  "Read javascript.info: functions and arrow functions",
  "Read javascript.info: objects and arrays",
  "Read javascript.info: array methods (map, filter, reduce)",
  "Read javascript.info: modules (import / export)",
  "Read javascript.info: promises and async/await",
  "Read javascript.info: fetch + JSON",
  "Read TypeScript handbook: 'TypeScript for the New Programmer' + basic types",
  "Read TypeScript handbook: interfaces and type aliases",
  "Read TypeScript handbook: unions and generics (basics)",
  "Read react.dev/learn: Describing the UI (components, JSX, props)",
  "Read react.dev/learn: rendering lists and conditional rendering",
  "Read react.dev/learn: Adding interactivity (state, events)",
  "Read react.dev/learn: Managing state",
  "Read react.dev/learn: Effects (useEffect) basics",
  "Read src/planner/logic.ts (dates, rollover) and explain it in your notes",
  "Read src/planner/logic.ts (fill to 5, gym rotation) and explain it in your notes",
  "Make one small change yourself: change a label, and open a PR you wrote",
  "Read a screen component (BlockScreen in src/planner/screens.tsx) and explain it in your notes",
  "Make one small change yourself: add a habit in src/planner/plan.ts, and open a PR",
  "Read worker/planner/api.ts and explain it in your notes",
  "Read src/planner/validate.ts and explain it in your notes",
  "Make one small change yourself: tweak a screen's text or style, and open a PR",
  "Read src/planner/water.ts and explain it in your notes",
  "Make one small change yourself: add a test to water.test.ts, and open a PR",
];

/** Saturdays from 28 Nov 2026 to 20 Feb 2027: review and German, alternating. */
export const SAT_TRACK: string[] = Array.from({ length: 13 }, (_, i) =>
  i % 2 === 0
    ? "Light review: re-read this week's R + JS notes"
    : "German: read one DW A1 lesson (dw.com/learngerman) + write 3 sentences",
);

export const TRACKS: Record<StudyTrack, string[]> = { r: R_TRACK, js: JS_TRACK, sat: SAT_TRACK };

const TRACK_SORT_BASE: Record<StudyTrack, number> = { r: 10_000, js: 20_000, sat: 30_000 };

export const trackTaskId = (track: StudyTrack, i: number) => `study-${track}-${String(i + 1).padStart(2, "0")}`;

/** The track a study task belongs to, from its ID (null for old or custom tasks). */
export function trackOf(taskId: string): StudyTrack | null {
  const m = /^study-(r|js|sat)-\d{2}$/.exec(taskId);
  return m ? (m[1] as StudyTrack) : null;
}

/** Old study tasks (study-YYYY-MM-DD-n): history only once the new plan starts. */
export function isLegacyStudyId(taskId: string): boolean {
  return /^study-\d{4}-\d{2}-\d{2}-\d+$/.test(taskId);
}

/** 0 = Sunday … 6 = Saturday → that day's track (null = rest). */
export function trackForWeekday(dow: number): StudyTrack | null {
  if (dow === 1 || dow === 3 || dow === 5) return "r";
  if (dow === 2 || dow === 4) return "js";
  if (dow === 6) return "sat";
  return null;
}

export function trackSortOrder(track: StudyTrack, i: number): number {
  return TRACK_SORT_BASE[track] + i;
}
