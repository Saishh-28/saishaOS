import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, signInWithGoogle, signInWithPassword } from "../supabase";
import { SCHEDULE } from "./plan";
import { MotionConfig } from "framer-motion";
import { currentSlotIndex, formatTime, greeting, isYmd } from "./logic";
import { clockIn, longDate } from "./gym";
import { sfx } from "./sound";
import { Icon, Lumi, Stars } from "./ui";
import { Link, PlannerView, pathForView, usePathname, viewFromPath } from "./router";
import { LocalStore, PlannerStore, SupabaseStore } from "./store";
import { usePlanner } from "./usePlanner";
import { BlockScreen, GymScreen, HabitsScreen, ReviewScreen, ScreenProps, SettingsScreen, TodayScreen } from "./screens";
import {
  AboutMeCard,
  BackupCard,
  CareerCard,
  CareScreen,
  CoursesCard,
  CurrencyCard,
  CurrencyReminder,
  LumiScreen,
  MoreScreen,
  MusicScreen,
  SignOutCard,
  TreasuryScreen,
} from "./more";
import { BUCKET_IMPORTED_FLAG, bucketItemsToImport, OLD_BUCKET_KEY, parseCurrency, showCurrencyReminder } from "./records";
import { LevelUpOverlay } from "./kingdom";
import type { TrackLevel } from "./training";
import { QuestsScreen, RewardsScreen } from "./questScreens";
import "./planner.css";

const NAV: { v: PlannerView; label: string }[] = [
  { v: "today", label: "Home" },
  { v: "deep", label: "Deep" },
  { v: "study", label: "Study" },
  { v: "gym", label: "Gym" },
  { v: "habits", label: "Habits" },
  { v: "more", label: "More" },
];

/** Screens reached from the More tab (it stays highlighted on them). */
const UNDER_MORE: PlannerView[] = ["more", "review", "settings", "care", "lumi", "music", "treasury", "rewards"];

const TITLES: Record<PlannerView, string> = {
  today: "Home",
  deep: "Deep work",
  study: "Course prep",
  gym: "Gym",
  habits: "Habits",
  review: "Evening review",
  settings: "Settings",
  more: "More",
  care: "Care",
  lumi: "Lumi",
  music: "Music Room",
  treasury: "Treasury",
  quests: "Quests",
  rewards: "Rewards",
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

/** What a new strength / yoga level changes (shown in the celebration). */
function trainingUnlockText(track: "strength" | "yoga", t: TrackLevel): string {
  const step = t.history.find((s) => s.level === t.level);
  const how = step?.sessions != null ? `${step.sessions} of ${track === "strength" ? 12 : 4} sessions in 4 weeks. ` : "";
  const unlocks: Record<string, string> = {
    "strength-2": "Weight suggestions are now on, plus a reps box for double progression.",
    "strength-3": "Squats, deadlifts, hip thrusts, chest press and lat pulldown go to 4 sets.",
    "yoga-2": "Every hold is 15 s longer, and Sun salutation goes to × 4.",
    "yoga-3": "Warrior I and Pigeon join the flow, and Sun salutation goes to × 5.",
  };
  return how + (unlocks[`${track}-${t.level}`] ?? "");
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

  // One-time import of the old dashboard's bucket list from this browser (it was never synced).
  useEffect(() => {
    if (!supabase || !userId || localStorage.getItem(BUCKET_IMPORTED_FLAG)) return;
    const raw = localStorage.getItem(OLD_BUCKET_KEY);
    if (!raw) return;
    (async () => {
      const existing = await supabase!.from("bucket_list").select("title").eq("user_id", userId);
      if (existing.error) return;
      const items = bucketItemsToImport(raw, (existing.data ?? []).map((r: any) => r.title));
      if (items.length) {
        const r = await supabase!.from("bucket_list").insert(items.map((i) => ({ ...i, user_id: userId })));
        if (r.error) return console.warn("[planner] bucket list import failed", r.error.message);
        toast(`Imported ${items.length} bucket list item${items.length > 1 ? "s" : ""} from this browser`);
      }
      localStorage.setItem(BUCKET_IMPORTED_FLAG, new Date().toISOString());
    })();
  }, [userId]);

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
  const more = { p, today, userId, toast };
  const reminder =
    view === "today" &&
    !!p.snap &&
    showCurrencyReminder(today, parseCurrency(p.settings.currency), p.settings.currency_reminder_dismissed === true);
  const loaded = !!p.snap && !!p.day;
  // Celebrate a new player level once (on any phone): remembered in user_settings.
  const seenLevel = typeof p.settings.game_seen_level === "number" ? (p.settings.game_seen_level as number) : 1;
  const levelUp = loaded && p.game?.settled && p.game.level.level > seenLevel ? p.game.level : null;
  // Strength / yoga level-ups (checked on Mondays), once each on any phone.
  const seenTraining = (p.settings.training_seen ?? {}) as Partial<Record<"strength" | "yoga", number>>;
  const trainingUp =
    !levelUp && loaded && p.training
      ? (["strength", "yoga"] as const).find((k) => p.training![k].level > (seenTraining[k] ?? 1)) ?? null
      : null;

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
          {SCHEDULE[cur + 1] && (
            <div className="next">
              Next at {formatTime(SCHEDULE[cur + 1].time)}: {SCHEDULE[cur + 1].label}
            </div>
          )}
          {store?.kind === "local" && <span className="mode">Local mode: saved on this device only</span>}
        </div>
        <div className="hdr-side">
          {view !== "today" && (
            <div className="lumi-float small">
              <Lumi size={50} />
            </div>
          )}
          <Link to="/planner/settings" className="gear" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        </div>
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
          <>
            {reminder && <CurrencyReminder p={p} toast={toast} />}
            <TodayScreen {...props} />
          </>
        ) : view === "deep" ? (
          <BlockScreen {...props} block="deep" />
        ) : view === "study" ? (
          <>
            <BlockScreen {...props} block="study" />
            <CoursesCard {...more} />
            <CareerCard {...more} />
          </>
        ) : view === "gym" ? (
          <GymScreen {...props} />
        ) : view === "habits" ? (
          <HabitsScreen {...props} />
        ) : view === "settings" ? (
          <>
            <AboutMeCard {...more} />
            <SettingsScreen {...props} />
            <CurrencyCard {...more} />
            <BackupCard {...more} />
            <SignOutCard />
          </>
        ) : view === "more" ? (
          <MoreScreen />
        ) : view === "care" ? (
          <CareScreen {...more} />
        ) : view === "lumi" ? (
          <LumiScreen {...more} />
        ) : view === "music" ? (
          <MusicScreen {...more} />
        ) : view === "treasury" ? (
          <TreasuryScreen {...more} />
        ) : view === "quests" ? (
          <QuestsScreen {...props} />
        ) : view === "rewards" ? (
          <RewardsScreen {...props} userId={userId} />
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
          <Link
            key={n.v}
            to={pathForView(n.v)}
            className={n.v === view || (n.v === "more" && UNDER_MORE.includes(view)) ? "active" : ""}
            aria-current={n.v === view ? "page" : undefined}
          >
            <span className="ic">
              <Icon name={n.v} />
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
      {levelUp && (
        <LevelUpOverlay
          crest={levelUp.level}
          name={`Level ${levelUp.level} · ${levelUp.title}`}
          text={`${levelUp.xp} XP earned since 19 November. Every tick counted.`}
          onClose={() => p.setSetting("game_seen_level", levelUp.level)}
        />
      )}
      {trainingUp && p.training && (
        <LevelUpOverlay
          crest={p.training[trainingUp].level}
          eyebrow={trainingUp === "strength" ? "THE CRYSTAL MOUNTAINS AWAKEN" : "THE MOONLIT GARDEN STRETCHES"}
          name={`${trainingUp === "strength" ? "Strength" : "Yoga"} · Level ${p.training[trainingUp].level}`}
          text={trainingUnlockText(trainingUp, p.training[trainingUp])}
          onClose={() => p.setSetting("training_seen", { ...seenTraining, [trainingUp]: p.training![trainingUp].level })}
        />
      )}
      <div className={"toast" + (toastOn ? " on" : "")} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
    </MotionConfig>
  );
}
