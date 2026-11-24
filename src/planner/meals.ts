/**
 * Phase 3b: Meals (eggetarian). Today's meals by weekday from your meal
 * plan (stored in meal_plan, seeded once from the list below; edit it in
 * the app). Ticking a meal ("ate this" or "ate something else") gives
 * +5 XP to Glow.
 */
import { dayOfWeek } from "./logic";
import type { Earned } from "./game";

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";
export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };
/** When each meal usually happens (India time), for "next meal" on Home. */
export const SLOT_UNTIL: Record<MealSlot, number> = { breakfast: 11 * 60, lunch: 15 * 60, snack: 18 * 60, dinner: 24 * 60 };

export const MEAL_RULES = ["Protein every meal", "Veggies first, carbs last", "High fibre", "Little sugar", "2–3 L water"];
export const MEAL_XP = 5;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Your menus (index 0 = Sunday), in the order breakfast | lunch | snack | dinner. */
const MENUS: [number, string, string, string, string][] = [
  [1, "2-egg veggie omelette + 1 multigrain toast", "Salad → dal + bhindi + 2 rotis + curd", "Roasted chana + green tea", "Paneer bhurji + sautéed veg + 1 roti"],
  [2, "Moong dal chilla with paneer", "Salad → rajma + small bowl brown rice + raita", "Sprouts chaat", "Egg curry + lauki + 1 roti"],
  [3, "Hung curd + berries + chia + nuts", "Salad → chole + mixed veg + 1–2 rotis", "Apple + peanut butter", "Paneer/tofu tikka + grilled veg + small bowl quinoa"],
  [4, "Besan chilla + mint chutney + 1 boiled egg", "Salad → palak paneer + 2 rotis + curd", "Buttermilk + nuts", "Moong dal soup + egg bhurji + veg"],
  [5, "Veg poha with peanuts + 2 boiled eggs", "Salad → dal + gobhi + small bowl rice + curd", "Roasted makhana", "Soya chunk curry + veg + 1 roti"],
  [6, "Veg upma + 2-egg omelette", "Salad → kadhi + mixed veg + 1–2 rotis", "Guava/orange + nuts", "Paneer veggie stir-fry + 1 roti"],
  [0, "1 paneer paratha + curd + 1 egg", "Flexible family meal (salad first, moderate carbs)", "Sprouts or chana", "Dal soup + egg + veg"],
];

export interface MealPlanRow {
  weekday: number;
  slot: MealSlot;
  text: string;
}

/** The 28 seed rows (7 days × 4 meals). */
export const SEED_MEAL_PLAN: MealPlanRow[] = MENUS.flatMap(([weekday, ...meals]) =>
  MEAL_SLOTS.map((slot, i) => ({ weekday, slot, text: meals[i] })),
);

export type MealAte = "plan" | "other";
export interface MealLog {
  date: string;
  slot: MealSlot;
  ate: MealAte;
  note: string | null;
}

export const isMealSlot = (v: unknown): v is MealSlot => MEAL_SLOTS.includes(v as MealSlot);

/** Today's four meals, from your plan (empty text if a slot has no entry). */
export function mealsFor(plan: readonly MealPlanRow[], date: string): { slot: MealSlot; text: string }[] {
  const wd = dayOfWeek(date);
  return MEAL_SLOTS.map((slot) => ({ slot, text: plan.find((r) => r.weekday === wd && r.slot === slot)?.text ?? "" }));
}

/** The next meal not yet logged today (by time of day), or null when all are done. */
export function nextMeal(logs: readonly MealLog[], date: string, minutes: number): MealSlot | null {
  const logged = new Set(logs.filter((l) => l.date === date).map((l) => l.slot));
  const open = MEAL_SLOTS.filter((s) => !logged.has(s));
  return open.find((s) => minutes < SLOT_UNTIL[s]) ?? open[0] ?? null;
}

/** +5 Glow for every meal you logged (either choice). */
export function mealXp(logs: readonly MealLog[], inRange: (date: string) => boolean): Earned[] {
  return logs
    .filter((l) => inRange(l.date))
    .map((l) => ({
      source: `meal:${l.date}:${l.slot}`,
      skill: "glow" as const,
      amount: MEAL_XP,
      date: l.date,
      reason: `${SLOT_LABEL[l.slot]}: ${l.ate === "plan" ? "ate the planned meal" : "ate something else"}`,
    }));
}
