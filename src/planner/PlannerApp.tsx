import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, signInWithGoogle, signInWithPassword } from "../supabase";
import { SCHEDULE } from "./plan";
import { MotionConfig } from "framer-motion";
import { currentSlotIndex, greeting, isYmd } from "./logic";
import { clockIn, longDate } from "./gym";
import { sfx } from "./sound";
import { Icon, Lumi, Stars } from "./ui";
import { Link, PlannerView, pathForView, usePathname, viewFromPath } from "./router";
import { LocalStore, PlannerStore, SupabaseStore } from "./store";
import { usePlanner } from "./usePlanner";
import { BlockScreen, GymScreen, HabitsScreen, ReviewScreen, ScreenProps, TodayScreen } from "./screens";
import "./planner.css";

const NAV: { v: PlannerView; label: string }[] = [
  { v: "today", label: "Today" },
  { v: "deep", label: "Deep" },
  { v: "study", label: "Study" },
  { v: "gym", label: "Gym" },
  { v: "habits", label: "Habits" },
  { v: "review", label: "Review" },
];

const TITLES: Record<PlannerView, string> = {
  today: "Today",
  deep: "Deep work",
  study: "Course prep",
  gym: "Gym",
  habits: "Habits",
  review: "Evening review",
};

/** Dev only: /planner?date=2026-11-23 pretends today is that date (for testing gym days, rollover, etc.). */
function devDate(): string | null {
  if (!(import.meta as any).env?.DEV) return null;
  const v = new URLSearchParams(window.location.search).get("date");
  return isYmd(v) ? v : null;
}

/** Re-render every 30 s so the "now" marker moves and a new day starts at midnight. */
function currentTime(): Date {
  return new Date();
}

function partOfDay(hour: number): string {
  return hour < 5 ? "NIGHT" : hour < 12 ? "MORNING" : hour < 17 ? "AFTERNOON" : hour < 20 ? "TWILIGHT" : "NIGHT";
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
  // Always India time, whatever time zone the device is set to.
  const clock = clockIn(now);
  const today = devDate() ?? clock.date;
  const minutes = clock.hour * 60 + clock.minute;
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

  // Morning chime: first tap of the day before noon (browsers don't allow sound before a tap).
  useEffect(() => {
    sfx.onUnlock = () => sfx.wakeUpOnce(today, clockIn(new Date()).hour);
  }, [today]);

  if (!ready)
    return (
      <div className="planner">
        <Stars />
      </div>
    );
  if (supabase && !session)
    return (
      <div className="planner">
        <Stars />
        <SignIn />
      </div>
    );

  const cur = currentSlotIndex(minutes);
  const firstName = (session?.user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] || "Saish";
  const props: ScreenProps = { p, today, minutes, toast };
  const loaded = !!p.snap && !!p.day;

  return (
    <MotionConfig reducedMotion="user">
    <div className="planner">
      <Stars />
      <header className="p-hdr">
        <div className="hdr-text">
          <div className="date">
            {longDate(today).toUpperCase()} · {partOfDay(clock.hour)}
          </div>
          <h1>
            {greeting(clock.hour)}, {firstName}
          </h1>
          <div className="now">Now: {cur >= 0 ? SCHEDULE[cur].label : "Sleep in, it's early"}</div>
          {store?.kind === "local" && <span className="mode">Local mode: saved on this device only</span>}
        </div>
        {view !== "today" && (
          <div className="lumi-float small">
            <Lumi size={50} />
          </div>
        )}
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
            <span className="ic">
              <Icon name={n.v} />
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className={"toast" + (toastOn ? " on" : "")} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
    </MotionConfig>
  );
}
