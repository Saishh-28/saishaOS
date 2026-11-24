import { describe, expect, it } from "vitest";
import { earnedXp, GameData, reconcileXp } from "./game";
import { REST_DAY_KEY } from "./logic";
import {
  bossState,
  coins,
  dailyQuests,
  germanQuest,
  goodWeeks,
  lessonUrl,
  nextLesson,
  NICOS_WEG_A1_LESSONS,
  SEED_BOSSES,
  SEED_REWARDS,
  suggestedTitle,
  tierUnlock,
  tutorPrompt,
  weeklyQuest,
} from "./quests";
import { SAT_TRACK } from "./study";

const data = (over: Partial<GameData> = {}): GameData => ({
  tasks: [],
  done: new Map(),
  days: new Map(),
  habits: new Map(),
  water: new Map(),
  exercises: new Map(),
  ...over,
});
const goal = () => 1250;

describe("Nicos Weg", () => {
  it("A1 has 76 lessons with DW links and a title suggestion", () => {
    expect(NICOS_WEG_A1_LESSONS).toBe(76);
    expect(lessonUrl(1)).toBe("https://learngerman.dw.com/en/hallo/l-37250531");
    expect(lessonUrl(77)).toBeNull();
    expect(suggestedTitle(1)).toBe("Hallo");
    expect(suggestedTitle(5)).toBe("Ich heiße emma"); // from the address only: a starting point you can edit
  });

  it("counts up from your first tick; a skipped day keeps the same lesson; none on Sundays", () => {
    expect(nextLesson([])).toBe(1);
    const done = [{ lesson: 1, title: "Hallo!", date: "2026-11-25" }];
    expect(germanQuest(done, "2026-11-26")).toEqual({ lesson: 2, done: null });
    expect(germanQuest(done, "2026-11-27")).toEqual({ lesson: 2, done: null }); // skipped Thursday: still lesson 2
    expect(germanQuest(done, "2026-11-25")).toEqual({ lesson: 1, done: done[0] });
    expect(germanQuest(done, "2026-11-29")).toBeNull();
  });

  it("tutor prompt: lesson number and title filled in, vocabulary line left for you", () => {
    const p = tutorPrompt(3, " Tschüss! ");
    expect(p).toContain('Today I did: Lesson 3 – "Tschüss!".');
    expect(p).toContain("[I'll paste these from the DW lesson page]");
    expect(p).not.toContain("[number]");
    expect(tutorPrompt(4, "")).toContain('Lesson 4 – "[lesson title]"');
  });

  it("each lesson +15 Mind on the day you did it; the boss is beaten on the 76th", () => {
    const german = Array.from({ length: 76 }, (_, i) => ({ lesson: i + 1, title: null, date: i < 75 ? "2026-12-01" : "2027-02-10" }));
    const boss = SEED_BOSSES.find((b) => b.id === "boss-nicos-weg-a1")!;
    expect(bossState(boss, german)).toEqual({ progress: 76, beatenOn: "2027-02-10" });
    const e = earnedXp(data({ german, bosses: [boss] }), "2027-02-10", goal);
    expect(e.filter((x) => x.source.startsWith("german:")).every((x) => x.amount === 15 && x.skill === "mind")).toBe(true);
    expect(e.find((x) => x.source === "boss:boss-nicos-weg-a1")).toMatchObject({ amount: 200, date: "2027-02-10" });
  });
});

describe("quests", () => {
  it("3 daily quests from that day's habits, rotating; 2 gentle ones on rest days; +5 each when done", () => {
    const a = dailyQuests("2026-11-25", { walk: true, teach: true });
    expect(a).toHaveLength(3);
    expect(dailyQuests("2026-11-26", {}).map((q) => q.id)).not.toEqual(a.map((q) => q.id));
    expect(dailyQuests("2026-11-29", {}).map((q) => q.id).sort()).toEqual(["glow", "walks"]);
    expect(dailyQuests("2026-11-25", { [REST_DAY_KEY]: true })).toHaveLength(2);
    const fam = a.find((q) => q.id === "family");
    if (fam) expect(fam.done).toBe(true);
  });

  it("weekly: 3 strength sessions + 10 after-meal walks → +100 XP on the day it's complete", () => {
    const walks = { walkLunch: true, walkDinner: true };
    const habits = new Map<string, Record<string, boolean>>([
      ["2026-11-23", { gym: true, ...walks }], // Mon strength
      ["2026-11-24", { gym: true, ...walks }], // Tue cardio: doesn't count
      ["2026-11-25", { gym: true, ...walks }], // Wed strength
      ["2026-11-26", walks],
      ["2026-11-27", { gym: true, ...walks }], // Fri strength: 3 sessions, 10 walks
    ]);
    const w = weeklyQuest(habits, "2026-11-27", "2026-11-29");
    expect(w).toMatchObject({ strength: 3, walks: 10, doneOn: "2026-11-27" });
    const e = earnedXp(data({ habits }), "2026-11-29", goal);
    expect(e.find((x) => x.source === "weekly:2026-11-23:strength-walks")).toMatchObject({ amount: 100, skill: "body", date: "2026-11-27" });
  });

  it("manual bosses count with + / −; beaten when progress reaches the target (with the day it happened)", () => {
    const ca = SEED_BOSSES[0];
    expect(bossState({ ...ca, progress: 4 }, [])).toEqual({ progress: 4, beatenOn: null });
    expect(bossState({ ...ca, progress: 10, doneOn: "2026-12-20" }, [])).toEqual({ progress: 10, beatenOn: "2026-12-20" });
    expect(bossState(SEED_BOSSES[1], [])).toEqual({ progress: 0, beatenOn: null });
  });

  it("Unlock Strength Level 2: beaten (+200 XP) the Monday you reach it", () => {
    const boss = SEED_BOSSES.find((b) => b.id === "boss-strength-2")!;
    expect(bossState(boss, [], "2026-12-21")).toEqual({ progress: 1, beatenOn: "2026-12-21" });
    const e = earnedXp(data({ bosses: [boss], strengthL2On: "2026-12-21" }), "2026-12-21", goal);
    expect(e.find((x) => x.source === "boss:boss-strength-2")).toMatchObject({ amount: 200, skill: "body", date: "2026-12-21" });
  });

  it("removing a lesson takes its XP back with a minus row", () => {
    const d = data({ german: [{ lesson: 1, title: null, date: "2026-11-25" }] });
    const first = reconcileXp(earnedXp(d, "2026-11-25", goal), []);
    const after = reconcileXp(earnedXp(data(), "2026-11-25", goal), first);
    expect(after).toEqual([expect.objectContaining({ eventKey: "german:1#1", amount: -15 })]);
  });
});

describe("coins and rewards", () => {
  it("1 coin per 10 XP; spending lowers coins, never XP", () => {
    expect(coins(555, [])).toEqual({ earned: 55, spent: 0, balance: 55 });
    expect(coins(1234, [{ rewardId: "seed-small-2", title: "New book", cost: 100, date: "2026-12-01" }])).toEqual({ earned: 123, spent: 100, balance: 23 });
  });

  it("your seeded rewards: 4 small, 4 medium, 3 big, 2 epic at 100 / 250 / 500 / 1200 coins, no food", () => {
    const by = (t: string) => SEED_REWARDS.filter((r) => r.tier === t);
    expect([by("small").length, by("medium").length, by("big").length, by("epic").length]).toEqual([4, 4, 3, 2]);
    expect([by("small")[0].cost, by("medium")[0].cost, by("big")[0].cost, by("epic")[0].cost]).toEqual([100, 250, 500, 1200]);
    expect(SEED_REWARDS.some((r) => /pizza|cake|chocolate|food|dessert|ice cream/i.test(r.title))).toBe(false);
  });

  it("tiers unlock: 1 / 2 good weeks; Big needs 4 + Strength Lv 2; Epic first customer or 20 Feb", () => {
    const c = { goodWeeks: 1, strengthLevel: 1, firstCustomer: false, today: "2026-12-01" };
    expect(tierUnlock("small", c).ok).toBe(true);
    expect(tierUnlock("medium", c).ok).toBe(false);
    expect(tierUnlock("big", { ...c, goodWeeks: 4 }).ok).toBe(false);
    expect(tierUnlock("big", { ...c, goodWeeks: 4, strengthLevel: 2 }).ok).toBe(true);
    expect(tierUnlock("epic", { ...c, firstCustomer: true }).ok).toBe(true);
    expect(tierUnlock("epic", { ...c, today: "2027-02-20" }).ok).toBe(true);
  });

  it("a good week: finished Mon–Sun week, working days average ≥ 80% (rest days left out)", () => {
    const pct = new Map([["2026-11-19", 100], ["2026-11-20", 95], ["2026-11-21", 77], ["2026-11-23", 59]]);
    const on = (d: string) => (new Date(d).getUTCDay() === 0 ? { pct: 0, rest: true } : { pct: pct.get(d) ?? 0, rest: false });
    expect(goodWeeks(on, "2026-11-24")).toBe(1); // 16–22 Nov: (100 + 95 + 77) / 3 = 91%
    expect(goodWeeks(on, "2026-11-30")).toBe(1); // 23–29 Nov: 59% and zeros
  });
});

describe("Saturday study track", () => {
  it("every Saturday is Light review (Nicos Weg replaces the DW German task)", () => {
    expect(SAT_TRACK).toHaveLength(13);
    expect(SAT_TRACK.every((t) => t === "Light review: re-read this week's R + JS notes")).toBe(true);
  });
});
