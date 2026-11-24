import { describe, expect, it } from "vitest";
import {
  bestWeek,
  calendarLine,
  dayTone,
  journeyWeek,
  journeyWeeks,
  levelUpDays,
  monthAverage,
  monthCells,
  monthName,
  shiftMonth,
  skillGrowth,
  xpInMonth,
} from "./calendar";
import { XpEvent } from "./game";

const PCT: Record<string, number> = { "2026-11-19": 100, "2026-11-20": 95, "2026-11-21": 77, "2026-11-23": 59, "2026-11-24": 40 };
const dayOn = (d: string) => (new Date(d + "T12:00:00Z").getUTCDay() === 0 ? { pct: 0, rest: true } : { pct: PCT[d] ?? 0, rest: false });
const ev = (date: string, amount: number, skill: XpEvent["skill"] = "mind"): XpEvent => ({ eventKey: date + amount + skill, source: "x", skill, amount, date, reason: "" });

describe("journey", () => {
  it("13 weeks from 19 Nov; the last runs to 20 Feb (fly to NZ)", () => {
    expect(journeyWeek("2026-11-19")).toBe(1);
    expect(journeyWeek("2026-11-25")).toBe(1);
    expect(journeyWeek("2026-11-26")).toBe(2);
    expect(journeyWeek("2027-02-20")).toBe(13);
    const w = journeyWeeks(dayOn, "2026-11-24");
    expect(w).toHaveLength(13);
    expect(w[0]).toEqual({ n: 1, start: "2026-11-19", end: "2026-11-25", pct: 83, current: true }); // (100+95+77+59)/4: Sunday is rest, today (40% so far) not finished
    expect(w[1].pct).toBeNull();
    expect(w[12]).toMatchObject({ start: "2027-02-11", end: "2027-02-20" });
    expect(bestWeek(w)!.n).toBe(1);
  });
});

describe("month grid", () => {
  it("Monday-first, with blanks before the 1st", () => {
    const nov = monthCells("2026-11"); // 1 Nov 2026 is a Sunday
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(nov.filter(Boolean)).toHaveLength(30);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(monthName("2026-12")).toBe("December 2026");
  });

  it("colours: ≥ 80% gold, 50–79% aqua, < 50% dim, rest, today, future, outside the journey", () => {
    const t = "2026-11-24";
    expect(dayTone("2026-11-19", t, dayOn("2026-11-19"))).toBe("gold");
    expect(dayTone("2026-11-21", t, dayOn("2026-11-21"))).toBe("aqua");
    expect(dayTone("2026-11-23", t, dayOn("2026-11-23"))).toBe("aqua");
    expect(dayTone("2026-11-22", t, dayOn("2026-11-22"))).toBe("rest");
    expect(dayTone("2026-11-24", t, dayOn("2026-11-24"))).toBe("today");
    expect(dayTone("2026-11-25", t, null)).toBe("future");
    expect(dayTone("2026-11-18", t, null)).toBe("outside");
  });

  it("month average leaves out rest days, today and days outside the journey", () => {
    expect(monthAverage(dayOn, "2026-11", "2026-11-24")).toBe(83);
    expect(monthAverage(dayOn, "2026-12", "2026-11-24")).toBeNull();
  });
});

describe("XP in the calendar", () => {
  const events = [ev("2026-11-19", 160), ev("2026-11-20", 150, "body"), ev("2026-12-01", 30), ev("2026-12-02", -10)];
  it("XP earned this month (minus rows count)", () => {
    expect(xpInMonth(events, "2026-11")).toBe(310);
    expect(xpInMonth(events, "2026-12")).toBe(20);
  });

  it("level-up days: Level 2 at 100 XP, Level 3 at 300", () => {
    expect([...levelUpDays(events)]).toEqual([
      ["2026-11-19", 2],
      ["2026-11-20", 3],
    ]);
  });

  it("skill growth this month, most XP first, with levels gained", () => {
    const g = skillGrowth(events, "2026-11");
    expect(g[0]).toEqual({ skill: "mind", xp: 160, gain: 1, level: 2 });
    expect(g[1]).toEqual({ skill: "body", xp: 150, gain: 1, level: 2 });
    expect(calendarLine(bestWeek(journeyWeeks(dayOn, "2026-11-24")), g)).toBe("Your brightest week: 19 Nov–25 Nov at 83%. Mind grew fastest this month!");
  });
});
