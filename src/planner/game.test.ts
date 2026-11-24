import { describe, expect, it } from "vitest";
import {
  dayPct,
  earnedXp,
  GameData,
  kingdomLine,
  levelInfo,
  reconcileXp,
  streakInfo,
  ticksToCount,
  titleFor,
  totalXpFor,
  XpEvent,
  xpTotals,
} from "./game";
import { PlanTask } from "./logic";

const task = (id: string, block: "deep" | "study"): PlanTask => ({ id, block, text: id, phaseStart: "2026-11-19", sortOrder: 0, isCustom: false, isAi: false });

function data(over: Partial<GameData> = {}): GameData {
  return {
    tasks: [task("deep-1", "deep"), task("study-r-01", "study")],
    done: new Map(),
    days: new Map(),
    habits: new Map(),
    water: new Map(),
    exercises: new Map(),
    ...over,
  };
}
const goal = () => 1250;
const TODAY = "2026-11-25"; // Wednesday

/** Apply reconcile's output, as the app does. */
const settle = (d: GameData, events: XpEvent[] = []) => [...events, ...reconcileXp(earnedXp(d, TODAY, goal), events)];

describe("earning XP", () => {
  it("task +10 (deep → Business, study → Mind), habit +5 by skill, water goal +10 Glow", () => {
    const e = earnedXp(
      data({
        done: new Map([["deep-1", "2026-11-24"], ["study-r-01", "2026-11-25"]]),
        habits: new Map([["2026-11-24", { teach: true, steps: true, skinAM: true, read: true, "water-wake": true }]]),
        water: new Map([["2026-11-24", 1250], ["2026-11-25", 1000]]),
      }),
      TODAY,
      goal,
    );
    const t = xpTotals(e.map((x) => ({ ...x, eventKey: x.source })));
    expect(t.bySkill).toEqual({ business: 10, mind: 10 + 5, family: 5, body: 5, glow: 5 + 10 });
    expect(t.total).toBe(50); // the water anchor tick itself isn't a habit
  });

  it("workouts by the day's session: strength +30, cardio +20, yoga +25 (Body); the gym habit gives no extra +5", () => {
    const e = earnedXp(
      data({ habits: new Map([["2026-11-23", { gym: true }], ["2026-11-24", { gym: true }], ["2026-11-21", { gym: true }], ["2026-11-22", { gym: true }]]) }),
      TODAY,
      goal,
    );
    expect(e.map((x) => [x.date, x.amount, x.skill])).toEqual([
      ["2026-11-23", 30, "body"],
      ["2026-11-24", 20, "body"],
      ["2026-11-21", 25, "body"],
    ]); // Sunday 22 Nov is rest: nothing
  });

  it("evening review approved +10 (the next day was saved from the review); personal best +15", () => {
    const e = earnedXp(
      data({
        days: new Map([["2026-11-25", { lists: { deep: [], study: [] }, fromAi: true }], ["2026-11-24", { lists: { deep: [], study: [] }, fromAi: false }]]),
        exercises: new Map([
          ["2026-11-20", { squat: { done: true, weightKg: 10, sets: 3, reps: 10 } }],
          ["2026-11-23", { squat: { done: true, weightKg: 12, sets: 3, reps: 10 } }],
          ["2026-11-25", { squat: { done: true, weightKg: 12, sets: 3, reps: 10 } }],
        ]),
      }),
      TODAY,
      goal,
    );
    expect(e.map((x) => x.source)).toEqual(["review:2026-11-24", "pb:2026-11-23:squat"]);
  });

  it("nothing before 19 Nov or after today counts", () => {
    const e = earnedXp(data({ habits: new Map([["2026-11-18", { steps: true }], ["2026-11-26", { steps: true }]]) }), TODAY, goal);
    expect(e).toEqual([]);
  });
});

describe("storing XP (rows are only added)", () => {
  it("backfill writes one row per source; running again writes nothing", () => {
    const d = data({ done: new Map([["deep-1", "2026-11-24"]]), habits: new Map([["2026-11-24", { steps: true }]]) });
    const first = settle(d);
    expect(first.map((e) => e.eventKey)).toEqual(["task:deep-1#0", "habit:2026-11-24:steps#0"]);
    expect(reconcileXp(earnedXp(d, TODAY, goal), first)).toEqual([]);
  });

  it("untick adds a minus row; tick again adds a new plus row; the total is never double-counted", () => {
    const ticked = data({ done: new Map([["deep-1", "2026-11-24"]]) });
    const a = settle(ticked);
    const b = settle(data(), a);
    expect(b.at(-1)).toMatchObject({ eventKey: "task:deep-1#1", amount: -10 });
    expect(xpTotals(b).total).toBe(0);
    const c = settle(ticked, b);
    expect(c.at(-1)).toMatchObject({ eventKey: "task:deep-1#2", amount: 10 });
    expect(xpTotals(c).total).toBe(10);
  });

  it("two phones making the same change produce the same key (the database keeps one)", () => {
    const d = data({ done: new Map([["deep-1", "2026-11-24"]]) });
    expect(settle(d)[0].eventKey).toBe(settle(d)[0].eventKey);
  });
});

describe("levels", () => {
  it("level n needs 100 × n XP for the next; titles by band", () => {
    expect([0, 99, 100, 299, 300, 600, 1000].map((x) => levelInfo(x).level)).toEqual([1, 1, 2, 2, 3, 4, 5]);
    expect(totalXpFor(5)).toBe(1000);
    expect(levelInfo(350)).toMatchObject({ level: 3, into: 50, needed: 300, pct: 16 });
    expect([1, 4, 5, 9, 10, 14, 15, 30].map(titleFor)).toEqual([
      "Apprentice",
      "Apprentice",
      "Dreamweaver",
      "Dreamweaver",
      "Starkeeper",
      "Starkeeper",
      "Guardian of the Kingdom",
      "Guardian of the Kingdom",
    ]);
  });
});

describe("streaks that forgive", () => {
  const run = (pcts: number[], start = "2026-11-19") => {
    const dates = pcts.map((_, i) => new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10));
    const by = new Map(dates.map((d, i) => [d, pcts[i]]));
    return streakInfo((d) => by.get(d) ?? 0, dates.at(-1)!, start);
  };

  it("a day counts at ≥ 60%", () => {
    expect(run([60, 59, 80]).current).toBe(2);
  });

  it("one miss is forgiven; two in a row break it", () => {
    expect(run([80, 80, 10, 80]).current).toBe(3);
    expect(run([80, 80, 10, 10, 80]).current).toBe(1);
  });

  it("every 7 good days earn a shield (max 3) that saves a second miss", () => {
    const s = run([...Array(7).fill(80), 0, 0, 80]);
    expect(s.current).toBe(8);
    expect(s.shields).toBe(0);
    expect([...s.marks.values()].slice(7, 9)).toEqual(["grace", "shield"]);
    expect(run(Array(28).fill(80)).shields).toBe(3);
  });

  it("today only counts once it's good; yesterday's forgiven miss puts the streak at risk", () => {
    const s = run([80, 80, 0, 20]);
    expect(s.current).toBe(2);
    expect(s.atRisk).toBe(true);
    expect(s.marks.has("2026-11-22")).toBe(false);
  });

  it("a day's % comes from its list, habits and water; days with no list are 0%", () => {
    const d = data({
      done: new Map([["deep-1", "2026-11-24"]]),
      days: new Map([["2026-11-24", { lists: { deep: [{ taskId: "deep-1", carriedOver: false }], study: [] }, fromAi: false }]]),
    });
    expect(dayPct(d, "2026-11-24", 1250)).toBe(8); // 1 of 13 (1 task + 11 habits + water)
    expect(dayPct(d, "2026-11-23", 1250)).toBe(0);
    expect(ticksToCount(1, 13)).toBe(7);
    expect(ticksToCount(9, 13)).toBe(0);
  });
});

describe("Lumi on the kingdom", () => {
  const streak = { current: 4, best: 4, shields: 0, marks: new Map(), atRisk: false };
  it("warns gently when the streak is at risk, then cheers near a level, else the usual line", () => {
    expect(kingdomLine({ level: levelInfo(150), streak: { ...streak, atRisk: true }, ticksLeft: 2, fallback: "x" })).toMatch(/2 more ticks today keeps your 4-day streak/);
    expect(kingdomLine({ level: levelInfo(280), streak, ticksLeft: 5, fallback: "x" })).toMatch(/Only 20 XP until Level 3/);
    expect(kingdomLine({ level: levelInfo(150), streak, ticksLeft: 1, fallback: "x" })).toBe("1 more tick and today counts for your streak.");
    expect(kingdomLine({ level: levelInfo(150), streak, ticksLeft: 6, fallback: "x" })).toBe("x");
  });
});
