import { describe, expect, it } from "vitest";
import { earnedXp } from "./game";
import {
  careCsvRows,
  careTrend,
  hairReminders,
  journalPrompt,
  routineDone,
  SEED_STEPS,
  SkinLog,
  stepHint,
  stepsFor,
} from "./care";

const skin = (date: string, steps: string[], over: Partial<SkinLog> = {}): SkinLog => ({ date, steps, rating: null, areas: [], note: null, ...over });
const salicylic = SEED_STEPS.find((s) => s.id === "pm-salicylic")!;

describe("skincare routine", () => {
  it("seeds AM cleanser → niacinamide → sunscreen and PM cleanser → salicylic (3×/week) → moisturiser", () => {
    expect(stepsFor(SEED_STEPS, "am").map((s) => s.label)).toEqual(["Cleanser", "Niacinamide", "Sunscreen"]);
    expect(stepsFor(SEED_STEPS, "pm").map((s) => s.label)).toEqual(["Cleanser", "2% salicylic acid", "Moisturiser"]);
  });

  it("a routine is done when every everyday step is ticked; salicylic acid is optional", () => {
    expect(routineDone(SEED_STEPS, "pm", ["pm-cleanser", "pm-moisturiser"])).toBe(true);
    expect(routineDone(SEED_STEPS, "pm", ["pm-cleanser"])).toBe(false);
    expect(routineDone(SEED_STEPS, "am", [])).toBe(false);
  });

  it("salicylic 'tonight?': due when < 3 uses in the last 7 days and not used yesterday", () => {
    expect(stepHint(salicylic, [], "2026-11-25")).toMatchObject({ due: true, text: "Tonight? not used yet · 0 of 3 this week" });
    expect(stepHint(salicylic, [skin("2026-11-23", ["pm-salicylic"])], "2026-11-25")).toMatchObject({
      due: true,
      text: "Tonight? last used Mon (2 days ago) · 1 of 3 this week",
    });
    expect(stepHint(salicylic, [skin("2026-11-24", ["pm-salicylic"])], "2026-11-25")!.text).toBe("Not tonight: you used it yesterday");
    const three = ["2026-11-19", "2026-11-21", "2026-11-23"].map((d) => skin(d, ["pm-salicylic"]));
    expect(stepHint(salicylic, three, "2026-11-25")!.text).toBe("Not tonight: 3 of 3 this week already");
    expect(stepHint(salicylic, three, "2026-11-27")!.due).toBe(true); // 19 Nov has dropped out of the last 7 days
    expect(stepHint(salicylic, [skin("2026-11-25", ["pm-salicylic"])], "2026-11-25")).toMatchObject({ due: false, usedToday: true });
    expect(stepHint(SEED_STEPS[0], [], "2026-11-25")).toBeNull();
  });
});

describe("hair", () => {
  it("Protein mask due after > 14 days, Clarifying wash due after > 18 days", () => {
    const logs = [
      { date: "2026-11-10", items: ["shampoo", "protein_mask"] as const, products: null, shedding: 3, note: null },
      { date: "2026-11-12", items: ["clarifying"] as const, products: null, shedding: null, note: null },
    ].map((l) => ({ ...l, items: [...l.items] }));
    expect(hairReminders(logs, "2026-11-24")).toEqual([]);
    expect(hairReminders(logs, "2026-11-25").map((r) => r.text)).toEqual(["Protein mask due (15 days since the last one)"]);
    expect(hairReminders(logs, "2026-12-01").map((r) => r.item)).toEqual(["protein_mask", "clarifying"]);
    expect(hairReminders([], "2026-11-25").map((r) => r.text)).toEqual(["Protein mask due (none logged yet)", "Clarifying wash due (none logged yet)"]);
  });
});

describe("care XP", () => {
  const base = { tasks: [], done: new Map(), days: new Map(), habits: new Map(), water: new Map(), exercises: new Map() };
  it("skin log +5 Glow (once rated or noted), hair wash day +5 Glow, journal +5 Mind, book note +10 Mind", () => {
    const e = earnedXp(
      {
        ...base,
        skin: [skin("2026-11-25", ["am-cleanser"]), skin("2026-11-24", [], { rating: 4 })],
        hair: [{ date: "2026-11-25", items: ["shampoo"], products: null, shedding: 2, note: null }],
        journalDates: ["2026-11-25"],
        bookNotes: [{ id: "n1", date: "2026-11-25", section: "Ch. 1" }],
      },
      "2026-11-25",
      () => 1250,
    ).map((x) => [x.source, x.skill, x.amount]);
    expect(e).toEqual([
      ["skinlog:2026-11-24", "glow", 5],
      ["hairlog:2026-11-25", "glow", 5],
      ["journal:2026-11-25", "mind", 5],
      ["booknote:n1", "mind", 10],
    ]);
  });
});

describe("trends and CSV", () => {
  it("30 days of skin rating and shedding, with water (share of goal) and after-meal walks", () => {
    const t = careTrend({
      skin: [skin("2026-11-25", [], { rating: 4 })],
      hair: [{ date: "2026-11-24", items: ["shampoo"], products: null, shedding: 2, note: null }],
      water: new Map([["2026-11-25", 625]]),
      habits: new Map([["2026-11-25", { walkLunch: true, walkDinner: true }]]),
      goalOn: () => 1250,
      today: "2026-11-25",
    });
    expect(t).toHaveLength(30);
    expect(t.at(-1)).toEqual({ date: "2026-11-25", skin: 4, shedding: null, water: 0.5, walks: 2 });
    expect(t.at(-2)).toMatchObject({ shedding: 2, skin: null });
  });

  it("all care data goes in the CSV", () => {
    const rows = careCsvRows({
      steps: SEED_STEPS,
      skin: [skin("2026-11-25", ["pm-salicylic"], { rating: 3, areas: ["back"], note: "calm" })],
      hair: [{ date: "2026-11-25", items: ["protein_mask"], products: "Brand X", shedding: 2, note: null }],
      journal: [{ date: "2026-11-25", content: "Good day", shared: false }],
      books: [{ id: "b1", title: "Atomic Habits" }],
      notes: [{ bookId: "b1", date: "2026-11-25", section: "Ch. 1", mainIdea: "Small habits", experiment: "2-min rule", result: null }],
    });
    expect(rows).toEqual([
      ["2026-11-25", "skincare", "PM 2% salicylic acid", "done"],
      ["2026-11-25", "skin", "rating (1–5)", 3],
      ["2026-11-25", "skin", "breakout areas", "back"],
      ["2026-11-25", "skin", "note", "calm"],
      ["2026-11-25", "hair", "Protein mask", "done"],
      ["2026-11-25", "hair", "products", "Brand X"],
      ["2026-11-25", "hair", "shedding / breakage (1–5)", 2],
      ["2026-11-25", "journal", "entry (private)", "Good day"],
      ["2026-11-25", "book", "Atomic Habits · Ch. 1 · main idea", "Small habits"],
      ["2026-11-25", "book", "Atomic Habits · Ch. 1 · experiment", "2-min rule"],
    ]);
  });

  it("journal prompt rotates by day", () => {
    expect(journalPrompt("2026-11-25")).not.toBe(journalPrompt("2026-11-26"));
  });
});
