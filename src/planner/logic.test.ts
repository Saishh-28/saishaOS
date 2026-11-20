import { describe, expect, it } from "vitest";
import {
  addDays,
  backupToImportPlan,
  buildPlanTasks,
  Completions,
  createDayLists,
  csvRows,
  dayProgress,
  DayLists,
  isoWeek,
  isWorkoutComplete,
  parsePrototypeBackup,
  phaseFor,
  PlanTask,
  previousDate,
  pullNext,
  queueFor,
  removeFromDay,
  toCsv,
  upcoming,
  workoutFor,
  gymKey,
  currentSlotIndex,
} from "./logic";
import { STUDY, WORKOUT, HABITS, SCHEDULE } from "./plan";

const PLAN = buildPlanTasks();
const done = (entries: Record<string, string> = {}): Completions => new Map(Object.entries(entries));
const ids = (items: { taskId: string }[]) => items.map((i) => i.taskId);
const custom = (id: string, block: "deep" | "study", text = "My task"): PlanTask => ({
  id,
  block,
  text,
  phaseStart: "2026-11-19",
  sortOrder: 100_000,
  isCustom: true,
  isAi: false,
});

describe("plan seed", () => {
  it("keeps the prototype's stable IDs", () => {
    const byId = new Map(PLAN.map((t) => [t.id, t]));
    expect(byId.get("deep-2026-11-19-0")?.text).toMatch(/^Oppo: allow MacroDroid/);
    expect(byId.get("deep-2026-11-23-4")?.text).toBe("GST portal tutorials: GSTR-1, GSTR-2B, GSTR-3B, IMS");
    expect(byId.get("study-2026-12-07-8")?.text).toBe("Check uni email for maths dept tutor invitation");
    expect(new Set(PLAN.map((t) => t.id)).size).toBe(PLAN.length);
  });

  it("appends the 5 Saisha OS study tasks in the 2026-12-07 phase without shifting old IDs", () => {
    const saisha = PLAN.filter((t) => t.text.startsWith("Saisha OS:"));
    expect(saisha.map((t) => t.id)).toEqual([9, 10, 11, 12, 13].map((i) => `study-2026-12-07-${i}`));
    expect(saisha.every((t) => t.phaseStart === "2026-12-07" && t.block === "study")).toBe(true);
    expect(STUDY["2026-12-07"]).toHaveLength(14);
  });

  it("orders each queue by phase, then position", () => {
    const q = queueFor(PLAN, "deep");
    expect(q[0].id).toBe("deep-2026-11-19-0");
    expect(q[6].id).toBe("deep-2026-11-23-0");
    for (let i = 1; i < q.length; i++) expect(q[i].phaseStart >= q[i - 1].phaseStart).toBe(true);
  });
});

describe("phase-date filtering", () => {
  it("fills with tasks whose phase has started first, then future-phase gap fillers", () => {
    const day = createDayLists({ date: "2026-11-19", tasks: PLAN, done: done(), prev: null });
    expect(ids(day.deep)).toEqual([0, 1, 2, 3, 4].map((i) => `deep-2026-11-19-${i}`));
    // Only 2 study tasks exist in the first phase; the next phase fills the other 3 slots.
    expect(ids(day.study)).toEqual(["study-2026-11-19-0", "study-2026-11-19-1", "study-2026-11-23-0", "study-2026-11-23-1", "study-2026-11-23-2"]);
  });

  it("includes a phase on its exact start date", () => {
    const allSetupDone = done(Object.fromEntries(PLAN.filter((t) => t.phaseStart === "2026-11-19").map((t) => [t.id, "2026-11-20"])));
    // Before the next phase starts, its tasks fill the gap instead of leaving the day empty.
    expect(ids(createDayLists({ date: "2026-11-22", tasks: PLAN, done: allSetupDone, prev: null }).deep)).toEqual(
      [0, 1, 2, 3, 4].map((i) => `deep-2026-11-23-${i}`),
    );
    const day = createDayLists({ date: "2026-11-23", tasks: PLAN, done: allSetupDone, prev: null });
    expect(ids(day.deep)[0]).toBe("deep-2026-11-23-0");
  });

  it("skips done tasks", () => {
    const day = createDayLists({
      date: "2026-11-19",
      tasks: PLAN,
      done: done({ "deep-2026-11-19-0": "2026-11-18", "deep-2026-11-19-2": "2026-11-18" }),
      prev: null,
    });
    // 4 setup tasks left, so the next phase's first task fills the 5th slot.
    expect(ids(day.deep)).toEqual(["deep-2026-11-19-1", "deep-2026-11-19-3", "deep-2026-11-19-4", "deep-2026-11-19-5", "deep-2026-11-23-0"]);
  });

  it("phaseFor picks the latest phase that has started", () => {
    expect(phaseFor("2026-11-19").name).toBe("Setup days");
    expect(phaseFor("2026-12-06").name).toBe("Learn GST + talk to customers");
    expect(phaseFor("2026-12-07").name).toBe("Build version 1");
    expect(phaseFor("2027-02-19").name).toBe("First paying customer + write-up");
  });
});

describe("rollover + fill to 5", () => {
  const prev: DayLists = {
    deep: [
      { taskId: "deep-2026-11-19-0", carriedOver: false },
      { taskId: "deep-2026-11-19-1", carriedOver: false },
      { taskId: "c-123", carriedOver: false },
    ],
    study: [{ taskId: "study-2026-11-19-0", carriedOver: false }],
  };
  const tasks = [...PLAN, custom("c-123", "deep", "Call the CA")];

  it("carries unfinished tasks first, marked carriedOver, then fills from the queue", () => {
    const day = createDayLists({ date: "2026-11-20", tasks, done: done({ "deep-2026-11-19-0": "2026-11-19" }), prev });
    expect(day.deep).toEqual([
      { taskId: "deep-2026-11-19-1", carriedOver: true },
      { taskId: "c-123", carriedOver: true },
      { taskId: "deep-2026-11-19-2", carriedOver: false },
      { taskId: "deep-2026-11-19-3", carriedOver: false },
      { taskId: "deep-2026-11-19-4", carriedOver: false },
    ]);
    expect(day.study).toEqual([
      { taskId: "study-2026-11-19-0", carriedOver: true },
      { taskId: "study-2026-11-19-1", carriedOver: false },
      // gap fillers from the next phase
      { taskId: "study-2026-11-23-0", carriedOver: false },
      { taskId: "study-2026-11-23-1", carriedOver: false },
      { taskId: "study-2026-11-23-2", carriedOver: false },
    ]);
  });

  it("never duplicates a carried task when filling", () => {
    const day = createDayLists({ date: "2026-11-20", tasks, done: done(), prev });
    expect(new Set(ids(day.deep)).size).toBe(day.deep.length);
    expect(day.deep).toHaveLength(5);
  });

  it("keeps all carried tasks even when there are more than 5", () => {
    const big: DayLists = { deep: [0, 1, 2, 3, 4, 5].map((i) => ({ taskId: `deep-2026-11-19-${i}`, carriedOver: false })), study: [] };
    const day = createDayLists({ date: "2026-11-20", tasks: PLAN, done: done(), prev: big });
    expect(day.deep).toHaveLength(6);
    expect(day.deep.every((i) => i.carriedOver)).toBe(true);
  });

  it("drops carried tasks that were deleted or are in the wrong block", () => {
    const bad: DayLists = {
      deep: [{ taskId: "c-gone", carriedOver: false }, { taskId: "study-2026-11-19-0", carriedOver: false }],
      study: [],
    };
    const day = createDayLists({ date: "2026-11-20", tasks: PLAN, done: done(), prev: bad });
    expect(ids(day.deep)).not.toContain("c-gone");
    expect(ids(day.deep)).not.toContain("study-2026-11-19-0");
  });

  it("uses the most recent previous day, not just yesterday", () => {
    expect(previousDate(["2026-11-17", "2026-11-19", "2026-11-25"], "2026-11-22")).toBe("2026-11-19");
    expect(previousDate(["2026-11-25"], "2026-11-22")).toBeNull();
  });
});

describe("pull next / remove", () => {
  const q = queueFor(PLAN, "study");

  it("pulls the next eligible task in order", () => {
    const items = [{ taskId: "study-2026-11-19-0", carriedOver: false }];
    const r = pullNext(items, q, "2026-11-19", done());
    expect(r.added?.id).toBe("study-2026-11-19-1");
    expect(r.early).toBe(false);
  });

  it("pulls from a future phase when the current one is empty", () => {
    const items = [
      { taskId: "study-2026-11-19-0", carriedOver: false },
      { taskId: "study-2026-11-19-1", carriedOver: false },
    ];
    const r = pullNext(items, q, "2026-11-19", done());
    expect(r.added?.id).toBe("study-2026-11-23-0");
    expect(r.early).toBe(true);
    expect(r.items).toHaveLength(3);
  });

  it("returns nothing when the whole plan is done", () => {
    const all = done(Object.fromEntries(q.map((t) => [t.id, "2026-11-19"])));
    expect(pullNext([], q, "2026-11-19", all).added).toBeNull();
  });

  it("a removed plan task goes back into the queue; a removed custom task is deleted", () => {
    const items = [{ taskId: "study-2026-11-19-0", carriedOver: false }];
    const r = removeFromDay(items, { id: "study-2026-11-19-0", isCustom: false });
    expect(r).toEqual({ items: [], deleteTask: false });
    expect(pullNext(r.items, q, "2026-11-19", done()).added?.id).toBe("study-2026-11-19-0");
    expect(removeFromDay([{ taskId: "c-1", carriedOver: false }], { id: "c-1", isCustom: true }).deleteTask).toBe(true);
  });

  it("upcoming lists next not-done tasks, including future phases", () => {
    const next = upcoming(q, done({ "study-2026-11-19-1": "2026-11-19" }), new Set(["study-2026-11-19-0"]), 3);
    expect(next.map((t) => t.id)).toEqual(["study-2026-11-23-0", "study-2026-11-23-1", "study-2026-11-23-2"]);
  });
});

describe("gym A/B rotation", () => {
  it("computes ISO weeks correctly, including year boundaries", () => {
    expect(isoWeek("2026-11-23")).toBe(48);
    expect(isoWeek("2026-11-30")).toBe(49);
    expect(isoWeek("2026-12-31")).toBe(53); // 2026 has 53 ISO weeks
    expect(isoWeek("2027-01-04")).toBe(1);
    expect(isoWeek("2025-12-29")).toBe(1); // belongs to 2026's week 1
  });

  it("even ISO week = B, A, B on Mon/Wed/Fri", () => {
    expect(workoutFor("2026-11-23")).toBe("B"); // Mon, week 48
    expect(workoutFor("2026-11-25")).toBe("A"); // Wed
    expect(workoutFor("2026-11-27")).toBe("B"); // Fri
  });

  it("odd ISO week = A, B, A on Mon/Wed/Fri", () => {
    expect(workoutFor("2026-11-30")).toBe("A"); // Mon, week 49
    expect(workoutFor("2026-12-02")).toBe("B"); // Wed
    expect(workoutFor("2026-12-04")).toBe("A"); // Fri
  });

  it("Tue/Thu/Sat/Sun are rest days", () => {
    for (const d of ["2026-11-24", "2026-11-26", "2026-11-28", "2026-11-29"]) expect(workoutFor(d)).toBeNull();
  });

  it("matches the prototype across the 53-week year boundary", () => {
    expect(workoutFor("2027-01-01")).toBe("A"); // Fri, week 53 (odd)
    expect(workoutFor("2027-01-04")).toBe("A"); // Mon, week 1 (odd)
  });

  it("a workout is complete only when every exercise is ticked", () => {
    const ticks: Record<string, boolean> = {};
    WORKOUT.A.forEach((_, i) => (ticks[gymKey("A", i)] = i < 4));
    expect(isWorkoutComplete("A", ticks)).toBe(false);
    ticks[gymKey("A", 4)] = true;
    expect(isWorkoutComplete("A", ticks)).toBe(true);
    expect(isWorkoutComplete("B", ticks)).toBe(false);
  });
});

describe("today view helpers", () => {
  it("highlights the slot that contains the current time", () => {
    expect(currentSlotIndex(6 * 60)).toBe(-1);
    expect(currentSlotIndex(9 * 60 + 30)).toBe(3); // Deep work 1
    expect(SCHEDULE[currentSlotIndex(23 * 60)].label).toBe("Sleep");
  });

  it("progress counts tasks, habits and a full water bottle", () => {
    const lists: DayLists = { deep: [{ taskId: "a", carriedOver: false }], study: [{ taskId: "b", carriedOver: false }] };
    const p = dayProgress({ lists, done: done({ a: "2026-11-19" }), habits: { gym: true }, water: 8 });
    expect(p.total).toBe(2 + HABITS.length + 1);
    expect(p.done).toBe(3);
  });

  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("CSV export", () => {
  it("writes date, category, item, done with proper quoting", () => {
    const byId = new Map(PLAN.map((t) => [t.id, t]));
    const lists: DayLists = { deep: [{ taskId: "deep-2026-11-23-0", carriedOver: false }], study: [] };
    const rows = csvRows(
      [
        { date: "2026-11-24", lists, habits: {}, water: 3 },
        { date: "2026-11-23", lists, habits: { walk: true }, water: 8 },
      ],
      byId,
      done({ "deep-2026-11-23-0": "2026-11-24" }),
    );
    expect(rows[0]).toEqual(["date", "category", "item", "done"]);
    // Sorted by date; carried task is 0 on the 23rd and 1 on the day it was finished.
    expect(rows[1]).toEqual(["2026-11-23", "deep", "GST: watch ClearTax 'GST Basics' videos", 0]);
    expect(rows.find((r) => r[0] === "2026-11-24" && r[1] === "deep")?.[3]).toBe(1);
    expect(rows.find((r) => r[0] === "2026-11-23" && r[2] === "11 am walk with Dad")?.[3]).toBe(1);
    expect(rows.find((r) => r[0] === "2026-11-23" && r[1] === "water")?.[3]).toBe(8);
    expect(toCsv([["a", 'say "hi"']])).toBe('"a","say ""hi"""');
  });
});

describe("prototype backup import", () => {
  const backup = JSON.stringify({
    days: {
      "2026-11-19": {
        deep: ["deep-2026-11-19-0", "c-1"],
        study: ["study-2026-11-19-0"],
        carried: [],
        habits: { gym: true, skinAM: true },
        water: 5,
        gymLog: { A0: true, A1: true, Z9: true },
      },
      "2026-11-20": {
        deep: ["c-1", "c-deleted"],
        study: [],
        carried: ["c-1"],
        habits: {},
        water: 12,
        fromAI: true,
      },
    },
    done: { "deep-2026-11-19-0": "2026-11-19", "c-gone": "2026-11-19" },
    custom: { "c-1": { text: "✨ Call Sharma & Co CA", block: "deep" } },
  });

  it("parses and converts a real backup", () => {
    const plan = backupToImportPlan(parsePrototypeBackup(backup), PLAN);
    expect(plan.customTasks).toEqual([
      expect.objectContaining({ id: "c-1", block: "deep", phaseStart: "2026-11-19", isCustom: true, isAi: true }),
    ]);
    expect(plan.days[0].lists.deep).toEqual([
      { taskId: "deep-2026-11-19-0", carriedOver: false },
      { taskId: "c-1", carriedOver: false },
    ]);
    expect(plan.days[1].lists.deep).toEqual([{ taskId: "c-1", carriedOver: true }]);
    expect(plan.days[0].habits.skinAM).toBe(true);
    expect(plan.days[0].gymTicks).toEqual({ "gym:A:0": true, "gym:A:1": true });
    expect(plan.days[1].water).toBe(8); // clamped
    expect(plan.days[1].fromAi).toBe(true);
    expect(plan.completions).toEqual([{ taskId: "deep-2026-11-19-0", doneDate: "2026-11-19" }]);
    expect(plan.skipped.join("\n")).toMatch(/c-deleted/);
    expect(plan.skipped.join("\n")).toMatch(/c-gone/);
  });

  it("is safe to run twice (custom tasks already present are not re-created)", () => {
    const first = backupToImportPlan(parsePrototypeBackup(backup), PLAN);
    const second = backupToImportPlan(parsePrototypeBackup(backup), [...PLAN, ...first.customTasks]);
    expect(second.customTasks).toEqual([]);
    expect(second.days[0].lists.deep).toHaveLength(2);
  });

  it("rejects things that aren't backups", () => {
    expect(() => parsePrototypeBackup("not json")).toThrow(/valid JSON/);
    expect(() => parsePrototypeBackup("{}")).toThrow(/days/);
    expect(() => parsePrototypeBackup({ days: { "2026-13-45": { deep: [], study: [] } } })).toThrow(/Bad date/);
  });
});
