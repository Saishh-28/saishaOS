import React, { useMemo, useState } from "react";
import { Block, HABITS, SCHEDULE, WATER_MAX, WORKOUT } from "./plan";
import {
  csvRows,
  currentSlotIndex,
  dayOfWeek,
  dayProgress,
  formatTime,
  gymKey,
  phaseFor,
  toCsv,
  workoutFor,
  addDays,
} from "./logic";
import { buildReport, reportToText } from "./report";
import { Link, pathForView } from "./router";
import type { Planner } from "./usePlanner";

export interface ScreenProps {
  p: Planner;
  today: string;
  now: Date;
  toast: (msg: string) => void;
}

const BLOCK_META: Record<Block, { title: string; pill: string; note: string }> = {
  deep: {
    title: "Deep work",
    pill: "9–11 · 12–1",
    note: "Phone in another room. One task at a time. Unfinished tasks roll over to tomorrow automatically.",
  },
  study: {
    title: "Course prep & career",
    pill: "2:00–3:30",
    note: "Proofs: write every proof by hand. R: type the code yourself, don't copy-paste.",
  },
};

function Progress({ pct }: { pct: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

export function TodayScreen({ p, today, now }: ScreenProps) {
  const habits = p.habitsFor(today);
  const snap = p.snap!;
  const prog = dayProgress({ lists: p.lists, done: snap.done, habits, water: p.water });
  const cur = currentSlotIndex(now.getHours() * 60 + now.getMinutes());
  const nextDeep = p.lists.deep.find((i) => !snap.done.has(i.taskId));
  const nextStudy = p.lists.study.find((i) => !snap.done.has(i.taskId));
  const w = workoutFor(today);
  const hdone = HABITS.filter((h) => habits[h.key]).length;
  const text = (id?: string) => (id ? p.tasksById.get(id)?.text ?? "(removed task)" : "");

  return (
    <>
      <div className="card">
        <h2>
          Today's progress <span className="sub">{prog.pct}%</span>
        </h2>
        <Progress pct={prog.pct} />
        <div className="muted">Minimum for a bad day: one deep-work task. Never miss twice.</div>
      </div>
      <div className="card summary">
        <h2>
          Up next <span className="sub">tap a block to open it</span>
        </h2>
        <ul className="tasks">
          <li>
            <Link to="/planner/deep">
              <b>🎯 Deep work</b>
              <br />
              <span className="muted">{nextDeep ? "Next: " + text(nextDeep.taskId) : "All done ✅"}</span>
            </Link>
          </li>
          <li>
            <Link to="/planner/study">
              <b>📚 Course prep</b>
              <br />
              <span className="muted">{nextStudy ? "Next: " + text(nextStudy.taskId) : "All done ✅"}</span>
            </Link>
          </li>
          <li>
            <Link to="/planner/gym">
              <b>💪 Gym</b>
              <br />
              <span className="muted">{w ? `Workout Day ${w}` : "Rest day: walk with Dad counts"}</span>
            </Link>
          </li>
          <li>
            <Link to="/planner/habits">
              <b>💧 Habits</b>
              <br />
              <span className="muted">
                {hdone}/{HABITS.length} habits · {p.water}/{WATER_MAX} glasses
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

  return (
    <>
      <div className="card">
        <h2>
          {meta.title} <span className="pill">{meta.pill}</span>
        </h2>
        <div className="muted">
          Phase: {phaseFor(today).name} · {doneCount}/{items.length} done
        </div>
        <Progress pct={items.length ? Math.round((doneCount / items.length) * 100) : 0} />
        <ul className="tasks">
          {!items.length && <li className="empty">Nothing left in the plan for today. Add your own task below. 🎉</li>}
          {items.map((it) => {
            const t = p.tasksById.get(it.taskId);
            const done = snap.done.has(it.taskId);
            return (
              <li key={it.taskId} className={done ? "done" : ""}>
                <label className="tick">
                  <input
                    type="checkbox"
                    className="chk"
                    checked={done}
                    onChange={(e) => {
                      p.toggleDone(it.taskId, e.target.checked);
                      if (e.target.checked) toast("Nice! ✅");
                    }}
                  />
                  <span className="txt">
                    {it.carriedOver && <span className="carry">↻ from yesterday</span>}
                    {t?.text ?? "(removed task)"}
                  </span>
                </label>
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
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            p.addCustom(block, draft);
            setDraft("");
          }}
        >
          <input
            type="text"
            placeholder="Add a task…"
            aria-label={`Add a ${meta.title.toLowerCase()} task`}
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn">Add</button>
        </form>
        <div className="row">
          <button
            className="btn ghost wide"
            onClick={() => {
              const r = p.pull(block);
              toast(r.added ? (r.early ? "Pulled from the next phase" : "Added from the plan") : "Plan is empty 🎉");
            }}
          >
            + Pull next task from the plan
          </button>
        </div>
      </div>
      <div className="note">{meta.note}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Gym                                                                 */
/* ------------------------------------------------------------------ */

export function GymScreen({ p, today, toast }: ScreenProps) {
  const w = workoutFor(today);
  const ticks = p.habitsFor(today);
  if (!w) {
    return (
      <>
        <div className="card">
          <h2>Rest / active recovery day</h2>
          <div className="muted">Your walk with Dad counts. Optional: 10 min stretching + plank 3 × 30 s.</div>
        </div>
        <div className="note">Strength days are Monday, Wednesday and Friday.</div>
      </>
    );
  }
  return (
    <>
      <div className="card">
        <h2>
          Workout Day {w} <span className="pill">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek(today)]}</span>
        </h2>
        <div className="muted">Full body · ~45 min · tick each exercise as you finish it</div>
        <ul className="tasks">
          {WORKOUT[w].map((ex, i) => {
            const on = !!ticks[gymKey(w, i)];
            return (
              <li key={i} className={on ? "done" : ""}>
                <label className="tick">
                  <input
                    type="checkbox"
                    className="chk"
                    checked={on}
                    onChange={(e) => {
                      if (p.toggleExercise(w, i, e.target.checked)) toast("Workout done 💪");
                    }}
                  />
                  <span className="txt ex">
                    <b>{ex.name}</b>
                    <span className="muted">{ex.sets}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {ticks.gym && <div className="note">Gym habit ticked for today ✅</div>}
      </div>
      <div className="note">Add a little weight or one more rep each week. Rest 60–90 s between sets.</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

export function HabitsScreen({ p, today }: ScreenProps) {
  const habits = p.habitsFor(today);
  const snap = p.snap!;
  const week = Array.from({ length: 7 }, (_, k) => addDays(today, k - 6));
  return (
    <>
      <div className="card">
        <h2>
          Water{" "}
          <span className="sub">
            {p.water}/{WATER_MAX} glasses (~{(p.water * 0.25).toFixed(2).replace(/\.?0+$/, "")} L)
          </span>
        </h2>
        <div className="water" role="group" aria-label="Glasses of water">
          {Array.from({ length: WATER_MAX }, (_, k) => k + 1).map((i) => (
            <button
              key={i}
              className={i <= p.water ? "on" : ""}
              aria-label={`${i} glass${i > 1 ? "es" : ""}`}
              aria-pressed={i <= p.water}
              onClick={() => p.setWater(p.water === i ? i - 1 : i)}
            />
          ))}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Shared with Sanctuary.
        </div>
      </div>
      <div className="card">
        <h2>Habits</h2>
        <ul className="tasks">
          {HABITS.map((h) => {
            const on = !!habits[h.key];
            return (
              <li key={h.key} className={on ? "done" : ""}>
                <label className="tick">
                  <input type="checkbox" className="chk" checked={on} onChange={(e) => p.setHabit(h.key, e.target.checked)} />
                  <span className="txt">{h.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card">
        <h2>
          Last 7 days <span className="sub">habits done</span>
        </h2>
        <div className="week">
          {week.map((d) => {
            const hs = snap.habits.get(d);
            const known = !!hs || snap.days.has(d);
            const cnt = hs ? HABITS.filter((h) => hs[h.key]).length : 0;
            const ratio = cnt / HABITS.length;
            return (
              <div key={d}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][dayOfWeek(d)]}
                <div
                  className="dot"
                  title={`${d}: ${cnt}/${HABITS.length}`}
                  style={{
                    background: known ? `rgba(63,143,107,${0.15 + ratio * 0.85})` : undefined,
                    color: ratio > 0.5 ? "#fff" : undefined,
                  }}
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
        notes,
      }),
    [today, p.lists, snap, p.water, notes],
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
          🤖 Evening review <span className="pill">8:30 pm</span>
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
          Habits {report.habitsDone.length}/{HABITS.length} · water {report.water}/{WATER_MAX}
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
        <div className="note">AI planning for tomorrow arrives in the next stage.</div>
      </div>

      <div className="card">
        <h2>Export for Python</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          One row per task, habit and water count per day: <code>date, category, item, done</code>.
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
