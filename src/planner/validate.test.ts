import { describe, expect, it } from "vitest";
import { buildPlanTasks, PlanTask } from "./logic";
import { validateAiPlan } from "./validate";

const PLAN = buildPlanTasks();
const custom: PlanTask = {
  id: "c-1",
  block: "deep",
  text: "Call the CA",
  phaseStart: "2026-11-19",
  sortOrder: 100_000,
  isCustom: true,
  isAi: false,
};
const tasks = [...PLAN, custom];
const done = new Map([["deep-2026-11-23-0", "2026-11-24"]]);
const v = (raw: unknown) => validateAiPlan(raw, { tasks, done });

describe("AI plan validation (anti-hallucination)", () => {
  it("rejects a made-up ID and never saves it", () => {
    const r = v({ deep: ["deep-2026-11-23-1", "deep-2099-01-01-0", "totally-fake"], study: [] });
    expect(r.lists.deep.map((t) => t.id)).toEqual(["deep-2026-11-23-1"]);
    expect(r.rejected).toEqual([
      { item: "deep-2099-01-01-0", reason: "ID not in your plan (made up)" },
      { item: "totally-fake", reason: "ID not in your plan (made up)" },
    ]);
  });

  it("takes task text from the database, not from the model", () => {
    const r = v({ deep: ["deep-2026-11-23-1"] });
    expect(r.lists.deep[0].text).toBe("GST: learn what a GSTIN is + registration basics");
  });

  it("rejects done tasks, wrong-block tasks and duplicates", () => {
    const r = v({
      deep: ["deep-2026-11-23-0", "study-2026-11-23-0", "deep-2026-11-23-2", "deep-2026-11-23-2"],
      study: ["deep-2026-11-23-3"],
    });
    expect(r.lists.deep.map((t) => t.id)).toEqual(["deep-2026-11-23-2"]);
    expect(r.lists.study).toEqual([]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "Already done on 2026-11-24",
      "Belongs to study, not deep",
      "Duplicate",
      "Belongs to deep, not study",
    ]);
  });

  it("accepts the user's own custom tasks by ID", () => {
    expect(v({ deep: ["c-1"] }).lists.deep).toEqual([{ id: "c-1", text: "Call the CA" }]);
  });

  it("caps each block at 6, counting new tasks", () => {
    const ids = [1, 2, 3, 4, 5].map((i) => `deep-2026-11-23-${i}`);
    const r = v({
      deep: [...ids, "deep-2026-11-23-6"],
      new: [{ block: "deep", text: "Write the CA email", reason: "x" }],
    });
    expect(r.lists.deep).toHaveLength(6);
    expect(r.newTasks).toEqual([]);
    expect(r.rejected).toEqual([{ item: "✨ Write the CA email", reason: "More than 6 deep tasks" }]);

    const seven = v({ study: Array.from({ length: 8 }, (_, i) => `study-2026-11-23-${i}`) });
    expect(seven.lists.study).toHaveLength(6);
    expect(seven.rejected).toHaveLength(2);
  });

  it("only accepts new tasks from the `new` array, cleaned and validated", () => {
    const r = v({
      deep: [],
      new: [
        { block: "deep", text: "  ✨ Draft   pricing\u0007 page ", reason: "Pilot asked for it" },
        { block: "gym", text: "Bench press", reason: "" },
        { block: "study", text: "x", reason: "" },
        { block: "study", text: "a".repeat(201), reason: "" },
        { block: "study", text: "update resume", reason: "dup of plan" },
        "not an object",
      ],
    });
    expect(r.newTasks).toEqual([{ block: "deep", text: "Draft pricing page", reason: "Pilot asked for it" }]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      'Unknown block "gym"',
      "Text must be 3–200 characters",
      "Text must be 3–200 characters",
      "Same as existing task study-2026-11-23-0; use its ID",
      "New task must be an object",
    ]);
  });

  it("handles garbage responses without throwing", () => {
    expect(v("deep-2026-11-23-1").rejected[0].reason).toBe("Response was not a JSON object");
    expect(v(null).lists).toEqual({ deep: [], study: [] });
    const r = v({ deep: "deep-2026-11-23-1", study: [42, null, ""], new: "x" });
    expect(r.lists).toEqual({ deep: [], study: [] });
    expect(r.rejected).toHaveLength(5);
  });

  it("keeps a short, clean note", () => {
    expect(v({ note: "Good day.\n\nRest tomorrow." }).note).toBe("Good day. Rest tomorrow.");
    expect(v({ note: "x".repeat(2000) }).note).toHaveLength(600);
    expect(v({ note: 5 }).note).toBe("");
  });
});
