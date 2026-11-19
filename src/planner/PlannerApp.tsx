import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, signInWithGoogle, signInWithPassword } from "../supabase";
import { SCHEDULE } from "./plan";
import { currentSlotIndex, greeting, ymd } from "./logic";
import { Link, PlannerView, pathForView, usePathname, viewFromPath } from "./router";
import { LocalStore, PlannerStore, SupabaseStore } from "./store";
import { usePlanner } from "./usePlanner";
import { BlockScreen, GymScreen, HabitsScreen, ReviewScreen, ScreenProps, TodayScreen } from "./screens";
import "./planner.css";

const NAV: { v: PlannerView; ic: string; label: string }[] = [
  { v: "today", ic: "☀️", label: "Today" },
  { v: "deep", ic: "🎯", label: "Deep" },
  { v: "study", ic: "📚", label: "Study" },
  { v: "gym", ic: "💪", label: "Gym" },
  { v: "habits", ic: "💧", label: "Habits" },
  { v: "review", ic: "🤖", label: "Review" },
];

const TITLES: Record<PlannerView, string> = {
  today: "Today",
  deep: "Deep work",
  study: "Course prep",
  gym: "Gym",
  habits: "Habits",
  review: "Evening review",
};

/** Re-render every 30 s so the "now" marker moves and a new day starts at midnight. */
function currentTime(): Date {
  const d = new Date();
  // Dev only: /planner?date=2026-11-23 pretends today is that date (for testing gym days, rollover, etc.).
  if ((import.meta as any).env?.DEV) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(new URLSearchParams(window.location.search).get("date") ?? "");
    if (m) d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return d;
}

function useNow(): Date {
  const [now, setNow] = useState(currentTime);
  useEffect(() => {
    const id = setInterval(() => setNow(currentTime()), 30_000);
    const onVis = () => document.visibilityState === "visible" && setNow(currentTime());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return now;
}

function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="center">
      <div className="card">
        <h2>Sign in to your planner</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Same account as Saisha OS. You stay signed in on this phone, so MacroDroid links open straight to the planner.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("");
            try {
              await signInWithPassword(email, password);
            } catch (err: any) {
              setMsg(err.message ?? "Sign-in failed");
            }
          }}
        >
          <div className="row">
            <input type="text" inputMode="email" autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="row">
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", font: "inherit", minHeight: 44 }}
            />
          </div>
          <div className="row">
            <button className="btn wide">Sign in</button>
          </div>
        </form>
        <div className="row">
          <button className="btn ghost wide" onClick={() => signInWithGoogle(window.location.pathname).catch((e) => setMsg(e.message))}>
            Continue with Google
          </button>
        </div>
                {msg && <div className="note error">{msg}</div>}
      </div>
    </div>
  );
}

export default function PlannerApp() {
  const pathname = usePathname();
  const view = viewFromPath(pathname);
  const now = useNow();
  const today = ymd(now);
  const { session, ready } = useSession();
  const userId = session?.user?.id ?? null;

  const store: PlannerStore | null = useMemo(() => {
    if (!supabase) return new LocalStore();
    return userId ? new SupabaseStore(supabase, userId) : null;
  }, [userId]);

  const p = usePlanner(store, today);

  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const toast = (m: string) => {
    setToastMsg(m);
    setToastOn(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOn(false), 1800);
  };

  useEffect(() => {
    document.title = `${TITLES[view]} · Saisha Planner`;
  }, [view]);

  if (!ready) return <div className="planner" />;
  if (supabase && !session)
    return (
      <div className="planner">
        <SignIn />
      </div>
    );

  const cur = currentSlotIndex(now.getHours() * 60 + now.getMinutes());
  const firstName = (session?.user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] || "Saish";
  const props: ScreenProps = { p, today, now, toast };
  const loaded = !!p.snap && !!p.day;

  return (
    <div className="planner">
      <header className="p-hdr">
        <div className="date">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1>
          {greeting(now.getHours())}, {firstName}
        </h1>
        <div className="now">Now: {cur >= 0 ? SCHEDULE[cur].label : "Sleep in, it's early"}</div>
        {store?.kind === "local" && <span className="mode">Local mode: saved on this device only</span>}
      </header>
      <main className="p-main">
        {p.error && (
          <div className="note error" role="alert" style={{ marginBottom: 14 }}>
            {p.error}{" "}
            <button className="btn ghost" onClick={() => { p.clearError(); p.reload(); }}>
              Retry
            </button>
          </div>
        )}
        {!loaded ? (
          <div className="card">
            <div className="muted">{p.error ? "Couldn't load your planner." : "Loading your day…"}</div>
          </div>
        ) : view === "today" ? (
          <TodayScreen {...props} />
        ) : view === "deep" ? (
          <BlockScreen {...props} block="deep" />
        ) : view === "study" ? (
          <BlockScreen {...props} block="study" />
        ) : view === "gym" ? (
          <GymScreen {...props} />
        ) : view === "habits" ? (
          <HabitsScreen {...props} />
        ) : (
          <React.Fragment key={today}>
            <ReviewScreen {...props} />
          </React.Fragment>
        )}
        <p className="muted" style={{ textAlign: "center" }}>
          <a className="back" href="/">← Saisha OS</a>
        </p>
      </main>
      <nav className="p-nav" aria-label="Planner sections">
        {NAV.map((n) => (
          <Link key={n.v} to={pathForView(n.v)} className={n.v === view ? "active" : ""} aria-current={n.v === view ? "page" : undefined}>
            <span className="ic" aria-hidden="true">
              {n.ic}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className={"toast" + (toastOn ? " on" : "")} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}
