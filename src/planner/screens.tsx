import React, { useEffect, useMemo, useRef, useState } from "react";
import { Block, SCHEDULE } from "./plan";
import { Kingdom } from "./kingdom";
import { ANCHORS, anchorMl, daysAtGoalThisWeek, DRINKS, GLASS_ML, litres, waterMilestone } from "./water";
import {
  addDays,
  csvRows,
  currentSlotIndex,
  dayOfWeek,
  dayProgress,
  REST_DAY_KEY,
  REST_DAYS_PER_WEEK,
  restDaysLeft,
  formatTime,
  habitsOn,
  phaseFor,
  studyTrackFor,
  ticksOn,
  usesStudyTracks,
  toCsv,
} from "./logic";
import {
  bestWeightBefore,
  formatClock,
  longDate,
  formatKg,
  GymItem,
  GymSession,
  lastWeight,
  parseKg,
  sessionFor,
  timerSegments,
  timerState,
} from "./gym";
import {
  addItem,
  alternativesFor,
  CATALOGUE,
  CatalogueEntry,
  CUSTOM_NAME_MAX,
  customKey,
  itemDetails,
  MAX_ITEMS,
  moveItem,
  PlanItem,
  removeItem,
  sessionWithPlans,
  swapItem,
  ALWAYS,
  defaultPlan,
  PlanChange,
  planChanges,
  planKey,
  undoChange,
} from "./workouts";
import type { WorkoutDay } from "./plan";
import { buildReport, reportToText, waterText } from "./report";
import { TRACK_LABEL } from "./study";
import type { NewAiTask, RejectedItem, ValidatedPlan } from "./validate";
import { supabase } from "../supabase";
import { Link, pathForView } from "./router";
import type { Planner } from "./usePlanner";
import { sfx } from "./sound";
import { Btn, Fountain, Lumi, Orb, Progress, sparkleFrom } from "./ui";

export interface ScreenProps {
  p: Planner;
  today: string;
  /** Minutes since midnight, India time. */
  minutes: number;
  toast: (msg: string) => void;
}

const BLOCK_META: Record<Block, { title: string; pill: string; note: string; island: string }> = {
  deep: {
    title: "Deep work",
    pill: "9–11 · 12–1",
    note: "Phone in another room. One task at a time. Unfinished tasks roll over to tomorrow automatically.",
    island: "Market Square",
  },
  study: {
    title: "Course prep & career",
    pill: "2:00–3:30",
    note: "One task per session. Mon/Wed/Fri R · Tue/Thu JavaScript → TypeScript → React · Sat review or German · Sun rest. Type the code yourself, don't copy-paste.",
    island: "Library of Stars",
  },
};

/** Play the next rising note of the day. Call before the tick is applied. */
function playTick(p: Planner, today: string) {
  const n = ticksOn({ date: today, done: p.snap!.done, habits: p.habitsFor(today), exercises: p.exercisesFor(today) }) + 1;
  sfx.tick(n);
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

function lumiLine(args: { pct: number; tasksLeft: number; habitsLeft: number; minutes: number; gym: GymSession; gymDone: boolean }) {
  const { pct, tasksLeft, habitsLeft, minutes, gym, gymDone } = args;
  const q = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (pct >= 100) return "Every quest is done. The whole kingdom is glowing tonight.";
  if (minutes < 9 * 60 && gym.kind !== "rest" && !gymDone) return `${gym.title} first. The Crystal Mountains are waiting.`;
  if (minutes >= 19 * 60 && tasksLeft) return `${q(tasksLeft, "quest")} left before the stars come out. You've got this!`;
  if (!tasksLeft && habitsLeft) return `All quests done! Just ${q(habitsLeft, "habit")} to go.`;
  return `${q(tasksLeft, "quest")} and ${q(habitsLeft, "habit")} to go today. One at a time.`;
}

/** "Rest / sick day": the streak skips today (max 2 a week; Sundays are rest anyway). */
function RestDayButton({ p, today, toast }: { p: ScreenProps["p"]; today: string; toast: (m: string) => void }) {
  const habits = p.habitsFor(today);
  const marked = !!habits[REST_DAY_KEY];
  const left = restDaysLeft(p.snap!.habits, today);
  if (new Date(today + "T12:00:00Z").getUTCDay() === 0)
    return <div className="muted rest-note">Sundays are rest days: they never break your streak.</div>;
  if (marked)
    return (
      <div className="row rest-row">
        <span className="muted">
          Marked as a rest / sick day. {left} of {REST_DAYS_PER_WEEK} left this week.
        </span>
        <button
          className="btn ghost"
          onClick={() => {
            p.setHabit(REST_DAY_KEY, false);
            toast("Back to a normal day");
          }}
        >
          Undo
        </button>
      </div>
    );
  return (
    <div className="row rest-row">
      <button
        className="btn ghost"
        disabled={left === 0}
        onClick={() => {
          p.setHabit(REST_DAY_KEY, true);
          toast("Rest day. Look after yourself 💛");
        }}
      >
        Rest / sick day
      </button>
      <span className="muted">{left === 0 ? "Both used this week." : `${left} of ${REST_DAYS_PER_WEEK} left this week`}</span>
    </div>
  );
}

export function TodayScreen({ p, today, minutes, toast }: ScreenProps) {
  const habits = p.habitsFor(today);
  const snap = p.snap!;
  const prog = dayProgress({ lists: p.lists, done: snap.done, habits, water: p.water, waterGoalMl: p.waterGoalMl, date: today });
  const cur = currentSlotIndex(minutes);
  const nextDeep = p.lists.deep.find((i) => !snap.done.has(i.taskId));
  const nextStudy = p.lists.study.find((i) => !snap.done.has(i.taskId));
  const gym = sessionFor(today);
  const hs = habitsOn(today);
  const hdone = hs.filter((h) => habits[h.key]).length;
  const tasksLeft = [...p.lists.deep, ...p.lists.study].filter((i) => !snap.done.has(i.taskId)).length;
  const text = (id?: string) => (id ? p.tasksById.get(id)?.text ?? "(removed task)" : "");
  const line = lumiLine({ pct: prog.pct, tasksLeft, habitsLeft: hs.length - hdone, minutes, gym, gymDone: !!habits.gym });

  return (
    <>
      {p.game ? (
        <Kingdom game={p.game} fallback={line} />
      ) : (
        <div className="lumi-row">
          <div className="lumi-float">
            <Lumi size={64} label="Lumi, your star spirit" />
          </div>
          <div className="bubble" role="status">
            {line}
          </div>
        </div>
      )}
      <div className="card">
        <h2>
          <span>
            Today's progress {prog.rest && <span className="pill">Rest day</span>}
          </span>
          <span className="sub">{prog.pct}%</span>
        </h2>
        <Progress pct={prog.pct} label="Today's progress" />
        {prog.rest ? (
          <div className="muted">Rest day: only water, skincare and the two after-meal walks count. Your streak skips today.</div>
        ) : (
          <div className="muted">Minimum for a bad day: one deep-work task. Never miss twice.</div>
        )}
        <RestDayButton p={p} today={today} toast={toast} />
      </div>
      <AnchorsCard p={p} today={today} toast={toast} />
      <div className="card summary">
        <h2>
          Up next <span className="sub">tap to open</span>
        </h2>
        <ul className="links">
          <li>
            <Link to="/planner/deep">
              <b>Deep work</b>
              <span className="muted">{nextDeep ? "Next: " + text(nextDeep.taskId) : "All done ✨"}</span>
            </Link>
          </li>
          <li>
            <Link to="/planner/study">
              <b>Course prep</b>
              <span className="muted">{nextStudy ? "Next: " + text(nextStudy.taskId) : "All done ✨"}</span>
            </Link>
          </li>
          <li>
            <Link to="/planner/gym">
              <b>Gym · {gym.title}</b>
              <span className="muted">{gym.kind === "rest" ? "Steps only. Recover." : habits.gym ? "Done ✨" : gym.subtitle}</span>
            </Link>
          </li>
          <li>
            <Link to="/planner/habits">
              <b>Habits</b>
              <span className="muted">
                {hdone}/{hs.length} habits · {litres(p.water)} of {litres(p.waterGoalMl)}
              </span>
            </Link>
          </li>
        </ul>
      </div>
      <div className="card timeline">
        <h2>Schedule</h2>
        {SCHEDULE.map((s, i) => {
          const cls = "slot" + (i === cur ? " current" : i < cur ? " past" : "");
          const body = (
            <>
              <span className="t">{formatTime(s.time)}</span>
              <span>
                {s.label}
                {s.link ? " ›" : ""}
              </span>
            </>
          );
          return s.link ? (
            <Link key={s.time} to={pathForView(s.link)} className={cls} aria-current={i === cur ? "time" : undefined}>
              {body}
            </Link>
          ) : (
            <div key={s.time} className={cls} aria-current={i === cur ? "time" : undefined}>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Deep / Study                                                        */
/* ------------------------------------------------------------------ */

export function BlockScreen({ p, today, toast, block }: ScreenProps & { block: Block }) {
  const [draft, setDraft] = useState("");
  const snap = p.snap!;
  const items = p.lists[block];
  const doneCount = items.filter((i) => snap.done.has(i.taskId)).length;
  const meta = BLOCK_META[block];

  const tick = (taskId: string, checked: boolean) => {
    if (checked) {
      playTick(p, today);
      const left = items.filter((i) => i.taskId !== taskId && !snap.done.has(i.taskId)).length;
      if (!left) {
        sfx.blockComplete();
        toast(`${meta.title}: every quest done ✨`);
      }
    }
    p.toggleDone(taskId, checked);
  };

  return (
    <>
      <div className="card">
        <h2>
          {meta.title} <span className="pill">{meta.pill}</span>
        </h2>
        <div className="muted">
          {block === "study" && usesStudyTracks(today)
            ? studyTrackFor(today)
              ? `Today: ${TRACK_LABEL[studyTrackFor(today)!]}`
              : "Sunday: rest. No course prep today."
            : `Phase: ${phaseFor(today).name}`}{" "}
          · {doneCount} of {items.length} done
        </div>
        <Progress pct={items.length ? Math.round((doneCount / items.length) * 100) : 0} label={`${meta.title} progress`} />
      </div>
      <ul className="quests">
        {!items.length && <li className="empty">Nothing left in the plan for today. Add your own quest below.</li>}
        {items.map((it) => {
          const t = p.tasksById.get(it.taskId);
          const done = snap.done.has(it.taskId);
          return (
            <li key={it.taskId} className={"quest" + (done ? " done" : "")}>
              <Orb checked={done} xp={10} label={(done ? "Completed: " : "Mark done: ") + (t?.text ?? it.taskId)} onChange={(v) => tick(it.taskId, v)} />
              <div className="q-body">
                {it.carriedOver && <span className="carry">FROM YESTERDAY</span>}
                <span className="q-text">
                  {t?.isAi && !t.text.startsWith("✨") && <span aria-label="Suggested by AI">✨ </span>}
                  {t?.text ?? "(removed task)"}
                </span>
                <span className="q-meta">{meta.island}</span>
              </div>
              <button
                className="x"
                aria-label={`Remove "${t?.text ?? it.taskId}" from today`}
                onClick={() => {
                  p.removeTask(block, it.taskId);
                  toast(t?.isCustom ? "Task deleted" : "Moved off today, back in the plan");
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <div className="card">
        <form
          className="row"
          style={{ marginTop: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            p.addCustom(block, draft);
            setDraft("");
          }}
        >
          <input
            type="text"
            placeholder="Add a quest…"
            aria-label={`Add a ${meta.title.toLowerCase()} task`}
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Btn className="btn">Add</Btn>
        </form>
        <div className="row">
          <Btn
            className="btn dashed wide"
            onClick={() => {
              const r = p.pull(block);
              toast(r.added ? (r.early ? "Pulled from the next phase" : "Added from the plan") : "Plan is empty ✨");
            }}
          >
            + Summon the next quest from the plan
          </Btn>
        </div>
      </div>
      <div className="note">{meta.note}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Gym                                                                 */
/* ------------------------------------------------------------------ */

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const KIND_SHORT: Record<GymSession["kind"], string> = { strength: "Lift", cardio: "Cardio", yoga: "Yoga", rest: "Rest" };

function Crystals({ lit, total }: { lit: number; total: number }) {
  const n = Math.max(total, 1);
  return (
    <div className="mountain" aria-hidden="true">
      <div className="peak" />
      {Array.from({ length: n }, (_, i) => {
        const x = 14 + (i * 92) / Math.max(n - 1, 1);
        const y = 52 - Math.sin((i / Math.max(n - 1, 1)) * Math.PI) * 38;
        return <i key={i} className={"crystal" + (i < lit ? " lit" : "")} style={{ left: x, top: y }} />;
      })}
    </div>
  );
}

function WeekStrip({ p, today, selected, onSelect }: { p: Planner; today: string; selected: string; onSelect: (d: string) => void }) {
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7));
  return (
    <div className="weekstrip" role="group" aria-label="This week: tap a day to see its session">
      {WEEK_LETTERS.map((l, i) => {
        const d = addDays(monday, i);
        const s = sessionFor(d);
        const done = !!p.habitsFor(d).gym;
        const state = done ? "done" : d === today ? "today" : s.kind === "rest" ? "rest" : d < today ? "missed" : "plan";
        return (
          <div key={d} className="wd">
            <span className="l" aria-hidden="true">{l}</span>
            <Btn
              className={"wbox " + state + (d === selected ? " selected" : "")}
              aria-pressed={d === selected}
              aria-label={`${longDate(d)}: ${s.title}${done ? ", done" : ""}`}
              onClick={() => onSelect(d)}
            >
              {KIND_SHORT[s.kind]}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}

function KgInput({ item, value, onSave }: { item: GymItem; value: number | null; onSave: (kg: number | null) => boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  return (
    <label className="kg">
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Weight for ${item.name}, kg`}
        placeholder="–"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!onSave(text === "" ? null : (parseKg(text) as any))) setText(value == null ? "" : String(value));
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      kg
    </label>
  );
}

/** Countdown for one yoga pose. Uses timestamps, so it stays right if the phone lags. */
function YogaTimerPanel({ item, onFinish, onStop }: { item: GymItem; onFinish: () => void; onStop: () => void }) {
  const segs = useMemo(() => timerSegments(item.timer!), [item]);
  const [startAt, setStartAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastIdx = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    // Keep the screen on during the pose.
    let lock: any = null;
    (navigator as any).wakeLock?.request?.("screen").then((l: any) => (lock = l)).catch(() => {});
    return () => {
      clearInterval(id);
      lock?.release?.().catch?.(() => {});
    };
  }, []);

  const elapsed = ((pausedAt ?? now) - startAt) / 1000;
  const st = timerState(segs, elapsed);
  const seg = segs[st.index];

  useEffect(() => {
    if (st.finished) {
      if (!finished.current) {
        finished.current = true;
        sfx.done();
        onFinish();
      }
    } else if (st.index !== lastIdx.current) {
      lastIdx.current = st.index;
      sfx.cue();
    }
  }, [st.index, st.finished]);

  const segPct = seg ? Math.round(((seg.seconds - st.remaining) / seg.seconds) * 100) : 100;
  return (
    <div className={"timer" + (seg?.rest ? " rest" : "")}>
      <div className="t-label" aria-live="polite">
        {st.finished ? "Done. Lovely." : seg.label}
      </div>
      <div className="t-clock" role="timer" aria-label={`${st.remaining} seconds left`}>
        {formatClock(st.remaining)}
      </div>
      <Progress pct={st.finished ? 100 : segPct} label="Pose progress" />
      <div className="row">
        {!st.finished && (
          <Btn
            className="btn ghost"
            onClick={() => {
              if (pausedAt == null) setPausedAt(Date.now());
              else {
                setStartAt((s) => s + (Date.now() - pausedAt));
                setPausedAt(null);
              }
            }}
          >
            {pausedAt == null ? "Pause" : "Resume"}
          </Btn>
        )}
        <Btn className="btn ghost" onClick={onStop}>
          {st.finished ? "Close" : "Stop"}
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Swap / edit workouts (Part B)                                       */
/* ------------------------------------------------------------------ */

type Pick = { key: string; name?: string };

/** Bottom sheet: pick an exercise (alternatives or "Other…"), then "Just today" / "Always". */
function ExerciseSheet({
  title,
  options,
  askScope,
  onDone,
  onClose,
}: {
  title: string;
  options: CatalogueEntry[];
  /** Ask "Just today" / "Always" after picking (false = the caller already knows). */
  askScope: boolean;
  onDone: (pick: Pick, scope: "today" | "always") => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Pick | null>(null);
  const [other, setOther] = useState("");
  const choose = (pick: Pick) => (askScope ? setPicked(pick) : onDone(pick, "today"));
  const pickedName = picked ? picked.name ?? CATALOGUE.get(picked.key)?.name ?? picked.key : "";
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{picked ? `Use ${pickedName}` : title}</h2>
        {!picked ? (
          <>
            <ul className="sheet-list">
              {options.map((o) => (
                <li key={o.key}>
                  <Btn className="sheet-opt" onClick={() => choose({ key: o.key })}>
                    <b>{o.name}</b>
                    <span className="muted">{o.plan}</span>
                  </Btn>
                </li>
              ))}
            </ul>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const name = other.trim().slice(0, CUSTOM_NAME_MAX);
                const key = customKey(name);
                if (key) choose({ key, name });
              }}
            >
              <input
                type="text"
                placeholder="Other…"
                aria-label="Other exercise name"
                maxLength={CUSTOM_NAME_MAX}
                value={other}
                onChange={(e) => setOther(e.target.value)}
              />
              <Btn className="btn" disabled={!customKey(other)}>
                Use
              </Btn>
            </form>
          </>
        ) : (
          <div className="row">
            <Btn className="btn" onClick={() => onDone(picked, "today")}>
              Just today
            </Btn>
            <Btn className="btn ghost" onClick={() => onDone(picked, "always")}>
              Always swap
            </Btn>
          </div>
        )}
        <div className="row">
          <Btn className="btn ghost wide" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** Edit mode: reorder, remove, add. Changes apply to this day or always (toggle). */
function EditWorkout({
  p,
  w,
  day,
  plan,
  toast,
  onClose,
}: {
  p: Planner;
  w: WorkoutDay;
  day: string;
  plan: PlanItem[];
  toast: (m: string) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"today" | "always">("today");
  const [adding, setAdding] = useState(false);
  const apply = (fn: (l: PlanItem[]) => PlanItem[]) => p.editWorkout(w, day, scope, fn);
  const present = new Set(plan.map((i) => i.key));
  return (
    <div className="card edit-workout">
      <h2>
        Edit Day {w} <span className="sub">{scope === "today" ? `only ${longDate(day)}` : "every Day " + w}</span>
      </h2>
      <div className="seg" role="group" aria-label="Apply changes to">
        <Btn className={scope === "today" ? "on" : ""} aria-pressed={scope === "today"} onClick={() => setScope("today")}>
          Just this day
        </Btn>
        <Btn className={scope === "always" ? "on" : ""} aria-pressed={scope === "always"} onClick={() => setScope("always")}>
          Always
        </Btn>
      </div>
      <ul className="edit-list">
        {plan.map((it, i) => {
          const name = itemDetails(it).name;
          return (
            <li key={it.key}>
              <span className="q-text">{name}</span>
              <Btn className="icon-btn" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => apply((l) => moveItem(l, i, -1))}>
                ↑
              </Btn>
              <Btn className="icon-btn" aria-label={`Move ${name} down`} disabled={i === plan.length - 1} onClick={() => apply((l) => moveItem(l, i, 1))}>
                ↓
              </Btn>
              <Btn
                className="icon-btn"
                aria-label={`Remove ${name}`}
                disabled={plan.length <= 1}
                onClick={() => {
                  apply((l) => removeItem(l, i));
                  toast(`${name} removed ${scope === "today" ? "for this day" : "from every Day " + w}`);
                }}
              >
                ×
              </Btn>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <Btn className="btn dashed wide" disabled={plan.length >= MAX_ITEMS} onClick={() => setAdding(true)}>
          + Add an exercise
        </Btn>
      </div>
      <div className="row">
        <Btn className="btn wide" onClick={onClose}>
          Done
        </Btn>
      </div>
      {adding && (
        <ExerciseSheet
          title="Add an exercise"
          options={[...CATALOGUE.values()].filter((e) => !present.has(e.key))}
          askScope={false}
          onClose={() => setAdding(false)}
          onDone={(pick) => {
            apply((l) => addItem(l, pick));
            setAdding(false);
            toast(`Added ${pick.name ?? CATALOGUE.get(pick.key)?.name} ${scope === "today" ? "for this day" : "to every Day " + w}`);
          }}
        />
      )}
    </div>
  );
}

export function GymScreen({ p, today, toast }: ScreenProps) {
  // The day being shown: today by default; tap another day in the week strip to see it.
  // Past days can still be ticked (catch up on a forgotten log); future days are a preview.
  const [day, setDay] = useState(today);
  useEffect(() => setDay(today), [today]);
  const isToday = day === today;
  const future = day > today;
  const session = sessionWithPlans(day, p.workoutPlans);
  const logs = p.exercisesFor(day);
  const all = p.snap!.exercises;
  const [active, setActive] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setActive(null);
    setSwapping(null);
    setEditing(false);
  }, [day]);
  const w = session.workout;
  const doneCount = session.items.filter((i) => logs[i.key]?.done).length;
  const habits = p.habitsFor(day);

  const plannedOf = (key: string) => session.plan.find((i) => i.key === key)?.planned ?? null;
  const tick = (item: GymItem, checked: boolean) => {
    if (future) return;
    if (checked) playTick(p, today);
    const completed = p.setExercise(session, item.key, { done: checked, sets: item.sets ?? null, plannedKey: plannedOf(item.key) }, day);
    if (completed) {
      sfx.blockComplete();
      toast(`${session.title} done. Gym habit ticked ✨`);
    }
  };

  return (
    <>
      <div className="card gym-hero">
        <Crystals lit={doneCount} total={session.items.length || 5} />
        <div className="gh-body">
          <span className="eyebrow">
            {isToday ? session.subtitle.toUpperCase() : `${future ? "PREVIEW" : "PAST DAY"} · ${longDate(day).toUpperCase()}`}
          </span>
          <h2 style={{ margin: 0 }}>{session.title}</h2>
          {session.kind === "rest" ? (
            <span className="muted">Steps only. Recover.</span>
          ) : (
            <>
              <span className="muted">
                {doneCount} of {session.items.length} {session.kind === "yoga" ? "poses" : "crystals"} lit{isToday ? " today" : ""}
              </span>
              <Progress pct={Math.round((doneCount / session.items.length) * 100)} label="Session progress" />
            </>
          )}
        </div>
      </div>
      <WeekStrip p={p} today={today} selected={day} onSelect={setDay} />
      {!isToday && (
        <div className="note day-note">
          <span>{future ? "This is a preview. You can tick it on the day." : "Catching up: ticks and weights save to this day."}</span>
          <Btn className="btn ghost" onClick={() => setDay(today)}>
            Back to today
          </Btn>
        </div>
      )}

      {session.kind === "rest" && (
        <div className="lumi-row">
          <div className="lumi-float">
            <Lumi size={64} mood="happy" />
          </div>
          <div className="bubble">Rest day. Steps only. Recover. Your muscles grow while you rest.</div>
        </div>
      )}

      {editing && w && <EditWorkout p={p} w={w} day={day} plan={session.plan} toast={toast} onClose={() => setEditing(false)} />}

      {session.items.length > 0 && !editing && (
        <ul className="quests">
          {session.items.map((item, index) => {
            const planned = session.plan[index]?.planned;
            const swappedFrom = session.kind === "strength" && planned && planned !== item.key ? CATALOGUE.get(planned)?.name : null;
            const log = logs[item.key];
            const done = !!log?.done;
            const last = item.weighted ? lastWeight(all, item.key, day) : null;
            const best = item.weighted ? bestWeightBefore(all, item.key, day) : null;
            const pb = log?.weightKg != null && best != null && log.weightKg > best;
            return (
              <li key={item.key} className={"quest" + (done ? " done" : "")}>
                <Orb
                  checked={done}
                  disabled={future}
                  label={(future ? "Preview: " : done ? "Done: " : "Mark done: ") + item.name}
                  onChange={(v) => tick(item, v)}
                />
                <div className="q-body">
                  <span className="q-text">{item.name}</span>
                  {item.tip && <span className="tip">{item.tip}</span>}
                  <span className="q-meta">
                    {item.plan}
                    {item.weighted && ` · Last: ${last ? formatKg(last.weightKg) : "–"}`}
                  </span>
                  {swappedFrom && <span className="q-meta swapped">instead of {swappedFrom}</span>}
                  {session.kind === "strength" && (
                    <button className="link-btn" onClick={() => setSwapping(index)} aria-label={`Swap ${item.name}`}>
                      ⇄ Swap
                    </button>
                  )}
                </div>
                {pb && <span className="chip gold">NEW BEST</span>}
                {item.weighted && !future && (
                  <KgInput
                    item={item}
                    value={log?.weightKg ?? null}
                    onSave={(kg) => {
                      if ((kg as any) === "invalid") {
                        toast("Weight should be a number like 22.5");
                        return false;
                      }
                      if (kg !== (log?.weightKg ?? null))
                        p.setExercise(session, item.key, { weightKg: kg, sets: item.sets ?? null, plannedKey: plannedOf(item.key) }, day);
                      return true;
                    }}
                  />
                )}
                {item.timer && active !== item.key && (
                  <Btn className="btn ghost start" onClick={() => setActive(item.key)} aria-label={`Start ${item.name}`}>
                    Start
                  </Btn>
                )}
                {item.timer && active === item.key && (
                  <YogaTimerPanel
                    item={item}
                    onFinish={() => !done && !future && tick(item, true)}
                    onStop={() => setActive(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {swapping !== null && w && session.items[swapping] && (
        <ExerciseSheet
          title={`Swap ${session.items[swapping].name}`}
          options={alternativesFor(session.plan[swapping].planned ?? session.items[swapping].key).filter(
            (o) => !session.plan.some((it) => it.key === o.key),
          )}
          askScope
          onClose={() => setSwapping(null)}
          onDone={(pick, scope) => {
            const from = session.items[swapping].name;
            p.editWorkout(w, day, scope, (l) => swapItem(l, swapping, pick));
            setSwapping(null);
            const to = pick.name ?? CATALOGUE.get(pick.key)?.name ?? pick.key;
            toast(scope === "today" ? `${to} instead of ${from}, just this day` : `${to} instead of ${from}, every Day ${w}`);
          }}
        />
      )}
      {session.kind === "strength" && !editing && (
        <div className="row">
          <Btn className="btn ghost" onClick={() => setEditing(true)}>
            Edit workout
          </Btn>
          <Link to="/planner/settings" className="btn ghost">
            My workouts
          </Link>
        </div>
      )}
      {habits.gym && session.kind !== "rest" && <div className="note">Gym habit ticked for today ✨</div>}
      {session.kind === "strength" && (
        <div className="note">Add a little weight or one more rep each week. Rest 60–90 s between sets.</div>
      )}
      {session.kind === "yoga" && <div className="note">Tap Start on a pose. You'll hear a soft chime to switch sides and when it's done.</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Water (Part C)                                                      */
/* ------------------------------------------------------------------ */

/** Add water and celebrate milestones. Never shames: going down is silent. */
function useDrink(p: Planner, toast: (m: string) => void) {
  return (deltaMl: number, what?: string) => {
    const [before, after] = p.addWater(deltaMl);
    celebrateWater(p, toast, before, after, what);
  };
}

function celebrateWater(p: Planner, toast: (m: string) => void, before: number, after: number, what?: string) {
  sfx.water(before, after, p.waterGoalMl);
  const m = waterMilestone(before, after, p.waterGoalMl);
  if (m === "full") {
    sparkleFrom(document.querySelector(".fountain"));
    toast(`Fountain full: ${litres(after)} ✨`);
  } else if (m === "half") toast(`Halfway there: ${litres(after)} 💧`);
  else if (what && after > before) toast(`${what}: ${litres(after)} today`);
}

function WaterSummary({ p, today, size = 96 }: { p: Planner; today: string; size?: number }) {
  const days = daysAtGoalThisWeek(p.snap!.water, p.waterGoalMl, today);
  return (
    <div className="water-summary">
      <Fountain pct={p.water / p.waterGoalMl} size={size} label={`Fountain ${Math.round((p.water / p.waterGoalMl) * 100)}% full`} />
      <div className="ws-text">
        <span className="ws-big">
          {litres(p.water)} <span className="muted">of {litres(p.waterGoalMl)}</span>
        </span>
        <span className="muted">
          This week's goal: {litres(p.waterGoalMl)} · {days} of 7 days so far
        </span>
        <span className="muted">Moonlit Garden fountain</span>
      </div>
    </div>
  );
}

export function WaterCard({ p, today, toast }: { p: Planner; today: string; toast: (m: string) => void }) {
  const drink = useDrink(p, toast);
  return (
    <div className="card">
      <h2>Water</h2>
      <WaterSummary p={p} today={today} />
      <div className="row">
        <Btn className="btn" onClick={() => drink(p.bottleMl, "Bottle")}>
          Finished a bottle ({litres(p.bottleMl)})
        </Btn>
        <Btn className="btn ghost" onClick={() => drink(GLASS_ML, "Glass")}>
          +250 ml glass
        </Btn>
      </div>
      <div className="drinks" role="group" aria-label="Other drinks">
        {DRINKS.map((d) => (
          <Btn key={d.key} className="chip-btn" onClick={() => drink(d.ml, d.label)}>
            {d.label} <span className="muted">+{d.ml} ml</span>
          </Btn>
        ))}
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        <Btn className="btn ghost" disabled={p.water <= 0} onClick={() => drink(-GLASS_ML)}>
          −250 ml (fix a mistake)
        </Btn>
        <Link to="/planner/settings" className="muted" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
          Bottle size: {litres(p.bottleMl)} ›
        </Link>
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        Shared with Sanctuary. Other drinks count too.
      </div>
    </div>
  );
}

/** Today: tiny water quests tied to things you already do. */
export function AnchorsCard({ p, today, toast }: { p: Planner; today: string; toast: (m: string) => void }) {
  const habits = p.habitsFor(today);
  const done = ANCHORS.filter((a) => habits[a.key]).length;
  return (
    <div className="card">
      <h2>
        Water anchors <span className="sub">{done}/{ANCHORS.length}</span>
      </h2>
      <WaterSummary p={p} today={today} size={72} />
      <ul className="anchors">
        {ANCHORS.map((a) => {
          const on = !!habits[a.key];
          const bottle = p.fromBottle(a.key);
          return (
            <li key={a.key} className={on ? "done" : ""}>
              <Orb
                checked={on}
                label={(on ? "Done: " : "Mark done: ") + a.label}
                onChange={(v) => {
                  if (v) playTick(p, today);
                  const [before, after] = p.tickAnchor(a, v);
                  celebrateWater(p, toast, before, after);
                }}
              />
              <span className="a-text">
                {a.label}
                <span className="muted">{a.ml ? (bottle ? " · check-off (from my bottle)" : ` · +${anchorMl(a, false)} ml`) : " · check-off"}</span>
              </span>
              {a.ml > 0 && (
                <Btn
                  className={"toggle-chip" + (bottle ? " on" : "")}
                  aria-pressed={bottle}
                  disabled={on}
                  title={on ? "Untick first to change this" : undefined}
                  onClick={() => p.setFromBottle(a.key, !bottle)}
                >
                  from my bottle
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WaterSettings({ p, toast }: { p: Planner; toast: (m: string) => void }) {
  return (
    <div className="card">
      <h2>Water</h2>
      <div className="muted" style={{ marginBottom: 8 }}>
        Your bottle size. "Finished a bottle" adds this much.
      </div>
      <div className="bottle-sizes" role="group" aria-label="Bottle size">
        {BOTTLE_SIZES.map((ml) => (
          <Btn
            key={ml}
            className={"chip-btn" + (p.bottleMl === ml ? " on" : "")}
            aria-pressed={p.bottleMl === ml}
            onClick={() => {
              p.setSetting("bottle_ml", ml);
              toast(`Bottle size: ${litres(ml)}`);
            }}
          >
            {litres(ml)}
          </Btn>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        Goal starts at 1.25 L a day and rises 0.25 L after any week with 5 good days, up to 2 L. This week: {litres(p.waterGoalMl)}.
      </div>
    </div>
  );
}

const BOTTLE_SIZES = [500, 750, 1000, 1500, 2000];

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

export function HabitsScreen({ p, today, toast }: ScreenProps) {
  const habits = p.habitsFor(today);
  const snap = p.snap!;
  const week = Array.from({ length: 7 }, (_, k) => addDays(today, k - 6));
  const list = habitsOn(today);
  return (
    <>
      <WaterCard p={p} today={today} toast={toast} />
      <h2 className="section">Habits</h2>
      <ul className="quests">
        {list.map((h) => {
          const on = !!habits[h.key];
          return (
            <li key={h.key} className={"quest" + (on ? " done" : "")}>
              <Orb
                checked={on}
                xp={5}
                label={(on ? "Done: " : "Mark done: ") + h.label}
                onChange={(v) => {
                  if (v) playTick(p, today);
                  p.setHabit(h.key, v);
                }}
              />
              <div className="q-body">
                <span className="q-text">{h.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="card">
        <h2>
          Last 7 days <span className="sub">habits done</span>
        </h2>
        <div className="week">
          {week.map((d) => {
            const hs = snap.habits.get(d);
            const known = !!hs || snap.days.has(d);
            const of = habitsOn(d);
            const cnt = hs ? of.filter((h) => hs[h.key]).length : 0;
            const ratio = cnt / of.length;
            return (
              <div key={d}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][dayOfWeek(d)]}
                <div
                  className={"dot" + (d === today ? " today" : "")}
                  title={`${d}: ${cnt}/${of.length}`}
                  style={{ background: known ? `rgba(142,230,224,${0.12 + ratio * 0.75})` : undefined, color: ratio > 0.55 ? "#1d1546" : undefined }}
                >
                  {known ? cnt : "–"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sound settings                                                      */
/* ------------------------------------------------------------------ */

function useSoundSettings() {
  const [s, setS] = useState(sfx.settings);
  useEffect(() => sfx.subscribe(() => setS(sfx.settings)), []);
  return s;
}

export function SoundCard() {
  const s = useSoundSettings();
  return (
    <div className="card">
      <h2>Sound & vibration</h2>
      <label className="switch">
        <input type="checkbox" checked={s.sound} onChange={(e) => sfx.update({ sound: e.target.checked })} />
        <span>Sounds</span>
      </label>
      <label className="slider">
        <span>Volume {Math.round(s.volume * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(s.volume * 100)}
          disabled={!s.sound}
          onChange={(e) => sfx.update({ volume: Number(e.target.value) / 100 })}
        />
      </label>
      <label className="switch">
        <input type="checkbox" checked={s.vibrate} onChange={(e) => sfx.update({ vibrate: e.target.checked })} />
        <span>Vibration</span>
      </label>
      <div className="row">
        <Btn className="btn ghost" onClick={() => sfx.tick(1)}>
          Test sound
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review + data                                                       */
/* ------------------------------------------------------------------ */

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewScreen({ p, today, toast }: ScreenProps) {
  const snap = p.snap!;
  const [notes, setNotes] = useState(p.day?.notes ?? "");
  const [backup, setBackup] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const report = useMemo(
    () =>
      buildReport({
        date: today,
        lists: p.lists,
        tasks: snap.tasks,
        done: snap.done,
        habits: p.habitsFor(today),
        water: p.water,
        waterGoalMl: p.waterGoalMl,
        notes,
      }),
    [today, p.lists, snap, p.water, p.waterGoalMl, notes],
  );

  const csv = () => {
    const days = [...snap.days.keys()].map((date) => ({
      date,
      lists: snap.days.get(date)!.lists,
      habits: snap.habits.get(date) ?? {},
      water: snap.water.get(date) ?? 0,
    }));
    return toCsv(csvRows(days, p.tasksById, snap.done));
  };

  return (
    <>
      <div className="card">
        <h2>
          Evening review <span className="pill">8:30 pm</span>
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tonight's report: what you ticked, what you didn't, and the next tasks in your plan, each with its ID.
        </p>
        {(["deep", "study"] as Block[]).map((b) => {
          const x = report.blocks[b];
          return (
            <div key={b} style={{ marginBottom: 12 }}>
              <b>{b === "deep" ? "🎯 Deep work" : "📚 Course prep"}</b>{" "}
              <span className="muted">
                {x.done.length}/{x.done.length + x.notDone.length} done
              </span>
              <ul className="tasks">
                {x.done.map((t) => (
                  <li key={t.id} className="done" style={{ padding: "8px 0" }}>
                    <span className="txt">
                      ✅ {t.text} <code className="id">{t.id}</code>
                    </span>
                  </li>
                ))}
                {x.notDone.map((t) => (
                  <li key={t.id} style={{ padding: "8px 0" }}>
                    <span className="txt">
                      ○ {t.text} <code className="id">{t.id}</code>
                    </span>
                  </li>
                ))}
              </ul>
              <details>
                <summary className="muted" style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>
                  Next {x.next.length} in the plan
                </summary>
                <ul className="tasks">
                  {x.next.map((t) => (
                    <li key={t.id} style={{ padding: "6px 0" }}>
                      <span className="txt">
                        {t.text} <code className="id">{t.id}</code>
                        {t.future && <span className="muted"> · starts {t.phaseStart}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          );
        })}
        <div className="muted">
          Habits {report.habitsDone.length}/{report.habitsDone.length + report.habitsMissed.length} · water {waterText(report)}
          {report.habitsMissed.length ? ` · missed: ${report.habitsMissed.join("; ")}` : ""}
        </div>
        <label className="muted" htmlFor="review-notes" style={{ display: "block", marginTop: 12 }}>
          Notes for tomorrow (optional)
        </label>
        <textarea
          id="review-notes"
          className="notes"
          value={notes}
          maxLength={2000}
          placeholder="e.g. CA meeting at 10, keep deep work light"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (p.day?.notes ?? "") && p.setNotes(notes)}
        />
        <div className="row">
          <button
            className="btn ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reportToText(report));
                toast("Report copied");
              } catch {
                toast("Couldn't copy. Select the text manually.");
              }
            }}
          >
            Copy report
          </button>
        </div>
        <AiPlanner p={p} today={today} notes={notes} toast={toast} />
      </div>

      <div className="card">
        <h2>Settings</h2>
        <div className="row" style={{ marginTop: 0 }}>
          <Link to="/planner/settings" className="btn ghost">
            Sound, vibration and my workouts
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>Export for Python</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          One row per task, habit and water (ml) per day: <code>date, category, item, done</code>.
        </p>
        <div className="row">
          <button className="btn" onClick={() => download(`saisha-planner-${today}.csv`, csv(), "text/csv")}>
            Download CSV
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(csv());
                toast("CSV copied");
              } catch {
                toast("Couldn't copy. Use Download instead.");
              }
            }}
          >
            Copy CSV
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Import prototype backup</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Paste the text from the old planner's "Copy backup" button. Days that already exist here are kept as they are,
          so it's safe to run twice.
        </p>
        <textarea
          aria-label="Prototype backup JSON"
          value={backup}
          onChange={(e) => setBackup(e.target.value)}
          placeholder='{"days":{...},"done":{...},"custom":{...}}'
        />
        <div className="row">
          <button
            className="btn"
            disabled={busy || !backup.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const s = await p.importBackup(backup);
                setImportMsg({
                  ok: true,
                  text:
                    `Imported ${s.days} day(s), ${s.completions} completed task(s), ${s.customTasks} custom task(s).` +
                    (s.skipped.length ? `\nSkipped ${s.skipped.length}:\n` + s.skipped.join("\n") : ""),
                });
                setBackup("");
              } catch (e: any) {
                setImportMsg({ ok: false, text: e.message ?? String(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
        {importMsg && (
          <div className={"note" + (importMsg.ok ? "" : " error")} style={{ whiteSpace: "pre-wrap" }}>
            {importMsg.text}
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* AI planning for tomorrow                                            */
/* ------------------------------------------------------------------ */

interface ReviewResponse {
  date: string;
  tomorrow: string;
  tomorrowHasList: boolean;
  model: string;
  /** "default": Gemini left a block empty twice, so the normal plan filled it. */
  source?: "ai" | "ai-retry" | "default";
  defaultBlocks?: Block[];
  plan: ValidatedPlan;
}

/** Nothing to save: both lists and the new tasks are empty. */
export function isEmptyPreview(plan: ValidatedPlan): boolean {
  return !plan.lists.deep.length && !plan.lists.study.length && !plan.newTasks.length;
}

async function plannerApi<T>(path: string, body: unknown): Promise<T> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
  if (!token) throw new Error("Sign in to use the AI review.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function Rejected({ items }: { items: RejectedItem[] }) {
  if (!items.length) return <div className="muted">No made-up or invalid items ✅</div>;
  return (
    <details open>
      <summary className="muted" style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>
        Rejected {items.length} item{items.length > 1 ? "s" : ""}
      </summary>
      <ul className="tasks">
        {items.map((r, i) => (
          <li key={i} style={{ padding: "6px 0" }}>
            <span className="txt">
              <code className="id">{r.item}</code> <span className="muted">· {r.reason}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AiPlanner({ p, today, notes, toast }: { p: Planner; today: string; notes: string; toast: (m: string) => void }) {
  const [busy, setBusy] = useState<"" | "plan" | "save">("");
  const [preview, setPreview] = useState<ReviewResponse | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const plan = async () => {
    setBusy("plan");
    setResult(null);
    setPreview(null);
    try {
      if (notes !== (p.day?.notes ?? "")) await p.setNotes(notes);
      setPreview(await plannerApi<ReviewResponse>("/api/planner/review", { date: today, notes }));
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    } finally {
      setBusy("");
    }
  };

  const approve = async () => {
    if (!preview) return;
    setBusy("save");
    try {
      const r = await plannerApi<{ saved: { date: string; deep: number; study: number; new: number }; rejected: RejectedItem[] }>(
        "/api/planner/review/approve",
        {
          date: today,
          deep: preview.plan.lists.deep.map((t) => t.id),
          study: preview.plan.lists.study.map((t) => t.id),
          new: preview.plan.newTasks,
        },
      );
      setPreview(null);
      setResult({
        ok: true,
        text:
          `Saved ${r.saved.deep} deep + ${r.saved.study} study task(s) for ${r.saved.date}` +
          (r.saved.new ? `, including ${r.saved.new} new ✨ task(s).` : ".") +
          (r.rejected.length ? ` ${r.rejected.length} item(s) were no longer valid and were skipped.` : ""),
      });
      sfx.goodNight();
      toast("Tomorrow is planned. Good night ✨");
      p.reload();
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    } finally {
      setBusy("");
    }
  };

  const list = (b: Block, newTasks: NewAiTask[]) => (
    <ul className="tasks">
      {preview!.plan.lists[b].map((t) => (
        <li key={t.id} style={{ padding: "6px 0" }}>
          <span className="txt">
            {t.text} <code className="id">{t.id}</code>
          </span>
        </li>
      ))}
      {newTasks
        .filter((n) => n.block === b)
        .map((n, i) => (
          <li key={"n" + i} style={{ padding: "6px 0" }}>
            <span className="txt">
              ✨ {n.text}
              {n.reason && <span className="muted"> · {n.reason}</span>}
            </span>
          </li>
        ))}
      {!preview!.plan.lists[b].length && !newTasks.some((n) => n.block === b) && <li className="empty">Nothing proposed.</li>}
    </ul>
  );

  return (
    <div style={{ marginTop: 14 }}>
      <b>Plan tomorrow with Gemini</b>
      <p className="muted" style={{ marginTop: 4 }}>
        Gemini can only pick task IDs from the report above. The server checks every ID against your plan and drops anything
        made up. Nothing is saved until you tap Approve.
      </p>
      {!preview && (
        <div className="row">
          <button className="btn wide" disabled={!!busy} onClick={plan}>
            {busy === "plan" ? "Asking Gemini… (up to a minute if it’s busy)" : "🤖 Plan tomorrow"}
          </button>
        </div>
      )}
      {preview && (
        <div className="note preview">
          <b>Preview for {preview.tomorrow}</b>{" "}
          <span className="muted">· {preview.source === "default" ? "default plan" : preview.model}</span>
          {preview.source === "default" && (
            <div className="note" role="status">
              Lumi was busy, here's your default plan
              {preview.defaultBlocks && preview.defaultBlocks.length === 1
                ? ` for ${preview.defaultBlocks[0] === "deep" ? "deep work" : "course prep"}`
                : ""}
              : unfinished tasks carried over, then the next tasks in your plan.
            </div>
          )}
          {preview.tomorrowHasList && <div className="note error">Tomorrow already has a list. Approving replaces it.</div>}
          <div style={{ marginTop: 8 }}>
            <b>🎯 Deep</b>
            {list("deep", preview.plan.newTasks)}
          </div>
          <div style={{ marginTop: 8 }}>
            <b>📚 Study</b>
            {list("study", preview.plan.newTasks)}
          </div>
          <div style={{ marginTop: 8 }}>
            <Rejected items={preview.plan.rejected} />
          </div>
          {preview.plan.note && <p style={{ marginBottom: 0 }}>💬 {preview.plan.note}</p>}
          {isEmptyPreview(preview.plan) && (
            <div className="note">Nothing to save. Your normal plan will fill tomorrow.</div>
          )}
          <div className="row">
            <button className="btn" disabled={!!busy || isEmptyPreview(preview.plan)} onClick={approve}>
              {busy === "save" ? "Saving…" : "Approve"}
            </button>
            <button className="btn ghost" disabled={!!busy} onClick={() => setPreview(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className={"note" + (result.ok ? "" : " error")} role="status">
          {result.text}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings: My workouts + sound                                       */
/* ------------------------------------------------------------------ */

function changeText(c: PlanChange): string {
  const n = (k: string, name?: string) => name ?? CATALOGUE.get(k)?.name ?? k;
  switch (c.kind) {
    case "swapped":
      return `${n(c.key, c.name)} instead of ${n(c.planned)}`;
    case "added":
      return `Added ${n(c.key, c.name)}`;
    case "removed":
      return `Removed ${n(c.planned)}`;
    case "reordered":
      return "Order changed";
  }
}

function MyWorkouts({ p, today, toast }: { p: Planner; today: string; toast: (m: string) => void }) {
  const plans = p.workoutPlans;
  return (
    <div className="card">
      <h2>My workouts</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Your permanent changes ("Always swap") and changes for one day. Undo anything here.
      </p>
      {(["A", "B"] as WorkoutDay[]).map((w) => {
        const permanent = plans.get(planKey(w, ALWAYS));
        const changes = permanent ? planChanges(w, permanent) : [];
        const oneDay = [...plans.keys()]
          .filter((k) => k.startsWith(w + "|") && k !== planKey(w, ALWAYS))
          .map((k) => k.split("|")[1])
          .filter((d) => d >= today)
          .sort();
        return (
          <div key={w} className="mw-block">
            <b>Day {w}</b>
            <ol className="mw-list">
              {(permanent ?? defaultPlan(w)).map((it) => (
                <li key={it.key}>{itemDetails(it).name}</li>
              ))}
            </ol>
            {!changes.length && <div className="muted">Same as the default plan.</div>}
            <ul className="tasks">
              {changes.map((c, i) => (
                <li key={i}>
                  <span className="txt">{changeText(c)}</span>
                  <Btn
                    className="btn ghost"
                    onClick={() => {
                      p.editWorkout(w, today, "always", (l) => undoChange(w, l, c));
                      toast("Undone");
                    }}
                  >
                    Undo
                  </Btn>
                </li>
              ))}
            </ul>
            {changes.length > 1 && (
              <div className="row">
                <Btn
                  className="btn ghost"
                  onClick={() => {
                    p.editWorkout(w, today, "always", () => defaultPlan(w));
                    toast(`Day ${w} is back to the default`);
                  }}
                >
                  Reset Day {w} to default
                </Btn>
              </div>
            )}
            {oneDay.map((d) => (
              <div key={d} className="row" style={{ alignItems: "center" }}>
                <span className="muted" style={{ flex: 1 }}>
                  Changed just for {longDate(d)}
                </span>
                <Btn
                  className="btn ghost"
                  onClick={() => {
                    p.editWorkout(w, d, "today", () => plans.get(planKey(w, ALWAYS)) ?? defaultPlan(w));
                    toast("Back to your usual Day " + w);
                  }}
                >
                  Undo
                </Btn>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function SettingsScreen({ p, today, toast }: ScreenProps) {
  return (
    <>
      <MyWorkouts p={p} today={today} toast={toast} />
      <WaterSettings p={p} toast={toast} />
      <SoundCard />
    </>
  );
}
