import { describe, expect, it } from "vitest";
import {
  ANCHORS,
  anchorMl,
  clampDayMl,
  daysAtGoalThisWeek,
  DRINKS,
  glassesToMl,
  litres,
  mondayOf,
  parseBottleMl,
  waterGoal,
  waterMilestone,
} from "./water";

const week = (monday: string, mls: number[]) => {
  const [y, m, d] = monday.split("-").map(Number);
  return mls.map((ml, i) => [new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10), ml] as const);
};

describe("water goal grows gently", () => {
  const START = "2026-11-18"; // Wednesday; its week starts Mon 16 Nov

  it("starts at 1.25 L", () => {
    expect(waterGoal(new Map(), START, "2026-11-20")).toEqual({ goalMl: 1250, weekStart: "2026-11-16" });
  });

  it("goes up 0.25 L after a week with ≥5 days at the goal", () => {
    const h = new Map(week("2026-11-16", [1250, 1300, 1250, 1500, 1250, 0, 0]));
    expect(waterGoal(h, START, "2026-11-23").goalMl).toBe(1500);
  });

  it("stays the same after a week with only 4 good days (never goes down)", () => {
    const h = new Map([...week("2026-11-16", [1250, 1250, 1250, 1250, 0, 0, 0]), ...week("2026-11-23", [0, 0, 0, 0, 0, 0, 0])]);
    expect(waterGoal(h, START, "2026-11-25").goalMl).toBe(1250);
    expect(waterGoal(h, START, "2026-12-01").goalMl).toBe(1250);
  });

  it("each week is judged against that week's goal, and it stops at 2 L", () => {
    const weeks = ["2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"];
    const h = new Map(weeks.flatMap((w) => week(w, [2000, 2000, 2000, 2000, 2000, 2000, 2000])));
    expect(waterGoal(h, START, "2026-11-30").goalMl).toBe(1750);
    expect(waterGoal(h, START, "2026-12-21").goalMl).toBe(2000);
    // 1.5 L days in the week the goal is 1.75 L don't count
    const h2 = new Map([...week("2026-11-16", Array(7).fill(1500)), ...week("2026-11-23", Array(7).fill(1500)), ...week("2026-11-30", Array(7).fill(1500))]);
    expect(waterGoal(h2, START, "2026-12-07").goalMl).toBe(1750);
    expect(waterGoal(h2, START, "2026-12-14").goalMl).toBe(1750);
  });

  it("counts this week's good days so far", () => {
    const h = new Map(week("2026-11-16", [1300, 0, 1250, 900, 1400, 0, 0]));
    expect(daysAtGoalThisWeek(h, 1250, "2026-11-20")).toBe(3);
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
  });
});

describe("anchors", () => {
  it("each glass anchor adds 250 ml; 'from my bottle' makes it a check-off; refills never add", () => {
    const wake = ANCHORS.find((a) => a.key === "water-wake")!;
    const refill = ANCHORS.find((a) => a.key === "water-refill-1")!;
    expect(anchorMl(wake, false)).toBe(250);
    expect(anchorMl(wake, true)).toBe(0);
    expect(anchorMl(refill, false)).toBe(0);
    expect(ANCHORS.map((a) => a.key)).toEqual(
      expect.arrayContaining(["water-wake", "water-breakfast", "water-lunch", "water-dinner", "water-walk", "water-refill-1", "water-refill-2"]),
    );
  });
});

describe("amounts", () => {
  it("bottle size falls back to 1 L when unset or silly", () => {
    expect(parseBottleMl(750)).toBe(750);
    expect(parseBottleMl(undefined)).toBe(1000);
    expect(parseBottleMl(5)).toBe(1000);
    expect(parseBottleMl("abc")).toBe(1000);
  });

  it("shows litres, clamps a day, converts old glasses", () => {
    expect(litres(1250)).toBe("1.25 L");
    expect(litres(500)).toBe("0.5 L");
    expect(litres(2000)).toBe("2 L");
    expect(clampDayMl(-250)).toBe(0);
    expect(clampDayMl(99999)).toBe(6000);
    expect(glassesToMl(5)).toBe(1250);
    expect(glassesToMl(12)).toBe(2000);
  });

  it("other drinks count", () => {
    expect(DRINKS.map((d) => d.label)).toEqual(
      expect.arrayContaining(["Buttermilk / chaas", "Coconut water", "Nimbu pani (unsweetened)", "Herbal tea", "Soup"]),
    );
  });

  it("chimes at half the goal and at the goal; never when going down", () => {
    expect(waterMilestone(500, 750, 1250)).toBe("half");
    expect(waterMilestone(1000, 1250, 1250)).toBe("full");
    expect(waterMilestone(0, 2000, 1250)).toBe("full");
    expect(waterMilestone(1250, 1500, 1250)).toBeNull();
    expect(waterMilestone(1250, 1000, 1250)).toBeNull();
  });
});
