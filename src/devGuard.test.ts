import { describe, expect, it } from "vitest";
import { dataTarget, localRealDataBlocked, mustConfirmRealData, REAL_DATA_OK_KEY } from "./devGuard";

const store = (v: string | null) => ({ getItem: (k: string) => (k === REAL_DATA_OK_KEY ? v : null) });
const REAL = { VITE_SUPABASE_URL: "https://real.supabase.co" };
const DEV = { VITE_SUPABASE_URL: "https://test.supabase.co", VITE_SUPABASE_ENV: "dev" };

describe("browser guard", () => {
  it("knows which project the app is pointed at", () => {
    expect(dataTarget({})).toBe("none");
    expect(dataTarget(REAL)).toBe("real");
    expect(dataTarget(DEV)).toBe("dev");
  });

  it("local dev on real data stops and asks; a test project, production or a 'yes' for this tab don't", () => {
    expect(mustConfirmRealData(true, REAL, store(null))).toBe(true);
    expect(mustConfirmRealData(true, DEV, store(null))).toBe(false);
    expect(mustConfirmRealData(false, REAL, store(null))).toBe(false); // the deployed site
    expect(mustConfirmRealData(true, REAL, store("yes"))).toBe(false);
    expect(mustConfirmRealData(true, {}, store(null))).toBe(false); // no Supabase: local-only mode
  });
});

describe("Worker guard", () => {
  const local = new URL("http://localhost:5173/api/planner/review");
  const live = new URL("https://saishaos.saisharora28.workers.dev/api/planner/review");
  it("refuses local requests against the real project unless marked dev or explicitly allowed", () => {
    expect(localRealDataBlocked(local, {})).toBe(true);
    expect(localRealDataBlocked(local, { SUPABASE_ENV: "dev" })).toBe(false);
    expect(localRealDataBlocked(local, { ALLOW_REAL_DATA_LOCALLY: "true" })).toBe(false);
    expect(localRealDataBlocked(new URL("http://127.0.0.1:8787/api/lumi/chat"), {})).toBe(true);
  });

  it("never affects the deployed site", () => {
    expect(localRealDataBlocked(live, {})).toBe(false);
  });
});
