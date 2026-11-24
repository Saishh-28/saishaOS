import { describe, expect, it } from "vitest";
import { CASTLES } from "./castles";
import { PLANNER_VIEWS, TAB_VIEWS, viewFromPath } from "./router";

describe("castles on Home", () => {
  it("every screen that isn't on the bottom bar has a castle (Settings keeps its gear)", () => {
    const castleViews = CASTLES.map((c) => viewFromPath(c.to));
    const needCastle = PLANNER_VIEWS.filter((v) => !TAB_VIEWS.includes(v) && v !== "settings" && v !== "more");
    expect([...castleViews].sort()).toEqual([...needCastle].sort());
  });

  it("the bottom bar is Home, Deep, Study, Gym, Habits (no More tab)", () => {
    expect(TAB_VIEWS).toEqual(["today", "deep", "study", "gym", "habits"]);
  });
});
