import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek } from "./logic";
import { ExerciseLog, sessionFor, STRENGTH, YOGA } from "./gym";
import {
  isComebackWeek,
  L1_NOTE,
  levelOn,
  repRange,
  sessionAtLevel,
  suggestWeight,
  trackLevel,
  withStored,
} from "./training";

/** Gym ticks on every strength (or yoga) day from `from` to `to`, except `skip`. */
function ticks(from: string, to: string, kind: "strength" | "yoga", skip: string[] = []) {
  const m = new Map<string, Record<string, boolean>>();
  for (let d = from; d <= to; d = addDays(d, 1)) if (sessionFor(d).kind === kind && !skip.includes(d)) m.set(d, { gym: true });
  return m;
}
const merge = (...ms: Map<string, Record<string, boolean>>[]) => new Map(ms.flatMap((m) => [...m]));

describe("strength and yoga levels (checked on Mondays, last 4 full weeks)", () => {
  it("12 of 12 strength sessions from 23 Nov → Level 2 on Monday 21 Dec", () => {
    const h = ticks("2026-11-23", "2026-12-20", "strength");
    expect(trackLevel(h, "strength", "2026-12-20").level).toBe(1);
    const t = trackLevel(h, "strength", "2026-12-21");
    expect(t.level).toBe(2);
    expect(t.history.at(-1)).toEqual({ level: 2, since: "2026-12-21", sessions: 12 });
  });

  it("10 of 12 is enough; 9 isn't", () => {
    const all = ticks("2026-11-23", "2026-12-20", "strength");
    const days = [...all.keys()];
    expect(trackLevel(ticks("2026-11-23", "2026-12-20", "strength", days.slice(0, 2)), "strength", "2026-12-21").level).toBe(2);
    expect(trackLevel(ticks("2026-11-23", "2026-12-20", "strength", days.slice(0, 3)), "strength", "2026-12-21").level).toBe(1);
  });

  it("needs ≥ 4 weeks at the current level before the next one; max Level 3", () => {
    const h = ticks("2026-11-23", "2027-04-30", "strength");
    const t = trackLevel(h, "strength", "2027-04-30");
    expect(t.history.map((s) => [s.level, s.since])).toEqual([
      [1, "2026-11-19"],
      [2, "2026-12-21"],
      [3, "2027-01-18"],
    ]);
    expect(levelOn(t, "2027-01-17")).toBe(2);
    expect(levelOn(t, "2027-01-18")).toBe(3);
  });

  it("yoga: 3 of 4 Saturdays", () => {
    const h = ticks("2026-11-23", "2026-12-20", "yoga", ["2026-11-28"]);
    expect(trackLevel(h, "yoga", "2026-12-21").level).toBe(2);
    expect(trackLevel(ticks("2026-11-23", "2026-12-20", "yoga", ["2026-11-28", "2026-12-05"]), "yoga", "2026-12-21").level).toBe(1);
  });

  it("never down: a level you reached stays even if old ticks change", () => {
    const t = trackLevel(new Map(), "strength", "2027-01-10");
    expect(withStored(t, { level: 2, since: "2026-12-21" })).toMatchObject({ level: 2, since: "2026-12-21" });
    expect(withStored(t, undefined).level).toBe(1);
  });

  it("shows how the next check is going", () => {
    const t = trackLevel(ticks("2026-11-23", "2026-11-27", "strength"), "strength", "2026-11-27");
    expect(t.window).toEqual({ done: 3, need: 10, of: 12, checkOn: "2026-11-30" });
  });
});

describe("Comeback week", () => {
  it("fewer than 3 of 6 strength sessions in the two weeks before → comeback (only once two full weeks have passed)", () => {
    const two = ticks("2026-11-23", "2026-12-06", "strength", ["2026-11-25", "2026-11-27", "2026-12-02", "2026-12-04"]);
    expect([...two.keys()]).toHaveLength(2);
    expect(isComebackWeek(two, "2026-12-08")).toBe(true);
    const three = merge(two, new Map([["2026-12-04", { gym: true }]]));
    expect(isComebackWeek(three, "2026-12-08")).toBe(false);
    expect(isComebackWeek(new Map(), "2026-12-01")).toBe(false); // only one full week so far
  });
});

describe("sessions by level", () => {
  const strengthA = { kind: "strength" as const, workout: "A" as const, title: "", subtitle: "", items: STRENGTH.A };
  const yoga = { kind: "yoga" as const, workout: null, title: "", subtitle: "", items: YOGA };

  it("Strength L1: light weights, focus on form; L3: squats, deadlifts, hip thrusts, chest press, lat pulldown → 4 sets", () => {
    expect(sessionAtLevel(strengthA, { strength: 1, yoga: 1 }).items[0].plan).toBe(`3 × 8–10 · ${L1_NOTE}`);
    expect(sessionAtLevel(strengthA, { strength: 2, yoga: 1 }).items[0].plan).toBe("3 × 8–10");
    const l3 = sessionAtLevel(strengthA, { strength: 3, yoga: 1 }).items;
    expect(l3.find((i) => i.key === "squat")).toMatchObject({ sets: 4, plan: "4 × 8–10" });
    expect(l3.find((i) => i.key === "hip-thrust")).toMatchObject({ sets: 4, plan: "4 × 12" });
    expect(l3.find((i) => i.key === "bicep-curl")).toMatchObject({ sets: 3, plan: "3 × 12" });
  });

  it("Yoga L2: every hold +15 s, Sun salutation × 4; L3: + Warrior I 30 s/side and Pigeon 45 s/side, Sun salutation × 5", () => {
    expect(sessionAtLevel(yoga, { strength: 1, yoga: 1 }).items).toBe(YOGA);
    const l2 = sessionAtLevel(yoga, { strength: 1, yoga: 2 }).items;
    expect(l2.find((i) => i.key === "yoga-chair")).toMatchObject({ plan: "3 × 35 s", timer: { seconds: 35, rounds: 3 } });
    expect(l2.find((i) => i.key === "yoga-low-lunge")!.plan).toBe("1 min each side");
    expect(l2.find((i) => i.key === "yoga-cat-cow")!.plan).toBe("1 min 15 s");
    expect(l2.find((i) => i.key === "yoga-sun-a")!.timer!.rounds).toBe(4);
    expect(l2).toHaveLength(YOGA.length);
    const l3 = sessionAtLevel(yoga, { strength: 1, yoga: 3 }).items;
    expect(l3).toHaveLength(YOGA.length + 2);
    expect(l3.find((i) => i.key === "yoga-sun-a")!.timer!.rounds).toBe(5);
    const keys = l3.map((i) => i.key);
    expect(keys.indexOf("yoga-warrior-1")).toBe(keys.indexOf("yoga-warrior-2") + 1);
    expect(l3.find((i) => i.key === "yoga-pigeon")!.plan).toBe("45 s each side");
  });
});

describe("weight suggestions and double progression", () => {
  const squat = STRENGTH.A[0]; // 3 × 8–10
  const log = (kg: number, reps: number | null): ExerciseLog => ({ done: true, weightKg: kg, sets: 3, reps });
  it("reads rep ranges", () => {
    expect(repRange("3 × 8–10")).toEqual({ lo: 8, hi: 10 });
    expect(repRange("3 × 10 each arm")).toEqual({ lo: 10, hi: 10 });
    expect(repRange("3 × 30 s")).toBeNull();
  });

  it("Level 1: no suggestion (light weights, focus on form)", () => {
    const logs = new Map([["2026-11-23", { squat: log(10, 10) }]]);
    expect(suggestWeight(logs, squat, "2026-11-25", { level: 1, comeback: false })).toBeNull();
  });

  it("Level 2: same weight until two sessions in a row hit the top of the range, then +2.5 kg (squats) and back to 8 reps", () => {
    const one = new Map([["2026-12-21", { squat: log(10, 10) }]]);
    expect(suggestWeight(one, squat, "2026-12-23", { level: 2, comeback: false })).toMatchObject({ kg: 10, why: "same" });
    const two = new Map([...one, ["2026-12-23", { squat: log(10, 10) }]]);
    expect(suggestWeight(two, squat, "2026-12-25", { level: 2, comeback: false })).toEqual({
      kg: 12.5,
      reps: 8,
      why: "progress",
      text: "Ready to progress: 12.5 kg × 8",
    });
    const missed = new Map([...one, ["2026-12-23", { squat: log(10, 9) }]]);
    expect(suggestWeight(missed, squat, "2026-12-25", { level: 2, comeback: false })!.why).toBe("same");
    const curl = STRENGTH.A.find((i) => i.key === "bicep-curl")!;
    const curls = new Map([["2026-12-21", { "bicep-curl": log(5, 12) }], ["2026-12-23", { "bicep-curl": log(5, 12) }]]);
    expect(suggestWeight(curls, curl, "2026-12-25", { level: 2, comeback: false })!.kg).toBe(6);
  });

  it("Comeback week (any level): about 80% of last time, rounded to 0.5 kg", () => {
    const logs = new Map([["2026-11-23", { squat: log(12, 8) }]]);
    expect(suggestWeight(logs, squat, "2026-12-09", { level: 1, comeback: true })).toMatchObject({ kg: 9.5, why: "comeback" });
  });
});

it("helper sanity: strength days are Mon/Wed/Fri", () => {
  expect([...ticks("2026-11-23", "2026-11-29", "strength").keys()].map(dayOfWeek)).toEqual([1, 3, 5]);
});
