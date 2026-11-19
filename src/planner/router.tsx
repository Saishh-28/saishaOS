/**
 * Tiny path router for the planner (no dependency). Deep links such as
 * /planner/deep work on a cold start because the Worker serves index.html
 * for unknown paths (assets.not_found_handling = "single-page-application").
 */
import React, { useEffect, useState } from "react";

export const PLANNER_VIEWS = ["today", "deep", "study", "gym", "habits", "review"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

const NAV_EVENT = "planner:navigate";

export function isPlannerPath(pathname: string): boolean {
  return pathname === "/planner" || pathname.startsWith("/planner/");
}

export function viewFromPath(pathname: string): PlannerView {
  const seg = pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  return (PLANNER_VIEWS as readonly string[]).includes(seg) ? (seg as PlannerView) : "today";
}

export function pathForView(v: PlannerView): string {
  return v === "today" ? "/planner" : `/planner/${v}`;
}

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo(0, 0);
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
