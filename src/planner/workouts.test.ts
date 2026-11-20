import { describe, expect, it } from "vitest";
import { ExerciseLog, lastWeight, bestWeightBefore } from "./gym";
import {
  addItem,
  ALWAYS,
  alternativesFor,
  applyEdit,
  customKey,
  defaultPlan,
  effectivePlan,
  moveItem,
  parsePlanItems,
  PlanItem,
  planChanges,
  planKey,
  removeItem,
  sessionWithPlans,
  swapItem,
  undoChange,
  WorkoutPlans,
} from "./workouts";

const FRI = "2026-11-20"; // Day A
const MON = "2026-11-23"; // Day B
const WED = "2026-11-25"; // Day A
const keys = (l: readonly PlanItem[]) => l.map((i) => i.key);

/** Apply the rows applyEdit returns, like the store does. */
function save(plans: WorkoutPlans, w: "A" | "B", rows: ReturnType<typeof applyEdit>): WorkoutPlans {
  const next = new Map(plans);
  for (const r of rows) {
    if (r.items) next.set(planKey(w, r.scope), r.items);
    else next.delete(planKey(w, r.scope));
  }
  return next;
}

describe("alternatives", () => {
  it("seeded alternatives come first, then the same muscle group", () => {
    expect(alternativesFor("hip-thrust").slice(0, 3).map((e) => e.key)).toEqual(["deadlift", "glute-bridge", "cable-kickback"]);
    expect(alternativesFor("squat").slice(0, 2).map((e) => e.name)).toEqual(["Leg press", "Bulgarian split squats"]);
    expect(alternativesFor("chest-press").map((e) => e.key)).toEqual(expect.arrayContaining(["incline-press", "machine-fly"]));
    expect(alternativesFor("lat-pulldown").slice(0, 2).map((e) => e.key)).toEqual(["assisted-pullup", "seated-cable-row"]);
    expect(alternativesFor("reverse-lunge").slice(0, 2).map((e) => e.key)).toEqual(["step-up", "split-squat"]);
    expect(alternativesFor("bicep-curl").slice(0, 2).map((e) => e.key)).toEqual(["hammer-curl", "cable-curl"]);
    expect(alternativesFor("squat").some((e) => e.key === "squat")).toBe(false);
  });

  it("no push-ups anywhere", () => {
    for (const k of ["chest-press", "incline-press", "triceps-pushdown"])
      expect(alternativesFor(k).some((e) => /push-?up/i.test(e.name))).toBe(false);
  });
});

describe("swap just today vs always", () => {
  it("just today: only that date changes; the next Day A is back to normal", () => {
    let plans: WorkoutPlans = new Map();
    plans = save(plans, "A", applyEdit(plans, "A", FRI, "today", (l) => swapItem(l, 0, { key: "leg-press" })));
    expect(keys(effectivePlan(plans, "A", FRI))[0]).toBe("leg-press");
    expect(effectivePlan(plans, "A", FRI)[0]).toEqual({ key: "leg-press", planned: "squat" });
    expect(keys(effectivePlan(plans, "A", WED))[0]).toBe("squat");
    expect(sessionWithPlans(FRI, plans).items[0].name).toBe("Leg press");
  });

  it("always: every future Day A shows the replacement; Day B is untouched", () => {
    let plans: WorkoutPlans = new Map();
    plans = save(plans, "A", applyEdit(plans, "A", FRI, "always", (l) => swapItem(l, 3, { key: "glute-bridge" })));
    expect(keys(effectivePlan(plans, "A", WED))[3]).toBe("glute-bridge");
    expect(keys(effectivePlan(plans, "B", MON))).toEqual(keys(defaultPlan("B")));
  });

  it("always also updates today when today has its own changes", () => {
    let plans: WorkoutPlans = new Map();
    plans = save(plans, "A", applyEdit(plans, "A", FRI, "today", (l) => moveItem(l, 1, -1)));
    plans = save(
      plans,
      "A",
      applyEdit(plans, "A", FRI, "always", (l) => swapItem(l, l.findIndex((i) => i.key === "squat"), { key: "leg-press" })),
    );
    expect(keys(effectivePlan(plans, "A", FRI)).slice(0, 2)).toEqual(["chest-press", "leg-press"]);
    expect(keys(effectivePlan(plans, "A", WED)).slice(0, 2)).toEqual(["leg-press", "chest-press"]);
  });

  it("undoing back to the default deletes the row instead of storing a copy", () => {
    let plans: WorkoutPlans = new Map();
    plans = save(plans, "A", applyEdit(plans, "A", FRI, "today", (l) => swapItem(l, 0, { key: "leg-press" })));
    const rows = applyEdit(plans, "A", FRI, "today", (l) => swapItem(l, 0, { key: "squat" }));
    expect(rows).toEqual([{ scope: FRI, items: null }]);
  });

  it("can't put the same exercise twice in one day", () => {
    const l = defaultPlan("A");
    expect(swapItem(l, 0, { key: "chest-press" })).toEqual(l);
    expect(addItem(l, { key: "squat" })).toEqual(l);
  });
});

describe("reorder, add, remove", () => {
  it("moves, adds an extra and removes", () => {
    const l = defaultPlan("B");
    expect(keys(moveItem(l, 0, 1)).slice(0, 2)).toEqual(["lat-pulldown", "deadlift"]);
    expect(moveItem(l, 0, -1)).toEqual(l);
    const added = addItem(l, { key: "lateral-raise" });
    expect(added[added.length - 1]).toEqual({ key: "lateral-raise", planned: null });
    expect(keys(removeItem(l, 7))).not.toContain("plank");
  });

  it("Other…: a typed exercise gets a stable custom key and keeps its name", () => {
    expect(customKey("Cable Pull-Throughs!")).toBe("custom-cable-pull-throughs");
    expect(customKey("   ")).toBeNull();
    const l = swapItem(defaultPlan("A"), 3, { key: customKey("Cable pull-throughs")!, name: "Cable pull-throughs" });
    expect(sessionWithPlans(FRI, new Map([[planKey("A", ALWAYS), l]])).items[3].name).toBe("Cable pull-throughs");
  });
});

describe("history follows the exercise you actually did", () => {
  it("Last: and best weight use the performed exercise, not the planned one", () => {
    const log = (w: number, planned: string): ExerciseLog => ({ done: true, weightKg: w, sets: 3, reps: null, plannedKey: planned });
    const logs = new Map<string, Record<string, ExerciseLog>>([
      ["2026-11-16", { squat: log(20, "squat") }],
      ["2026-11-20", { "leg-press": log(40, "squat") }], // swapped just today
    ]);
    expect(lastWeight(logs, "squat", WED)).toEqual({ date: "2026-11-16", weightKg: 20 });
    expect(lastWeight(logs, "leg-press", WED)).toEqual({ date: "2026-11-20", weightKg: 40 });
    expect(bestWeightBefore(logs, "squat", WED)).toBe(20);
  });
});

describe("My workouts", () => {
  it("lists permanent changes and undoes each one", () => {
    let l = swapItem(defaultPlan("A"), 3, { key: "glute-bridge" });
    l = removeItem(l, 5); // adductor
    l = addItem(l, { key: "lateral-raise" });
    l = moveItem(l, 0, 1);
    const changes = planChanges("A", l);
    expect(changes).toEqual(
      expect.arrayContaining([
        { kind: "swapped", planned: "hip-thrust", key: "glute-bridge", name: undefined },
        { kind: "added", key: "lateral-raise", name: undefined },
        { kind: "removed", planned: "adductor" },
        { kind: "reordered" },
      ]),
    );
    let undone = l;
    for (const c of planChanges("A", l)) undone = undoChange("A", undone, c);
    expect(undone).toEqual(defaultPlan("A"));
    expect(planChanges("A", defaultPlan("A"))).toEqual([]);
  });

  it("drops malformed rows from the database", () => {
    expect(
      parsePlanItems([{ key: "squat", planned: "squat" }, { key: "DROP TABLE", planned: null }, "x", { key: "leg-press", planned: null, name: 5 }]),
    ).toEqual([
      { key: "squat", planned: "squat" },
      { key: "leg-press", planned: null },
    ]);
    expect(parsePlanItems("nope")).toBeNull();
  });
});
