import { describe, expect, it, vi } from "vitest";
import { buildPlanTasks, createDayLists, DayLists, pullNext, queueForDate, studyTrackFor, upgradeStudyItems } from "./logic";
import { buildReport } from "./report";
import { validateAiPlan } from "./validate";
import { isLegacyStudyId, JS_TRACK, R_TRACK, SAT_TRACK, trackOf } from "./study";
import { handlePlannerApi, PlannerDeps } from "../../worker/planner/api";

const PLAN = buildPlanTasks();
const none = new Map<string, string>();
const ids = (l: { taskId: string }[]) => l.map((i) => i.taskId);
const empty: DayLists = { deep: [], study: [] };

describe("the new study plan", () => {
  it("has 39 R tasks, 26 JS/TS/React tasks and 13 Saturdays; every R/JS task is a reading, practice or own-change task", () => {
    expect(R_TRACK).toHaveLength(39);
    expect(JS_TRACK).toHaveLength(26);
    expect(SAT_TRACK).toHaveLength(13);
    expect(R_TRACK[0]).toMatch(/^Read r4ds 'Workflow: basics'/);
    expect(R_TRACK[17]).toMatch(/Saisha OS CSV → 3 charts → Quarto report/);
    expect(R_TRACK[19]).toMatch(/^Practice: redo/);
    expect(R_TRACK[20]).toMatch(/^Read STATS 220 topic preview/);
    expect(JS_TRACK[0]).toMatch(/^Read javascript\.info: variables/);
    expect(JS_TRACK[16]).toMatch(/src\/planner\/logic\.ts/);
    expect([...R_TRACK, ...JS_TRACK].every((t) => /^(Read|Practice|Mini-project|Make one small change)/.test(t))).toBe(true);
    expect(SAT_TRACK[0]).toMatch(/^Light review/);
    expect(SAT_TRACK[1]).toBe("German: read one DW A1 lesson (dw.com/learngerman) + write 3 sentences");
  });

  it("Mon/Wed/Fri = R, Tue/Thu = JS, Sat = review/German, Sun = rest; starts 24 Nov", () => {
    const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"];
    expect(week.map(studyTrackFor)).toEqual([null, "js", "r", "js", "r", "sat", null, "r"]);
  });

  it("one task per session: the first unfinished task of that day's track", () => {
    expect(ids(createDayLists({ date: "2026-11-24", tasks: PLAN, done: none, prev: empty }).study)).toEqual(["study-js-01"]);
    expect(ids(createDayLists({ date: "2026-11-25", tasks: PLAN, done: none, prev: empty }).study)).toEqual(["study-r-01"]);
    expect(ids(createDayLists({ date: "2026-11-28", tasks: PLAN, done: none, prev: empty }).study)).toEqual(["study-sat-01"]);
    expect(createDayLists({ date: "2026-11-29", tasks: PLAN, done: none, prev: empty }).study).toEqual([]);
  });

  it("a missed R task comes back on the next R day; JS days aren't affected", () => {
    const mon = createDayLists({ date: "2026-11-30", tasks: PLAN, done: new Map([["study-r-01", "2026-11-25"]]), prev: empty });
    expect(ids(mon.study)).toEqual(["study-r-02"]);
    // Tuesday still gets the JS task, not Monday's unfinished R task
    const tue = createDayLists({ date: "2026-12-01", tasks: PLAN, done: new Map([["study-r-01", "2026-11-25"]]), prev: mon });
    expect(ids(tue.study)).toEqual(["study-js-01"]);
    const wed = createDayLists({ date: "2026-12-02", tasks: PLAN, done: new Map([["study-r-01", "2026-11-25"]]), prev: tue });
    expect(ids(wed.study)).toEqual(["study-r-02"]);
  });

  it("your own unfinished study tasks still carry over; old plan tasks don't", () => {
    const tasks = [...PLAN, { id: "c-1", block: "study" as const, text: "Email tutor", phaseStart: "2026-11-23", sortOrder: 100000, isCustom: true, isAi: false }];
    const prev: DayLists = { deep: [], study: [{ taskId: "c-1", carriedOver: false }, { taskId: "study-2026-11-23-2", carriedOver: true }] };
    expect(createDayLists({ date: "2026-11-25", tasks, done: none, prev }).study).toEqual([
      { taskId: "c-1", carriedOver: true },
      { taskId: "study-r-01", carriedOver: false },
    ]);
  });

  it("days before 24 Nov keep the old study queue", () => {
    expect(ids(createDayLists({ date: "2026-11-23", tasks: PLAN, done: none, prev: empty }).study).every(isLegacyStudyId)).toBe(true);
  });

  it("today's list made with the old plan switches once: unfinished old tasks out, JS #1 in; finished ones stay", () => {
    const items = ["study-2026-11-23-2", "study-2026-11-23-3", "study-2026-11-19-0"].map((taskId) => ({ taskId, carriedOver: true }));
    const done = new Map([["study-2026-11-19-0", "2026-11-24"]]);
    const next = upgradeStudyItems(items, PLAN, "2026-11-24", done)!;
    expect(ids(next)).toEqual(["study-2026-11-19-0", "study-js-01"]);
    expect(upgradeStudyItems(next, PLAN, "2026-11-24", done)).toBeNull(); // only once
    expect(upgradeStudyItems(items, PLAN, "2026-11-23", done)).toBeNull(); // not before the start
  });

  it("'pull next' takes the next task of the same track", () => {
    const r = pullNext([{ taskId: "study-js-01", carriedOver: false }], queueForDate(PLAN, "study", "2026-11-24"), "2026-11-24", none);
    expect(r.added?.id).toBe("study-js-02");
  });
});

describe("evening review follows the tracks", () => {
  it("the report offers only tomorrow's track for study", () => {
    const r = buildReport({ date: "2026-11-24", lists: empty, tasks: PLAN, done: none, habits: {}, water: 0 });
    expect(r.studyTrackTomorrow).toBe("r");
    expect(r.blocks.study.next.map((t) => t.id)).toEqual(["study-r-01", "study-r-02", "study-r-03"]);
    expect(r.blocks.deep.next.length).toBeGreaterThan(3);
  });

  it("validation rejects old study tasks and other days' tracks", () => {
    const v = validateAiPlan({ deep: [], study: ["study-2026-11-23-2", "study-js-01", "study-r-01"] }, { tasks: PLAN, done: none, planDate: "2026-11-25" });
    expect(v.lists.study.map((t) => t.id)).toEqual(["study-r-01"]);
    expect(v.rejected.map((x) => x.reason)).toEqual(["Old study plan task (replaced on 2026-11-24)", "Not 2026-11-25's study track"]);
  });

  it("tonight's review (24 Nov): Gemini can only pick R tasks for Wednesday; the default plan is R #1", async () => {
    const deps: PlannerDeps = {
      verifyUser: vi.fn(async () => "u1"),
      loadData: vi.fn(async () => ({ tasks: PLAN, done: none, lists: { deep: [], study: [{ taskId: "study-js-01", carriedOver: false }] }, habits: {}, water: 0, tomorrowHasList: false })),
      askGemini: vi.fn(async () => ({ text: '{"deep":[],"study":[],"new":[],"note":""}', model: "m" })),
      saveTomorrow: vi.fn(async () => {}),
      now: () => new Date("2026-11-24T15:00:00Z"),
    };
    const req = new Request("https://x.test/api/planner/review", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ date: "2026-11-24" }) });
    const body: any = await (await handlePlannerApi(req, "/api/planner/review", deps)).json();
    const [system, prompt, allowed] = (deps.askGemini as any).mock.calls[0];
    expect(allowed.study.every((id: string) => id === "study-js-01" || trackOf(id) === "r")).toBe(true);
    expect(prompt).toContain('"study_track": "R (r4ds + Quarto)"');
    expect(system).toMatch(/Course prep \("study"\) is ONE session/);
    expect(body.plan.lists.study.map((t: any) => t.id)).toEqual(["study-r-01"]);
  });

  it("Saturday night: Sunday is a rest day, so an empty study list is right (no retry, no default)", async () => {
    const deps: PlannerDeps = {
      verifyUser: vi.fn(async () => "u1"),
      loadData: vi.fn(async () => ({ tasks: PLAN, done: none, lists: { deep: [], study: [{ taskId: "study-sat-01", carriedOver: false }] }, habits: {}, water: 0, tomorrowHasList: false })),
      askGemini: vi.fn(async () => ({ text: '{"deep":["deep-2026-11-23-0"],"study":[],"new":[],"note":"Rest well"}', model: "m" })),
      saveTomorrow: vi.fn(async () => {}),
      now: () => new Date("2026-11-28T15:00:00Z"),
    };
    const req = new Request("https://x.test/api/planner/review", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ date: "2026-11-28" }) });
    const body: any = await (await handlePlannerApi(req, "/api/planner/review", deps)).json();
    expect((deps.askGemini as any).mock.calls).toHaveLength(1);
    expect(body.source).toBe("ai");
    expect(body.plan.lists.study).toEqual([]);
    expect((deps.askGemini as any).mock.calls[0][1]).toContain('"study_track": "rest"');
  });
});
