/**
 * Anti-hallucination gate for the AI evening review.
 *
 * Gemini (or a tampered client) can return anything. Nothing it says is saved
 * unless it passes through validateAiPlan(), which runs on the server against
 * the user's own plan_tasks / task_completions:
 *   - every ID must exist in the user's plan, be in the right block, and not be done;
 *   - duplicates and anything past AI_MAX_PER_BLOCK are dropped;
 *   - task text always comes from the database, never from the model;
 *   - brand-new tasks are only accepted from the explicit `new` array, and are
 *     saved as custom tasks flagged is_ai (shown with ✨).
 * Everything dropped is reported back with a reason.
 */
import { AI_MAX_PER_BLOCK, BLOCKS, Block } from "./plan";
import { isLegacyStudyId, STUDY_PLAN_START, trackOf } from "./study";
import { studyTrackFor, usesStudyTracks } from "./logic";
import type { Completions, PlanTask } from "./logic";

export interface AcceptedTask {
  id: string;
  text: string; // from the database
}

export interface NewAiTask {
  block: Block;
  text: string;
  reason: string;
}

export interface RejectedItem {
  item: string;
  reason: string;
}

export interface ValidatedPlan {
  lists: Record<Block, AcceptedTask[]>;
  newTasks: NewAiTask[];
  rejected: RejectedItem[];
  note: string;
}

export const NEW_TASK_MIN = 3;
export const NEW_TASK_MAX = 200;
const REASON_MAX = 300;
const NOTE_MAX = 600;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const CONTROL_CHARS = new RegExp("[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]", "g");

/** Collapse whitespace and strip control characters. */
export function cleanText(s: string): string {
  return s
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function show(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return (s ?? String(v)).slice(0, 80);
}

export interface ValidationContext {
  tasks: readonly PlanTask[];
  done: Completions;
  /**
   * The date being planned (tomorrow). When given, a plan task whose phase
   * starts after this date is only accepted once every current-phase task in
   * that block is either done or already picked: future phases only fill gaps.
   */
  planDate?: string;
}

export function validateAiPlan(raw: unknown, ctx: ValidationContext): ValidatedPlan {
  const out: ValidatedPlan = { lists: { deep: [], study: [] }, newTasks: [], rejected: [], note: "" };
  if (!isObj(raw)) {
    out.rejected.push({ item: show(raw), reason: "Response was not a JSON object" });
    return out;
  }

  const byId = new Map(ctx.tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const count: Record<Block, number> = { deep: 0, study: 0 };
  const isFuture = (t: PlanTask) => !!ctx.planDate && !t.isCustom && t.phaseStart > ctx.planDate;

  for (const b of BLOCKS) {
    const ids = raw[b];
    if (ids === undefined) continue;
    if (!Array.isArray(ids)) {
      out.rejected.push({ item: `${b}: ${show(ids)}`, reason: `"${b}" must be a list of task IDs` });
      continue;
    }
    const accept = (t: PlanTask) => {
      if (count[b] >= AI_MAX_PER_BLOCK) {
        out.rejected.push({ item: t.id, reason: `More than ${AI_MAX_PER_BLOCK} ${b} tasks` });
        return;
      }
      count[b]++;
      out.lists[b].push({ id: t.id, text: t.text });
    };

    // Pass 1: basic checks; current-phase tasks are accepted right away, future ones wait.
    const future: PlanTask[] = [];
    for (const v of ids) {
      if (typeof v !== "string" || !v.trim()) {
        out.rejected.push({ item: show(v), reason: "Not a task ID" });
        continue;
      }
      const id = v.trim();
      const t = byId.get(id);
      if (!t) {
        out.rejected.push({ item: id, reason: "ID not in your plan (made up)" });
      } else if (t.block !== b) {
        out.rejected.push({ item: id, reason: `Belongs to ${t.block}, not ${b}` });
      } else if (ctx.done.has(id)) {
        out.rejected.push({ item: id, reason: `Already done on ${ctx.done.get(id)}` });
      } else if (b === "study" && ctx.planDate && usesStudyTracks(ctx.planDate) && isLegacyStudyId(id)) {
        out.rejected.push({ item: id, reason: `Old study plan task (replaced on ${STUDY_PLAN_START})` });
      } else if (b === "study" && ctx.planDate && trackOf(id) && trackOf(id) !== studyTrackFor(ctx.planDate)) {
        out.rejected.push({ item: id, reason: `Not ${ctx.planDate}'s study track` });
      } else if (seen.has(id)) {
        out.rejected.push({ item: id, reason: "Duplicate" });
      } else {
        seen.add(id);
        if (isFuture(t)) future.push(t);
        else accept(t);
      }
    }

    // Pass 2: future-phase tasks only fill gaps once the current phase is used up.
    if (future.length) {
      const unusedCurrent = ctx.tasks.filter(
        (t) => t.block === b && !t.isCustom && !isFuture(t) && !ctx.done.has(t.id) && !seen.has(t.id),
      ).length;
      for (const t of future) {
        if (unusedCurrent > 0) {
          out.rejected.push({
            item: t.id,
            reason: `Future phase (starts ${t.phaseStart}) while ${unusedCurrent} current-phase task${unusedCurrent > 1 ? "s are" : " is"} unused`,
          });
        } else accept(t);
      }
    }
  }

  const fresh = raw.new;
  if (fresh !== undefined && !Array.isArray(fresh)) {
    out.rejected.push({ item: `new: ${show(fresh)}`, reason: `"new" must be a list` });
  } else if (Array.isArray(fresh)) {
    const existingText = new Map<string, string>();
    for (const t of ctx.tasks) existingText.set(`${t.block}:${cleanText(t.text).toLowerCase()}`, t.id);
    const newSeen = new Set<string>();
    for (const n of fresh) {
      if (!isObj(n)) {
        out.rejected.push({ item: show(n), reason: "New task must be an object" });
        continue;
      }
      const block = n.block;
      const text = typeof n.text === "string" ? cleanText(n.text).replace(/^✨\s*/, "") : "";
      const label = `✨ ${text || show(n.text)}`;
      if (block !== "deep" && block !== "study") {
        out.rejected.push({ item: label, reason: `Unknown block ${JSON.stringify(block) ?? String(block)}` });
      } else if (text.length < NEW_TASK_MIN || text.length > NEW_TASK_MAX) {
        out.rejected.push({ item: label, reason: `Text must be ${NEW_TASK_MIN}–${NEW_TASK_MAX} characters` });
      } else if (existingText.has(`${block}:${text.toLowerCase()}`)) {
        out.rejected.push({ item: label, reason: `Same as existing task ${existingText.get(`${block}:${text.toLowerCase()}`)}; use its ID` });
      } else if (newSeen.has(`${block}:${text.toLowerCase()}`)) {
        out.rejected.push({ item: label, reason: "Duplicate" });
      } else if (count[block] >= AI_MAX_PER_BLOCK) {
        out.rejected.push({ item: label, reason: `More than ${AI_MAX_PER_BLOCK} ${block} tasks` });
      } else {
        newSeen.add(`${block}:${text.toLowerCase()}`);
        count[block]++;
        const reason = typeof n.reason === "string" ? cleanText(n.reason).slice(0, REASON_MAX) : "";
        out.newTasks.push({ block, text, reason });
      }
    }
  }

  if (typeof raw.note === "string") out.note = cleanText(raw.note).slice(0, NOTE_MAX);
  return out;
}
