import { describe, expect, it } from "vitest";
import {
  bestWeightBefore,
  clockIn,
  ExerciseLog,
  isSessionComplete,
  lastWeight,
  parseKg,
  sessionFor,
  STRENGTH,
  timerSegments,
  timerState,
  totalSeconds,
  YOGA,
} from "./gym";
import { currentSlotIndex, dayProgress, habitsOn, ticksOn, csvRows } from "./logic";
import { HABITS, SCHEDULE } from "./plan";
import { buildReport } from "./report";
import { DEFAULT_SETTINGS, parseSettings, tickSound, waterMilestone } from "./sound";

const log = (weightKg: number | null, done = true): ExerciseLog => ({ done, weightKg, sets: 3, reps: null });

describe("gym session by weekday", () => {
  it("Fri 20 Nov 2026 (ISO week 47, odd) is strength Day A, squat day", () => {
    const s = sessionFor("2026-11-20");
    expect(s.kind).toBe("strength");
    expect(s.workout).toBe("A");
    expect(s.title).toBe("Squat day");
    expect(s.items.map((i) => i.key)).toEqual(["squat", "chest-press", "db-row", "hip-thrust", "bicep-curl", "adductor", "dead-bug"]);
  });

  it("Mon/Wed/Fri keep the A/B rotation; Tue/Thu cardio; Sat yoga; Sun rest", () => {
    const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];
    expect(week.map((d) => { const s = sessionFor(d); return s.workout ?? s.kind; })).toEqual(["B", "cardio", "A", "cardio", "B", "yoga", "rest"]);
  });

  it("no push-ups anywhere; deadlift carries its tip; Day B has 8 items", () => {
    const all = [...STRENGTH.A, ...STRENGTH.B].map((i) => i.name.toLowerCase());
    expect(all.some((n) => n.includes("push-up"))).toBe(false);
    expect(STRENGTH.B[0].tip).toMatch(/closing a car door/);
    expect(STRENGTH.B).toHaveLength(8);
  });

  it("yoga has the 16 poses with timers", () => {
    expect(YOGA).toHaveLength(16);
    expect(YOGA.every((p) => p.timer)).toBe(true);
  });

  it("complete only when every item is ticked; rest days never need a tick", () => {
    const s = sessionFor("2026-11-24"); // cardio
    expect(isSessionComplete(s, (k) => k === "cardio")).toBe(false);
    expect(isSessionComplete(s, () => true)).toBe(true);
    expect(isSessionComplete(sessionFor("2026-11-29"), () => true)).toBe(false);
  });
});

describe("weights", () => {
  const logs = new Map<string, Record<string, ExerciseLog>>([
    ["2026-11-16", { squat: log(10) }],
    ["2026-11-18", { squat: log(12.5), deadlift: log(null) }],
    ["2026-11-20", { squat: log(15) }],
  ]);

  it("Last: is the most recent earlier weight, skipping days without one", () => {
    expect(lastWeight(logs, "squat", "2026-11-20")).toEqual({ date: "2026-11-18", weightKg: 12.5 });
    expect(lastWeight(logs, "squat", "2026-11-16")).toBeNull();
    expect(lastWeight(logs, "deadlift", "2026-11-25")).toBeNull();
  });

  it("best weight before a day (for NEW BEST)", () => {
    expect(bestWeightBefore(logs, "squat", "2026-11-20")).toBe(12.5);
  });

  it("parses the kg box", () => {
    expect(parseKg("")).toBeNull();
    expect(parseKg(" 22,5 ")).toBe(22.5);
    expect(parseKg("abc")).toBe("invalid");
    expect(parseKg("900")).toBe("invalid");
  });
});

describe("yoga timer", () => {
  it("two-sided poses switch sides at half time", () => {
    const segs = timerSegments({ seconds: 30, rounds: 1, sides: 2 });
    expect(segs.map((s) => s.label)).toEqual(["Left side", "Switch sides: right"]);
    expect(timerState(segs, 29.5)).toEqual({ index: 0, remaining: 1, finished: false });
    expect(timerState(segs, 30)).toEqual({ index: 1, remaining: 30, finished: false });
    expect(timerState(segs, 60).finished).toBe(true);
  });

  it("rounds with rest in between (Chair 3 × 20 s)", () => {
    const t = { seconds: 20, rounds: 3, sides: 1 as const, restSeconds: 10 };
    expect(timerSegments(t).map((s) => s.label)).toEqual(["Round 1 of 3", "Rest", "Round 2 of 3", "Rest", "Round 3 of 3"]);
    expect(totalSeconds(t)).toBe(80);
  });
});

describe("habits", () => {
  it("adds the two after-meal walks", () => {
    const labels = HABITS.map((h) => h.label);
    expect(labels).toContain("Walk after lunch (10–15 min)");
    expect(labels).toContain("Walk after dinner (10–15 min)");
  });

  it("Sunday needs no gym tick: not counted in progress, CSV or the report", () => {
    expect(habitsOn("2026-11-29").some((h) => h.key === "gym")).toBe(false);
    expect(habitsOn("2026-11-20").some((h) => h.key === "gym")).toBe(true);
    const lists = { deep: [], study: [] };
    expect(dayProgress({ lists, done: new Map(), habits: {}, water: 0, date: "2026-11-29" }).total).toBe(HABITS.length);
    const rows = csvRows([{ date: "2026-11-29", lists, habits: {}, water: 0 }], new Map(), new Map());
    expect(rows.some((r) => r[2] === "Gym / workout")).toBe(false);
    const rep = buildReport({ date: "2026-11-29", lists, tasks: [], done: new Map(), habits: { walkLunch: true }, water: 0, notes: "" });
    expect(rep.habitsDone).toEqual(["Walk after lunch (10–15 min)"]);
    expect(rep.habitsMissed).not.toContain("Gym / workout");
  });
});

describe("tick notes", () => {
  it("counts today's tasks, habits and exercises; the next tick plays the next note", () => {
    const n = ticksOn({
      date: "2026-11-20",
      done: new Map([["a", "2026-11-20"], ["b", "2026-11-19"]]),
      habits: { walk: true, read: false },
      exercises: { squat: log(10), plank: log(null, false) },
    });
    expect(n).toBe(3);
    expect(tickSound(n + 1)).toBe("tick-4");
    expect(tickSound(1)).toBe("tick-1");
    expect(tickSound(9)).toBe("tick-6");
  });

  it("sound settings default to on, 70%, vibration on, and are clamped", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.volume).toBe(0.7);
    expect(parseSettings('{"volume":3,"sound":false}')).toEqual({ sound: false, volume: 1, vibrate: true });
    expect(parseSettings("not json")).toEqual(DEFAULT_SETTINGS);
  });
});

describe("India time", () => {
  it("uses Asia/Kolkata whatever the device zone", () => {
    // 19:00 UTC on the 19th is 00:30 on the 20th in India.
    expect(clockIn(new Date("2026-11-19T19:00:00Z"))).toEqual({ date: "2026-11-20", hour: 0, minute: 30 });
    expect(clockIn(new Date("2026-11-19T18:29:00Z")).date).toBe("2026-11-19");
  });
});

describe("water milestones", () => {
  it("chimes when reaching 4 and 8 glasses, not when going down or past them", () => {
    expect(waterMilestone(3, 4)).toBe("half");
    expect(waterMilestone(7, 8)).toBe("full");
    expect(waterMilestone(2, 8)).toBe("full"); // tapping the 8th glass directly
    expect(waterMilestone(4, 5)).toBeNull();
    expect(waterMilestone(5, 4)).toBeNull();
    expect(waterMilestone(8, 7)).toBeNull();
  });
});

describe("schedule", () => {
  it("8:14 pm is still the 6:30 block; the 8:30 pm evening review comes next", () => {
    const i = currentSlotIndex(20 * 60 + 14);
    expect(SCHEDULE[i].time).toBe("18:30");
    expect(SCHEDULE[i + 1]).toMatchObject({ time: "20:30", link: "review" });
    expect(SCHEDULE[currentSlotIndex(20 * 60 + 40)].label).toMatch(/Evening review/);
  });
});
