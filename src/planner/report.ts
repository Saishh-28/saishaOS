/**
 * Evening review report. Pure, shared by the Review screen and (Stage 3) the
 * Worker, which rebuilds it from the database rather than trusting the client.
 */
import { BLOCKS, Block } from "./plan";
import { litres } from "./water";
import { addDays, Completions, DayLists, habitsOn, PlanTask, queueFor, upcoming } from "./logic";

export interface ReportTask {
  id: string;
  text: string;
}
export interface ReportNextTask extends ReportTask {
  phaseStart: string;
  future: boolean; // phase hasn't started by tomorrow
}
export interface ReportBlock {
  done: ReportTask[];
  notDone: ReportTask[];
  next: ReportNextTask[];
}
export interface DailyReport {
  date: string;
  tomorrow: string;
  blocks: Record<Block, ReportBlock>;
  habitsDone: string[];
  habitsMissed: string[];
  /** ml */
  water: number;
  /** This week's goal in ml, when known. */
  waterGoalMl: number | null;
  notes: string;
}

export const REPORT_NEXT_COUNT = 8;

/** "1.25 L of 1.5 L goal" */
export function waterText(r: Pick<DailyReport, "water" | "waterGoalMl">): string {
  return r.waterGoalMl ? `${litres(r.water)} of ${litres(r.waterGoalMl)} goal` : litres(r.water);
}

export function buildReport(args: {
  date: string;
  lists: DayLists;
  tasks: readonly PlanTask[];
  done: Completions;
  habits: Readonly<Record<string, boolean>>;
  water: number;
  waterGoalMl?: number | null;
  notes?: string | null;
}): DailyReport {
  const { date, lists, tasks, done, habits } = args;
  const tomorrow = addDays(date, 1);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const text = (id: string) => byId.get(id)?.text ?? "(removed task)";
  const blocks = {} as Record<Block, ReportBlock>;
  for (const b of BLOCKS) {
    const inList = new Set(lists[b].map((i) => i.taskId));
    blocks[b] = {
      done: lists[b].filter((i) => done.has(i.taskId)).map((i) => ({ id: i.taskId, text: text(i.taskId) })),
      notDone: lists[b].filter((i) => !done.has(i.taskId)).map((i) => ({ id: i.taskId, text: text(i.taskId) })),
      next: upcoming(queueFor(tasks, b), done, inList, REPORT_NEXT_COUNT).map((t) => ({
        id: t.id,
        text: t.text,
        phaseStart: t.phaseStart,
        future: t.phaseStart > tomorrow,
      })),
    };
  }
  return {
    date,
    tomorrow,
    blocks,
    habitsDone: habitsOn(date).filter((h) => habits[h.key]).map((h) => h.label),
    habitsMissed: habitsOn(date).filter((h) => !habits[h.key]).map((h) => h.label),
    water: args.water,
    waterGoalMl: args.waterGoalMl ?? null,
    notes: (args.notes ?? "").trim(),
  };
}

const BLOCK_NAME: Record<Block, string> = { deep: "DEEP WORK", study: "COURSE PREP" };

/** Plain-text version, same layout as the prototype's report. */
export function reportToText(r: DailyReport): string {
  const L: string[] = [`DAILY REPORT ${r.date} (plan for ${r.tomorrow})`, ""];
  for (const b of BLOCKS) {
    const x = r.blocks[b];
    L.push(`${BLOCK_NAME[b]}: ${x.done.length}/${x.done.length + x.notDone.length} done`);
    x.done.forEach((t) => L.push(`  DONE      ${t.id} | ${t.text}`));
    x.notDone.forEach((t) => L.push(`  NOT DONE  ${t.id} | ${t.text}`));
    L.push("  NEXT IN PLAN:");
    x.next.forEach((t) => L.push(`  ${t.id} | ${t.text}${t.future ? ` (future phase, starts ${t.phaseStart})` : ""}`));
    L.push("");
  }
  L.push(`HABITS: ${r.habitsDone.length}/${r.habitsDone.length + r.habitsMissed.length} · water ${waterText(r)}`);
  if (r.habitsMissed.length) L.push(`  Missed: ${r.habitsMissed.join("; ")}`);
  L.push("", `MY NOTES FOR TOMORROW: ${r.notes || "(none)"}`);
  return L.join("\n");
}
