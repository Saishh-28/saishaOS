/**
 * Keeps local testing away from your real data.
 *
 * Local development should use a separate Supabase project (see README,
 * "Develop against a test project"). It's marked with VITE_SUPABASE_ENV=dev in
 * .env.development.local (browser) and SUPABASE_ENV=dev in .dev.vars (Worker).
 *
 * - Browser: when the app runs locally (`npm run dev`) and isn't marked as
 *   dev, it stops on a warning screen before signing in. You can still choose
 *   to continue with real data, for this tab only.
 * - Worker: a request to localhost refuses to use a project that isn't marked
 *   as dev, unless .dev.vars says ALLOW_REAL_DATA_LOCALLY=true.
 * Production (the deployed site) is never affected.
 */

/** sessionStorage key: you chose to use real data in this tab. */
export const REAL_DATA_OK_KEY = "saisha_local_real_data_ok";

export type DataTarget = "dev" | "real" | "none";

/** Which Supabase project the browser app is pointed at. */
export function dataTarget(env: Record<string, unknown>): DataTarget {
  if (!String(env.VITE_SUPABASE_URL ?? "").trim()) return "none";
  return String(env.VITE_SUPABASE_ENV ?? "").trim() === "dev" ? "dev" : "real";
}

/** Should the local app stop and ask before using real data? */
export function mustConfirmRealData(isLocalDev: boolean, env: Record<string, unknown>, storage: Pick<Storage, "getItem"> | null): boolean {
  return isLocalDev && dataTarget(env) === "real" && storage?.getItem(REAL_DATA_OK_KEY) !== "yes";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Worker: refuse a local request that would touch the real project. */
export function localRealDataBlocked(url: URL, env: Record<string, unknown>): boolean {
  const local = LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost");
  if (!local) return false;
  return String(env.SUPABASE_ENV ?? "").trim() !== "dev" && String(env.ALLOW_REAL_DATA_LOCALLY ?? "").trim() !== "true";
}

export const LOCAL_REAL_DATA_MESSAGE =
  "Your local server is connected to your real Supabase project. Point .dev.vars at your test project and add SUPABASE_ENV=dev, " +
  "or add ALLOW_REAL_DATA_LOCALLY=true to .dev.vars if you really mean to use real data.";
