/**
 * Tiny path router for the planner (no dependency). Deep links such as
 * /planner/deep work on a cold start because the Worker serves index.html
 * for unknown paths (assets.not_found_handling = "single-page-application").
 */
import React, { useEffect, useState } from "react";

export const PLANNER_VIEWS = [
  "today",
  "deep",
  "study",
  "gym",
  "habits",
  "review",
  "settings",
  "more",
  "care",
  "lumi",
  "music",
  "treasury",
  "quests",
  "rewards",
  "calendar",
  "meals",
] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

const NAV_EVENT = "planner:navigate";

export function viewFromPath(pathname: string): PlannerView {
  const seg = pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  return (PLANNER_VIEWS as readonly string[]).includes(seg) ? (seg as PlannerView) : "today";
}

export function pathForView(v: PlannerView): string {
  return v === "today" ? "/planner" : `/planner/${v}`;
}

/** Screens on the bottom bar; every other screen gets a Back button. */
export const TAB_VIEWS: PlannerView[] = ["today", "deep", "study", "gym", "habits"];

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  // Marked as an in-app step, so Back can return to it instead of leaving the app.
  window.history.pushState({ inApp: true }, "", path);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo(0, 0);
}

/** Back: to the previous screen in the app, or Home when the screen was opened directly (a deep link). */
export function goBack() {
  if ((window.history.state as { inApp?: boolean } | null)?.inApp) window.history.back();
  else navigate("/planner");
}

export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    window.addEventListener(NAV_EVENT, on);
    return () => {
      window.removeEventListener("popstate", on);
      window.removeEventListener(NAV_EVENT, on);
    };
  }, []);
  return path;
}

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string };

export function Link({ to, onClick, ...rest }: LinkProps) {
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}
