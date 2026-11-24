/**
 * Progress calendar (docs/design/Calendar.dc.html): 13-week journey strip,
 * stat cards, month grid with markers, a sheet for any day, skill growth
 * and a Lumi line. Everything comes from your data.
 */
import React, { useEffect, useMemo, useState } from "react";
import type { Planner } from "./usePlanner";
import {
  bestWeek,
  calendarLine,
  dayTone,
  JOURNEY_MONTHS,
  journeyWeek,
  journeyWeeks,
  levelUpDays,
  monthAverage,
  monthCells,
  monthName,
  shiftMonth,
  skillGrowth,
  xpInMonth,
} from "./calendar";
import { dayResult, SKILLS } from "./game";
import { habitsOn, REST_DAY_KEY } from "./logic";
import { longDate, sessionFor } from "./gym";
import { dailyQuests } from "./quests";
import { waterGoal, mondayOf } from "./water";
import { Lumi } from "./ui";

interface Props {
  p: Planner;
  today: string;
}

const kfmt = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const SKILL_COLOR: Record<string, [string, string]> = {
  mind: ["#d8c6ff", "#9a7ce0"],
  body: ["#c9fbff", "#6fc9d6"],
  family: ["#c8f0c6", "#7fc59a"],
  glow: ["#ffd0de", "#e48fb0"],
  business: ["#ffe1b8", "#e9a86f"],
};

export function CalendarScreen({ p, today }: Props) {
  const snap = p.snap!;
  const game = p.game;
  const goalStart = typeof snap.settings.water_goal_start === "string" ? (snap.settings.water_goal_start as string) : null;
  const dayOn = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof dayResult>>();
    return (d: string) => {
      if (!cache.has(d)) cache.set(d, dayResult(snap, d, waterGoal(snap.water, goalStart ?? mondayOf(d), d).goalMl));
      return cache.get(d)!;
    };
  }, [snap, goalStart]);

  const thisMonth = today.slice(0, 7);
  const [ym, setYm] = useState(JOURNEY_MONTHS.includes(thisMonth) ? thisMonth : JOURNEY_MONTHS[0]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setYm(JOURNEY_MONTHS.includes(thisMonth) ? thisMonth : JOURNEY_MONTHS[0]), [thisMonth]);

  if (!game) return <div className="card muted">The calendar appears once the game is set up.</div>;
  const weeks = journeyWeeks(dayOn, today);
  const xpLevelDays = levelUpDays(snap.xp);
  const trainingUps = new Map<string, string>();
  for (const k of ["strength", "yoga"] as const)
    for (const s of p.training?.[k].history ?? []) if (s.level > 1) trainingUps.set(s.since, `${k === "strength" ? "Strength" : "Yoga"} Level ${s.level}`);
  const growth = skillGrowth(snap.xp, ym);
  const maxXp = Math.max(1, ...growth.map((g) => g.xp));
  const avg = monthAverage(dayOn, ym, today);
  const idx = JOURNEY_MONTHS.indexOf(ym);

  return (
    <>
      <div className="card cal-hero">
        <div className="eyebrow">YOUR JOURNEY · WEEK {today < "2026-11-19" ? 1 : journeyWeek(today)} OF 13</div>
        <h2 style={{ margin: "4px 0 10px" }}>Progress calendar</h2>
        <div className="journey" role="list" aria-label="13-week journey">
          {weeks.map((w) => (
            <span
              key={w.n}
              role="listitem"
              className={"jw " + (w.pct == null ? "empty" : w.pct >= 80 ? "gold" : w.pct >= 50 ? "aqua" : "dim") + (w.current ? " current" : "")}
              aria-label={`Week ${w.n}${w.pct == null ? ": not yet" : `: ${w.pct}%`}${w.current ? " (this week)" : ""}`}
            />
          ))}
        </div>
        <div className="journey-ends">
          <span>19 NOV · INDIA</span>
          <span>20 FEB · FLY TO NZ</span>
        </div>
      </div>

      <div className="cal-stats">
        <div className="stat">
          <b style={{ color: "#ffd98a" }}>{game.streak.current}</b>
          <span>day streak</span>
        </div>
        <div className="stat">
          <b style={{ color: "#bff3f0" }}>{avg == null ? "–" : `${avg}%`}</b>
          <span>avg {ym === thisMonth ? "this month" : monthName(ym).split(" ")[0]}</span>
        </div>
        <div className="stat">
          <b style={{ color: "#d8c6ff" }}>{game.streak.shields}</b>
          <span>shield{game.streak.shields === 1 ? "" : "s"} left</span>
        </div>
        <div className="stat">
          <b style={{ color: "#ffc4d8" }}>{kfmt(xpInMonth(snap.xp, ym))}</b>
          <span>XP earned</span>
        </div>
      </div>

      <div className="card">
        <div className="cal-head">
          <button className="btn ghost" aria-label="Previous month" disabled={idx <= 0} onClick={() => setYm(shiftMonth(ym, -1))}>
            ‹
          </button>
          <h2 style={{ margin: 0 }}>{monthName(ym)}</h2>
          <button className="btn ghost" aria-label="Next month" disabled={idx >= JOURNEY_MONTHS.length - 1} onClick={() => setYm(shiftMonth(ym, 1))}>
            ›
          </button>
        </div>
        <div className="cal-grid" role="grid" aria-label={monthName(ym)}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={"h" + i} className="cal-wd" aria-hidden="true">
              {d}
            </span>
          ))}
          {monthCells(ym).map((d, i) => {
            if (!d) return <span key={"b" + i} />;
            const r = d <= today ? dayOn(d) : null;
            const tone = dayTone(d, today, r);
            const gym = !!snap.habits.get(d)?.gym && sessionFor(d).kind !== "rest";
            const star = xpLevelDays.has(d) || trainingUps.has(d);
            const shield = game.streak.marks.get(d) === "shield";
            const label = `${longDate(d)}${r ? (r.rest ? ", rest day" : `, ${r.pct}%`) : ""}${gym ? ", gym" : ""}${star ? ", level up" : ""}${shield ? ", shield used" : ""}`;
            return (
              <button key={d} className={"cal-day " + tone} disabled={tone === "outside" || tone === "future"} onClick={() => setOpen(d)} aria-label={label}>
                <span className="n">{Number(d.slice(8))}</span>
                {(gym || star || shield) && (
                  <span className="marks" aria-hidden="true">
                    {gym && <i className="m-gym" />}
                    {star && <i className="m-star">★</i>}
                    {shield && <i className="m-shield">⛨</i>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="cal-legend" aria-hidden="true">
          <span><i className="sw dim" />Under 50%</span>
          <span><i className="sw aqua" />50–79%</span>
          <span><i className="sw gold" />80%+</span>
          <span><i className="sw rest" />Rest</span>
          <span><i className="m-gym" />Gym</span>
          <span><i className="m-star">★</i>Level up</span>
          <span><i className="m-shield">⛨</i>Shield used</span>
        </div>
      </div>

      <div className="card">
        <h2>
          Skill growth <span className="sub">{monthName(ym)}</span>
        </h2>
        <ul className="growth">
          {growth.map((g) => {
            const s = SKILLS.find((x) => x.key === g.skill)!;
            const [c1, c2] = SKILL_COLOR[g.skill];
            return (
              <li key={g.skill}>
                <span className="g-name">{s.name}</span>
                <span className="g-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.round((g.xp / maxXp) * 100))}%`, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
                </span>
                <span className="g-gain">{g.gain > 0 ? `+${g.gain} Lv` : `${g.xp} XP`}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="lumi-row">
        <div className="lumi-float">
          <Lumi size={54} />
        </div>
        <div className="bubble">{calendarLine(bestWeek(weeks), growth)}</div>
      </div>

      {open && <DaySheet p={p} date={open} today={today} pct={dayOn(open)} star={xpLevelDays.get(open) ?? null} training={trainingUps.get(open) ?? null} onClose={() => setOpen(null)} />}
    </>
  );
}

function DaySheet({
  p,
  date,
  today,
  pct,
  star,
  training,
  onClose,
}: {
  p: Planner;
  date: string;
  today: string;
  pct: { pct: number; rest: boolean };
  star: number | null;
  training: string | null;
  onClose: () => void;
}) {
  const snap = p.snap!;
  const habits = snap.habits.get(date) ?? {};
  const session = sessionFor(date);
  const xp = snap.xp.filter((e) => e.date === date);
  const xpTotal = xp.reduce((s, e) => s + e.amount, 0);
  const quests = dailyQuests(date, habits);
  const lesson = snap.german.find((l) => l.date === date);
  const hs = habitsOn(date);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet day-sheet" role="dialog" aria-modal="true" aria-label={longDate(date)} onClick={(e) => e.stopPropagation()}>
        <h2>
          {longDate(date)} <span className="sub">{pct.rest ? "Rest day" : `${pct.pct}%`}</span>
        </h2>
        {habits[REST_DAY_KEY] && <div className="muted small">Marked as a rest / sick day.</div>}
        {(star || training) && (
          <div className="note">
            ★ {[star ? `Reached Level ${star}` : null, training].filter(Boolean).join(" · ")}
          </div>
        )}
        <h3>Workout</h3>
        <div className="muted">
          {session.kind === "rest" ? "Rest day" : `${session.title}: ${habits.gym ? "done ✨" : date === today ? "not yet" : "not done"}`}
        </div>
        <h3>Quests</h3>
        <ul className="tasks">
          {quests.map((q) => (
            <li key={q.id}>
              <span className="txt">
                {q.done ? "✓ " : "○ "}
                {q.title}
              </span>
            </li>
          ))}
          {lesson && (
            <li>
              <span className="txt">✓ Nicos Weg lesson {lesson.lesson}{lesson.title ? `: ${lesson.title}` : ""}</span>
            </li>
          )}
        </ul>
        {snap.meals.some((m) => m.date === date) && (
          <>
            <h3>Meals</h3>
            <div className="muted small">
              {snap.meals
                .filter((m) => m.date === date)
                .map((m) => `${m.slot[0].toUpperCase()}${m.slot.slice(1)}: ${m.ate === "plan" ? "as planned" : m.note || "something else"}`)
                .join(" · ")}
            </div>
          </>
        )}
        <h3>Habits</h3>
        <div className="muted small">
          {hs.filter((h) => habits[h.key]).map((h) => h.label).join(" · ") || "None ticked"}
        </div>
        <h3>
          XP <span className="sub">{xpTotal >= 0 ? "+" : ""}{xpTotal}</span>
        </h3>
        <ul className="tasks">
          {xp.length ? (
            xp.map((e) => (
              <li key={e.eventKey}>
                <span className="txt">
                  {e.reason || e.source} <span className="muted">· {e.amount > 0 ? "+" : ""}{e.amount}</span>
                </span>
              </li>
            ))
          ) : (
            <li className="empty">No XP this day.</li>
          )}
        </ul>
        <button className="btn wide" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
