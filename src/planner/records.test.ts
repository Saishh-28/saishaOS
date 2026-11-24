import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  bucketItemsToImport,
  cleanCourseCode,
  coursesByTerm,
  daysUntil,
  gpa,
  money,
  parseAmount,
  parseCurrency,
  prepareRestore,
  showCurrencyReminder,
  spentThisMonth,
  termRank,
} from "./records";

describe("courses and GPA", () => {
  const s2 = [
    { code: "COMPSCI 120", final_grade: "A+", credits: 15, term: "S2 2026" },
    { code: "COMPSCI 130", final_grade: "A+", credits: 15, term: "S2 2026" },
    { code: "STATS 101", final_grade: "A", credits: 15, term: "S2 2026" },
    { code: "MATHS 120", final_grade: "A-", credits: 15, term: "S2 2026" },
  ];

  it("Semester 2 2026 GPA is 8.25 on the 9-point scale", () => {
    expect(gpa(s2)).toBe(8.25);
  });

  it("ignores courses without a grade yet; null when nothing is graded", () => {
    expect(gpa([...s2, { code: "STATS 220", final_grade: null, credits: 15, term: "S1 2027" }])).toBe(8.25);
    expect(gpa([{ final_grade: null, credits: 15 }])).toBeNull();
  });

  it("groups by term, newest first; S1 2027 before S2 2026; no term last", () => {
    const groups = coursesByTerm([...s2, { code: "STATS 220", term: "S1 2027" }, { code: "MATHS 130", term: "S1 2027" }, { code: "OLD 101", term: null }]);
    expect(groups.map((g) => g.term)).toEqual(["S1 2027", "S2 2026", null]);
    expect(groups[0].courses.map((c) => c.code)).toEqual(["MATHS 130", "STATS 220"]);
    expect(termRank("SS 2027")).toBeLessThan(termRank("S1 2027"));
  });

  it("cleans course codes", () => {
    expect(cleanCourseCode(" stats220 ")).toBe("STATS 220");
    expect(cleanCourseCode("COMPSCI 220")).toBe("COMPSCI 220");
    expect(cleanCourseCode("hello")).toBeNull();
  });

  it("counts days until a due date", () => {
    expect(daysUntil("2026-11-30T00:00:00+00:00", "2026-11-24")).toBe(6);
    expect(daysUntil("2026-11-20", "2026-11-24")).toBe(-4);
  });
});

describe("money", () => {
  it("₹ by default, NZ$ when chosen", () => {
    expect(parseCurrency(undefined)).toBe("INR");
    expect(parseCurrency("NZD")).toBe("NZD");
    expect(money(5000, "INR")).toBe("₹5,000");
    expect(money(150000, "INR")).toBe("₹1,50,000");
    expect(money(12.5, "NZD")).toBe("NZ$12.50");
  });

  it("reminds to switch to NZ$ from 20 Feb 2027, until switched or dismissed", () => {
    expect(showCurrencyReminder("2027-02-19", "INR", false)).toBe(false);
    expect(showCurrencyReminder("2027-02-20", "INR", false)).toBe(true);
    expect(showCurrencyReminder("2027-03-01", "NZD", false)).toBe(false);
    expect(showCurrencyReminder("2027-03-01", "INR", true)).toBe(false);
  });

  it("parses typed amounts", () => {
    expect(parseAmount("1,250.50")).toBe(1250.5);
    expect(parseAmount("₹300")).toBe(300);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("adds up this month's spending per category", () => {
    const tx = [
      { id: "1", category_id: "food", amount: 200, description: null, transaction_date: "2026-11-02T10:00:00Z" },
      { id: "2", category_id: "food", amount: 50, description: null, transaction_date: "2026-11-20T10:00:00Z" },
      { id: "3", category_id: "food", amount: 999, description: null, transaction_date: "2026-10-30T10:00:00Z" },
    ];
    expect(spentThisMonth(tx, "2026-11-24").get("food")).toBe(250);
  });
});

describe("bucket list import", () => {
  it("imports items from the old browser storage once, skipping ones already in Supabase", () => {
    const raw = JSON.stringify([
      { id: "b1", title: "Walk up Mount Eden at sunset", completed: true, location: "Mt Eden" },
      { id: "b2", title: "  Take the ferry to Waiheke  ", completed: false, location: "Hauraki Gulf" },
      { id: "b3", title: "walk up mount eden at sunset" },
      { nope: 1 },
    ]);
    expect(bucketItemsToImport(raw, ["Take the ferry to Waiheke"])).toEqual([
      { title: "Walk up Mount Eden at sunset", description: "Mt Eden", completed: true },
    ]);
    expect(bucketItemsToImport(null, [])).toEqual([]);
    expect(bucketItemsToImport("not json", [])).toEqual([]);
  });
});

describe("backup", () => {
  it("restores only into the signed-in account, only known tables", () => {
    const raw = JSON.stringify({
      app: "saisha-os",
      version: 1,
      exportedAt: "2026-11-24",
      tables: { songs: [{ id: "s1", user_id: "someone-else", title: "x" }], evil_table: [{ id: 1 }], profiles: [{ id: "x", name: "S" }] },
    });
    const r = prepareRestore(raw, "me");
    expect(r.rows).toBe(2);
    expect(r.tables.find((t) => t.table === "songs")!.rows[0].user_id).toBe("me");
    expect(r.tables.find((t) => t.table === "profiles")!.rows[0].id).toBe("me");
    expect(r.tables.some((t) => t.table === "evil_table")).toBe(false);
    expect(() => prepareRestore("{}", "me")).toThrow(/isn't a Saisha OS backup/);
  });

  it("restores parents before children", () => {
    const order = BACKUP_TABLES.map((t) => t.table);
    for (const [parent, child] of [["courses", "assignments"], ["songs", "song_versions"], ["budgets", "budget_categories"], ["budget_categories", "transactions"], ["chat_sessions", "chat_messages"], ["plan_tasks", "daily_list_items"]])
      expect(order.indexOf(parent)).toBeLessThan(order.indexOf(child));
  });
});
