import { describe, expect, it } from "vitest";
import { earnedXp, reconcileXp } from "./game";
import { mealsFor, mealXp, nextMeal, SEED_MEAL_PLAN } from "./meals";

const data = (meals: Parameters<typeof mealXp>[0]) => ({
  tasks: [],
  done: new Map(),
  days: new Map(),
  habits: new Map(),
  water: new Map(),
  exercises: new Map(),
  meals,
});

describe("meals", () => {
  it("seeds your 7 eggetarian menus × 4 meals", () => {
    expect(SEED_MEAL_PLAN).toHaveLength(28);
    expect(SEED_MEAL_PLAN.some((r) => /chicken|fish|mutton|meat|prawn/i.test(r.text))).toBe(false);
  });

  it("today's meals by weekday (Wed 25 Nov)", () => {
    expect(mealsFor(SEED_MEAL_PLAN, "2026-11-25").map((m) => m.text)).toEqual([
      "Hung curd + berries + chia + nuts",
      "Salad → chole + mixed veg + 1–2 rotis",
      "Apple + peanut butter",
      "Paneer/tofu tikka + grilled veg + small bowl quinoa",
    ]);
    expect(mealsFor(SEED_MEAL_PLAN, "2026-11-29")[0].text).toBe("1 paneer paratha + curd + 1 egg"); // Sunday
    expect(mealsFor([], "2026-11-29")[0].text).toBe("");
  });

  it("next meal: by time of day, skipping ones already logged", () => {
    expect(nextMeal([], "2026-11-25", 8 * 60)).toBe("breakfast");
    expect(nextMeal([], "2026-11-25", 13 * 60)).toBe("lunch");
    expect(nextMeal([{ date: "2026-11-25", slot: "lunch", ate: "plan", note: null }], "2026-11-25", 13 * 60)).toBe("snack");
    const all = (["breakfast", "lunch", "snack", "dinner"] as const).map((slot) => ({ date: "2026-11-25", slot, ate: "other" as const, note: null }));
    expect(nextMeal(all, "2026-11-25", 20 * 60)).toBeNull();
  });

  it("+5 Glow per meal logged, either choice; removing a log takes it back", () => {
    const logs = [
      { date: "2026-11-25", slot: "breakfast" as const, ate: "plan" as const, note: null },
      { date: "2026-11-25", slot: "lunch" as const, ate: "other" as const, note: "Family dinner out" },
    ];
    const e = earnedXp(data(logs), "2026-11-25", () => 1250).filter((x) => x.source.startsWith("meal:"));
    expect(e.map((x) => [x.source, x.amount, x.skill])).toEqual([
      ["meal:2026-11-25:breakfast", 5, "glow"],
      ["meal:2026-11-25:lunch", 5, "glow"],
    ]);
    const stored = reconcileXp(e, []);
    const after = reconcileXp(earnedXp(data([logs[0]]), "2026-11-25", () => 1250), stored);
    expect(after).toEqual([expect.objectContaining({ eventKey: "meal:2026-11-25:lunch#1", amount: -5 })]);
  });
});
