/**
 * Small data hook for the screens that moved over from the old dashboard
 * (Study courses, Care, Music Room, Treasury, Lumi, Settings).
 * Loads the signed-in user's rows from one table and refetches when another
 * device changes them (Supabase Realtime, RLS applies) or the app comes back
 * to the foreground.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

export function useRows<T = any>(
  table: string,
  userId: string | null,
  opts: { userColumn?: string; build?: (q: any) => any; key?: string } = {},
) {
  const { userColumn = "user_id", build, key = "" } = opts;
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  const gen = useRef(0);

  const reload = useCallback(async () => {
    if (!supabase || !userId) return;
    const g = ++gen.current;
    let q: any = supabase.from(table).select("*").eq(userColumn, userId);
    if (buildRef.current) q = buildRef.current(q);
    const r = await q;
    if (g !== gen.current) return;
    if (r.error) setError(`Loading ${table}: ${r.error.message}`);
    else {
      setRows(r.data as T[]);
      setError(null);
    }
  }, [table, userId, userColumn, key]);

  useEffect(() => {
    setRows(null);
    reload();
  }, [reload]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 300);
    };
    const ch = supabase
      .channel(`rows-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table, filter: `${userColumn}=eq.${userId}` }, soon)
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table, filter: `${userColumn}=eq.${userId}` }, soon)
      .on("postgres_changes" as any, { event: "DELETE", schema: "public", table }, soon)
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && soon();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      supabase!.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [table, userId, userColumn, reload]);

  return { rows, error, reload };
}

/** Run a Supabase write; returns an error message or null. Reloads afterwards. */
export async function write(what: string, q: PromiseLike<{ error: { message: string } | null }>, reload?: () => void): Promise<string | null> {
  const r = await q;
  reload?.();
  return r.error ? `${what}: ${r.error.message}` : null;
}
