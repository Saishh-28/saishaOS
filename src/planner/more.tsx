/**
 * Screens that moved over from the old dashboard (Part D: one app):
 * More menu, Study → Courses + Career, Care, Music Room, Treasury, Lumi chat,
 * and the Settings cards (About me, Currency, Backup, Sign out).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, signOut } from "../supabase";
import { Link } from "./router";
import type { Planner } from "./usePlanner";
import { useRows, write } from "./db";
import { Btn, Lumi, Orb, Progress } from "./ui";
import { Block } from "./plan";
import {
  BACKUP_TABLES,
  Backup,
  CourseRow,
  CURRENCIES,
  Currency,
  cleanCourseCode,
  coursesByTerm,
  daysUntil,
  gpa,
  GRADES,
  money,
  parseAmount,
  parseCurrency,
  prepareRestore,
  spentThisMonth,
  TransactionRow,
} from "./records";
import { HEALTH_CONFLICT } from "./store";
import { cleanText } from "./validate";
import { sfx } from "./sound";

export interface MoreProps {
  p: Planner;
  today: string;
  userId: string | null;
  toast: (msg: string) => void;
}

function NeedsSignIn() {
  return <div className="note">Sign in to use this screen (it's saved to your Supabase account).</div>;
}

function ErrorNote({ text }: { text: string | null }) {
  return text ? (
    <div className="note error" role="alert">
      {text}
    </div>
  ) : null;
}

/** Ask before a permanent delete. */
const sure = (what: string) => window.confirm(`Delete ${what}? This can't be undone.`);

/* ------------------------------------------------------------------ */
/* More                                                                */
/* ------------------------------------------------------------------ */

const MORE: { to: string; title: string; sub: string }[] = [
  { to: "/planner/calendar", title: "Calendar", sub: "Your 13-week journey, day by day" },
  { to: "/planner/quests", title: "Quests", sub: "Daily, weekly, Nicos Weg German, boss battles" },
  { to: "/planner/rewards", title: "Rewards", sub: "Coins, your reward list, dreams" },
  { to: "/planner/review", title: "Evening review", sub: "Report, plan tomorrow with Lumi, CSV" },
  { to: "/planner/care", title: "Care · Moonlit Garden", sub: "Skin, hair, mood, journal" },
  { to: "/planner/lumi", title: "Talk to Lumi", sub: "Your star spirit; can suggest tasks" },
  { to: "/planner/music", title: "Music Room", sub: "Songs, lyrics, chords" },
  { to: "/planner/treasury", title: "Treasury · Market Square", sub: "Savings, budget, spending" },
  { to: "/planner/settings", title: "Settings", sub: "About me, workouts, water, sound, backup" },
];

export function MoreScreen() {
  return (
    <ul className="links more-list">
      {MORE.map((m) => (
        <li key={m.to}>
          <Link to={m.to}>
            <b>{m.title}</b>
            <span className="muted">{m.sub}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Study: courses + assignments                                        */
/* ------------------------------------------------------------------ */

interface AssignmentRow {
  id: string;
  course_id: string;
  title: string;
  due_date: string;
  weight: number;
  completed: boolean;
}

export function CoursesCard({ today, userId, toast }: MoreProps) {
  const courses = useRows<CourseRow>("courses", userId);
  const assignments = useRows<AssignmentRow>("assignments", userId, { build: (q) => q.order("due_date") });
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!supabase || !userId) return <NeedsSignIn />;
  const list = courses.rows ?? [];
  const groups = coursesByTerm<CourseRow>(list);
  const allGpa = gpa(list);

  const run = async (what: string, q: PromiseLike<any>, reload: () => void) => {
    const e = await write(what, q, reload);
    setErr(e);
    return !e;
  };

  return (
    <div className="card">
      <h2>
        Courses {allGpa != null && <span className="sub">GPA {allGpa.toFixed(2)} / 9</span>}
      </h2>
      <ErrorNote text={err ?? courses.error ?? assignments.error} />
      {courses.rows === null && <div className="muted">Loading…</div>}
      {groups.map((g) => {
        const termGpa = gpa(g.courses);
        return (
          <div key={g.term ?? "none"} className="term">
            <div className="term-head">
              <b>{g.term ?? "No semester set"}</b>
              {termGpa != null && <span className="muted">GPA {termGpa.toFixed(2)}</span>}
            </div>
            <ul className="tasks">
              {g.courses.map((c) => {
                const due = (assignments.rows ?? []).filter((a) => a.course_id === c.id && !a.completed);
                return (
                  <li key={c.id} className="course">
                    <button className="course-row" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                      <span className="txt">
                        <b>{c.code}</b> <span className="muted">{c.name}</span>
                        {due.length > 0 && <span className="muted"> · {due.length} due</span>}
                      </span>
                      {c.final_grade ? (
                        <span className="chip gold">{c.final_grade}</span>
                      ) : c.grade_goal ? (
                        <span className="chip">goal {c.grade_goal}</span>
                      ) : null}
                    </button>
                    {open === c.id && (
                      <CourseEditor
                        course={c}
                        assignments={(assignments.rows ?? []).filter((a) => a.course_id === c.id)}
                        today={today}
                        userId={userId}
                        run={run}
                        reloadCourses={courses.reload}
                        reloadAssignments={assignments.reload}
                        toast={toast}
                        onDeleted={() => setOpen(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {adding ? (
        <AddCourse userId={userId} run={run} reload={courses.reload} onDone={() => setAdding(false)} />
      ) : (
        <div className="row">
          <Btn className="btn dashed wide" onClick={() => setAdding(true)}>
            + Add a course
          </Btn>
        </div>
      )}
    </div>
  );
}

const TERM_OPTIONS = (() => {
  const y = new Date().getFullYear();
  const out: string[] = [];
  for (const yr of [y - 1, y, y + 1]) for (const t of ["SS", "S1", "S2"]) out.push(`${t} ${yr}`);
  return out;
})();

function AddCourse({ userId, run, reload, onDone }: { userId: string; run: any; reload: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [term, setTerm] = useState(TERM_OPTIONS.find((t) => t.startsWith("S1") && t.endsWith(String(new Date().getFullYear() + 1))) ?? TERM_OPTIONS[0]);
  const clean = cleanCourseCode(code);
  return (
    <form
      className="add-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!clean) return;
        const ok = await run("Adding course", supabase!.from("courses").insert({ user_id: userId, code: clean, name: cleanText(name).slice(0, 120) || clean, term, credits: 15 }), reload);
        if (ok) onDone();
      }}
    >
      <input type="text" placeholder="Code, e.g. STATS 220" aria-label="Course code" value={code} onChange={(e) => setCode(e.target.value)} />
      <input type="text" placeholder="Name (optional)" aria-label="Course name" value={name} onChange={(e) => setName(e.target.value)} />
      <select aria-label="Semester" value={term} onChange={(e) => setTerm(e.target.value)}>
        {TERM_OPTIONS.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <div className="row">
        <Btn className="btn" disabled={!clean}>
          Add
        </Btn>
        <Btn type="button" className="btn ghost" onClick={onDone}>
          Cancel
        </Btn>
      </div>
    </form>
  );
}

function CourseEditor(props: {
  course: CourseRow;
  assignments: AssignmentRow[];
  today: string;
  userId: string;
  run: (what: string, q: PromiseLike<any>, reload: () => void) => Promise<boolean>;
  reloadCourses: () => void;
  reloadAssignments: () => void;
  toast: (m: string) => void;
  onDeleted: () => void;
}) {
  const { course: c, assignments, today, userId, run, reloadCourses, reloadAssignments, toast } = props;
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today);
  const [weight, setWeight] = useState("");
  const upd = (patch: Record<string, unknown>) => run("Saving course", supabase!.from("courses").update(patch).eq("id", c.id).eq("user_id", userId), reloadCourses);
  return (
    <div className="course-edit">
      <div className="row">
        <label className="field">
          <span className="muted">Final grade</span>
          <select value={c.final_grade ?? ""} onChange={(e) => upd({ final_grade: e.target.value || null })}>
            <option value="">Not yet</option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="muted">Goal</span>
          <select value={c.grade_goal ?? ""} onChange={(e) => upd({ grade_goal: e.target.value || null })}>
            <option value="">–</option>
            {GRADES.slice(0, 6).map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="muted">Semester</span>
          <select value={c.term ?? ""} onChange={(e) => upd({ term: e.target.value || null })}>
            <option value="">–</option>
            {[...new Set([...(c.term ? [c.term] : []), ...TERM_OPTIONS])].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <b className="mini-head">Assessments</b>
      <ul className="tasks">
        {!assignments.length && <li className="empty">None yet.</li>}
        {assignments.map((a) => {
          const d = daysUntil(a.due_date, today);
          return (
            <li key={a.id} className={a.completed ? "done" : ""}>
              <Orb
                checked={a.completed}
                label={(a.completed ? "Done: " : "Mark done: ") + a.title}
                onChange={(v) => run("Saving", supabase!.from("assignments").update({ completed: v }).eq("id", a.id).eq("user_id", userId), reloadAssignments)}
              />
              <span className="txt">
                {a.title}{" "}
                <span className="muted">
                  · {String(a.due_date).slice(0, 10)}
                  {!a.completed && (d >= 0 ? ` · in ${d} day${d === 1 ? "" : "s"}` : ` · ${-d} day${d === -1 ? "" : "s"} ago`)}
                  {a.weight ? ` · ${a.weight}%` : ""}
                </span>
              </span>
              <button
                className="x"
                aria-label={`Delete ${a.title}`}
                onClick={() => sure(`"${a.title}"`) && run("Deleting", supabase!.from("assignments").delete().eq("id", a.id).eq("user_id", userId), reloadAssignments)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="add-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = cleanText(title).slice(0, 160);
          const w = Number(weight || 0);
          if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !(w >= 0 && w <= 100)) return;
          const ok = await run(
            "Adding assessment",
            supabase!.from("assignments").insert({ user_id: userId, course_id: c.id, title: t, due_date: `${due}T00:00:00Z`, weight: w }),
            reloadAssignments,
          );
          if (ok) {
            setTitle("");
            setWeight("");
          }
        }}
      >
        <input type="text" placeholder="Assessment, e.g. Test 1" aria-label="Assessment name" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="row" style={{ marginTop: 0 }}>
          <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
          <input type="text" inputMode="decimal" placeholder="Weight %" aria-label="Weight in percent" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Btn className="btn" disabled={!cleanText(title)}>
            Add
          </Btn>
        </div>
      </form>
      <div className="row">
        <Btn
          className="btn ghost"
          onClick={async () => {
            if (!sure(`${c.code} and its assessments`)) return;
            if (await run("Deleting course", supabase!.from("courses").delete().eq("id", c.id).eq("user_id", userId), reloadCourses)) {
              toast(`${c.code} deleted`);
              props.onDeleted();
            }
          }}
        >
          Delete course
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Study: career                                                       */
/* ------------------------------------------------------------------ */

interface CareerRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  difficulty: string | null; // old dashboard stored the category here: skill / project / internship
}

const CAREER_KINDS = ["skill", "project", "internship"];
const NEXT_STATUS: Record<string, string> = { backlog: "in-progress", "in-progress": "completed", completed: "backlog" };

export function CareerCard({ userId }: MoreProps) {
  const rows = useRows<CareerRow>("career_projects", userId, { build: (q) => q.order("created_at") });
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("skill");
  if (!supabase || !userId) return null;
  const run = async (what: string, q: PromiseLike<any>) => setErr(await write(what, q, rows.reload));
  return (
    <div className="card">
      <h2>Career</h2>
      <ErrorNote text={err ?? rows.error} />
      <ul className="tasks">
        {(rows.rows ?? []).map((r) => (
          <li key={r.id} className={r.status === "completed" ? "done" : ""}>
            <Orb
              checked={r.status === "completed"}
              label={(r.status === "completed" ? "Done: " : "Mark done: ") + r.title}
              onChange={(v) => run("Saving", supabase!.from("career_projects").update({ status: v ? "completed" : "backlog" }).eq("id", r.id).eq("user_id", userId))}
            />
            <span className="txt">
              {r.title}
              <span className="muted">
                {" "}
                · {r.difficulty && CAREER_KINDS.includes(r.difficulty) ? r.difficulty : "goal"}
                {r.description ? ` · ${r.description}` : ""}
              </span>
            </span>
            <Btn
              className="chip-btn"
              aria-label={`Status of ${r.title}: ${r.status}. Tap to change`}
              onClick={() => run("Saving", supabase!.from("career_projects").update({ status: NEXT_STATUS[r.status] ?? "backlog" }).eq("id", r.id).eq("user_id", userId))}
            >
              {r.status}
            </Btn>
            <button className="x" aria-label={`Delete ${r.title}`} onClick={() => sure(`"${r.title}"`) && run("Deleting", supabase!.from("career_projects").delete().eq("id", r.id).eq("user_id", userId))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = cleanText(title).slice(0, 160);
          if (!t) return;
          run("Adding", supabase!.from("career_projects").insert({ user_id: userId, title: t, status: "backlog", difficulty: kind }));
          setTitle("");
        }}
      >
        <input type="text" placeholder="Skill, project or internship goal" aria-label="New career goal" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {CAREER_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <Btn className="btn">Add</Btn>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Care (Moonlit Garden): skin, hair, mood, journal                    */
/* ------------------------------------------------------------------ */

const HAIR = [
  { metric: "hair_oiled", label: "Weekly oiling" },
  { metric: "hair_dermarolled", label: "Dermarolling" },
  { metric: "hair_serum_applied", label: "Growth serum" },
  { metric: "hair_massage_done", label: "Scalp massage" },
];

const JOURNAL_PROMPTS = [
  "What felt light today?",
  "One thing I'm proud of today:",
  "What drained me, and what would help tomorrow?",
  "A small moment I want to remember:",
  "What would make tomorrow 1% better?",
  "Who or what am I grateful for today?",
  "What did my body need today?",
];

export function CareScreen({ p, today, userId, toast }: MoreProps) {
  const health = useRows<{ metric: string; value: string }>("health_logs", userId, {
    build: (q) => q.eq("logged_at", `${today}T12:00:00Z`),
    key: today,
  });
  const journal = useRows<{ id: string; prompt: string | null; content: string }>("journal_entries", userId, { build: (q) => q.eq("entry_date", today), key: today });
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const loadedFor = useRef<string | null>(null);
  const entry = journal.rows?.[0];
  useEffect(() => {
    if (journal.rows && loadedFor.current !== today) {
      loadedFor.current = today;
      setText(entry?.content ?? "");
    }
  }, [journal.rows, today]);
  if (!supabase || !userId) return <NeedsSignIn />;

  const val = (m: string) => health.rows?.find((r) => r.metric === m)?.value;
  const habits = p.habitsFor(today);
  const setHealth = async (metric: string, value: string, unit: string) =>
    setErr(
      await write(
        "Saving",
        supabase!.from("health_logs").upsert({ user_id: userId, metric, value, unit, source: "manual", logged_at: `${today}T12:00:00Z` }, { onConflict: HEALTH_CONFLICT }),
        health.reload,
      ),
    );
  const mood = Number(val("mood_score") ?? 0);
  const prompt = entry?.prompt || JOURNAL_PROMPTS[Number(today.slice(8, 10)) % JOURNAL_PROMPTS.length];
  const saveJournal = async () => {
    if ((entry?.content ?? "") === text) return;
    const e = await write(
      "Saving journal",
      supabase!
        .from("journal_entries")
        .upsert(
          { user_id: userId, entry_date: today, title: "Journal", prompt, content: text.slice(0, 20000), category: "reflection", updated_at: new Date().toISOString() },
          { onConflict: "user_id,entry_date" },
        ),
      journal.reload,
    );
    setErr(e);
    if (!e) toast("Journal saved");
  };

  return (
    <>
      <div className="lumi-row">
        <div className="lumi-float">
          <Lumi size={56} />
        </div>
        <div className="bubble">The Moonlit Garden. Small care, every day, adds up.</div>
      </div>
      <ErrorNote text={err ?? health.error ?? journal.error} />
      <div className="card">
        <h2>Skin</h2>
        <ul className="quests">
          {[
            { key: "skinAM", label: "Morning: cleanse, treat, sunscreen" },
            { key: "skinPM", label: "Night: cleanse, treat, moisturise" },
          ].map((h) => (
            <li key={h.key} className={"quest" + (habits[h.key] ? " done" : "")}>
              <Orb checked={!!habits[h.key]} xp={5} label={(habits[h.key] ? "Done: " : "Mark done: ") + h.label} onChange={(v) => p.setHabit(h.key, v)} />
              <div className="q-body">
                <span className="q-text">{h.label}</span>
                <span className="q-meta">Same tick as Habits and Sanctuary</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Hair</h2>
        <ul className="quests">
          {HAIR.map((h) => {
            const on = val(h.metric) === "true";
            return (
              <li key={h.metric} className={"quest" + (on ? " done" : "")}>
                <Orb checked={on} xp={5} label={(on ? "Done: " : "Mark done: ") + h.label} onChange={(v) => setHealth(h.metric, String(v), "boolean")} />
                <div className="q-body">
                  <span className="q-text">{h.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card">
        <h2>
          Mood <span className="sub">{mood ? `${mood}/10` : "not set"}</span>
        </h2>
        <div className="mood" role="group" aria-label="Mood from 1 to 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Btn key={n} className={"chip-btn" + (n === mood ? " on" : "")} aria-pressed={n === mood} onClick={() => setHealth("mood_score", String(n), "score")}>
              {n}
            </Btn>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>
          Journal <span className="sub">private</span>
        </h2>
        <label className="muted" htmlFor="journal">
          {prompt}
        </label>
        <textarea id="journal" className="notes" rows={6} value={text} onChange={(e) => setText(e.target.value)} onBlur={saveJournal} placeholder="Write freely. Only you can read this." />
        <div className="muted" style={{ marginTop: 6 }}>
          Never sent to Lumi or the evening review.
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Music Room                                                          */
/* ------------------------------------------------------------------ */

interface SongRow {
  id: string;
  title: string;
  status: string;
  key: string | null;
  tempo: string | null;
  chords: string | null;
  tags: string[] | null;
  updated_at: string;
}
interface VersionRow {
  id: string;
  song_id: string;
  version_number: number;
  lyrics: string;
}

const SONG_STATUS = ["spark", "wip", "completed"];

export function MusicScreen({ userId, toast }: MoreProps) {
  const songs = useRows<SongRow>("songs", userId, { build: (q) => q.order("updated_at", { ascending: false }) });
  const versions = useRows<VersionRow>("song_versions", userId, { build: (q) => q.order("version_number") });
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!supabase || !userId) return <NeedsSignIn />;
  const latest = (id: string) => [...(versions.rows ?? [])].filter((v) => v.song_id === id).pop();

  return (
    <>
      <ErrorNote text={err ?? songs.error ?? versions.error} />
      <div className="card">
        <h2>
          Songs <span className="sub">{songs.rows?.length ?? 0}</span>
        </h2>
        <ul className="tasks">
          {(songs.rows ?? []).map((s) => (
            <li key={s.id}>
              <button className="course-row" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                <span className="txt">
                  <b>{s.title}</b>
                  <span className="muted">
                    {" "}
                    · {s.status}
                    {s.key ? ` · ${s.key}` : ""}
                    {s.tempo ? ` · ${s.tempo} bpm` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <Btn
            className="btn dashed wide"
            onClick={async () => {
              const r = await supabase!.from("songs").insert({ user_id: userId, title: "Untitled song", status: "spark" }).select("id").single();
              if (r.error) return setErr(`Adding song: ${r.error.message}`);
              await supabase!.from("song_versions").insert({ user_id: userId, song_id: r.data.id, version_number: 1, lyrics: "" });
              songs.reload();
              versions.reload();
              setOpen(r.data.id);
            }}
          >
            + New song
          </Btn>
        </div>
      </div>
      {open && songs.rows?.find((s) => s.id === open) && (
        <React.Fragment key={open}>
        <SongEditor
          song={songs.rows.find((s) => s.id === open)!}
          version={latest(open)}
          userId={userId}
          setErr={setErr}
          reload={() => {
            songs.reload();
            versions.reload();
          }}
          toast={toast}
          onClose={() => setOpen(null)}
        />
        </React.Fragment>
      )}
    </>
  );
}

function SongEditor({ song, version, userId, setErr, reload, toast, onClose }: { song: SongRow; version?: VersionRow; userId: string; setErr: (e: string | null) => void; reload: () => void; toast: (m: string) => void; onClose: () => void }) {
  const [f, setF] = useState({ title: song.title, status: song.status, key: song.key ?? "", tempo: song.tempo ?? "", chords: song.chords ?? "", tags: (song.tags ?? []).join(", ") });
  const [lyrics, setLyrics] = useState(version?.lyrics ?? "");
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async (newVersion: boolean) => {
    const s = supabase!;
    let e = await write(
      "Saving song",
      s
        .from("songs")
        .update({
          title: cleanText(f.title).slice(0, 160) || "Untitled song",
          status: f.status,
          key: f.key.slice(0, 40),
          tempo: f.tempo.slice(0, 20),
          chords: f.chords.slice(0, 400),
          tags: f.tags.split(",").map((t) => cleanText(t)).filter(Boolean).slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", song.id)
        .eq("user_id", userId),
    );
    if (!e) {
      const text = lyrics.slice(0, 50000);
      e =
        version && !newVersion
          ? await write("Saving lyrics", s.from("song_versions").update({ lyrics: text }).eq("id", version.id).eq("user_id", userId))
          : await write("Saving lyrics", s.from("song_versions").insert({ user_id: userId, song_id: song.id, version_number: (version?.version_number ?? 0) + 1, lyrics: text }));
    }
    reload();
    setErr(e);
    if (!e) toast(newVersion ? `Saved as version ${(version?.version_number ?? 0) + 1}` : "Song saved");
  };
  return (
    <div className="card">
      <h2>
        Edit song {version && <span className="sub">version {version.version_number}</span>}
      </h2>
      <div className="add-form">
        <input type="text" aria-label="Title" value={f.title} onChange={set("title")} />
        <div className="seg three" role="group" aria-label="Status">
          {SONG_STATUS.map((st) => (
            <Btn key={st} type="button" className={f.status === st ? "on" : ""} aria-pressed={f.status === st} onClick={() => setF({ ...f, status: st })}>
              {st}
            </Btn>
          ))}
        </div>
        <div className="row" style={{ marginTop: 0 }}>
          <input type="text" placeholder="Key, e.g. A minor" aria-label="Musical key" value={f.key} onChange={set("key")} />
          <input type="text" inputMode="numeric" placeholder="Tempo" aria-label="Tempo in bpm" value={f.tempo} onChange={set("tempo")} />
        </div>
        <input type="text" placeholder="Chords, e.g. Am - F - C - G" aria-label="Chord progression" value={f.chords} onChange={set("chords")} />
        <input type="text" placeholder="Tags, comma separated" aria-label="Tags" value={f.tags} onChange={set("tags")} />
        <textarea className="notes lyrics" rows={12} aria-label="Lyrics" placeholder="Lyrics, ideas, structure…" value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
      </div>
      <div className="row">
        <Btn className="btn" onClick={() => save(false)}>
          Save
        </Btn>
        <Btn className="btn ghost" onClick={() => save(true)}>
          Save as new version
        </Btn>
        <Btn className="btn ghost" onClick={onClose}>
          Close
        </Btn>
      </div>
      <div className="row">
        <Btn
          className="btn ghost"
          onClick={async () => {
            if (!sure(`"${song.title}" and all its versions`)) return;
            const e = await write("Deleting song", supabase!.from("songs").delete().eq("id", song.id).eq("user_id", userId), reload);
            setErr(e);
            if (!e) onClose();
          }}
        >
          Delete song
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Treasury                                                            */
/* ------------------------------------------------------------------ */

interface BudgetRow {
  id: string;
  name: string;
  savings_goal: number;
  current_savings: number;
}
interface CategoryRow {
  id: string;
  budget_id: string;
  name: string;
  budgeted_amount: number;
}

export function TreasuryScreen({ p, today, userId, toast }: MoreProps) {
  const budgets = useRows<BudgetRow>("budgets", userId, { build: (q) => q.order("created_at") });
  const cats = useRows<CategoryRow>("budget_categories", userId, { build: (q) => q.order("created_at") });
  const tx = useRows<TransactionRow>("transactions", userId, { build: (q) => q.order("transaction_date", { ascending: false }).limit(200) });
  const bucket = useRows<{ id: string; title: string; description: string | null; completed: boolean }>("bucket_list", userId, { build: (q) => q.order("created_at") });
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [cat, setCat] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newCatAmt, setNewCatAmt] = useState("");
  if (!supabase || !userId) return <NeedsSignIn />;
  const cur = parseCurrency(p.settings.currency);
  const budget = budgets.rows?.[0];
  const spent = spentThisMonth(tx.rows ?? [], today);
  const reloadAll = () => {
    budgets.reload();
    cats.reload();
    tx.reload();
  };
  const ensureBudget = async (): Promise<string | null> => {
    if (budget) return budget.id;
    const r = await supabase!.from("budgets").insert({ user_id: userId, name: "Primary Budget", savings_goal: 0, current_savings: 0 }).select("id").single();
    if (r.error) {
      setErr(`Creating budget: ${r.error.message}`);
      return null;
    }
    budgets.reload();
    return r.data.id as string;
  };
  const setBudget = async (patch: Partial<BudgetRow>) => {
    const id = await ensureBudget();
    if (id) setErr(await write("Saving", supabase!.from("budgets").update(patch).eq("id", id).eq("user_id", userId), budgets.reload));
  };
  const pct = budget && budget.savings_goal > 0 ? Math.min(100, Math.round((budget.current_savings / budget.savings_goal) * 100)) : 0;

  return (
    <>
      <ErrorNote text={err ?? budgets.error ?? cats.error ?? tx.error} />
      <div className="card">
        <h2>
          Savings <span className="sub">{budget ? `${money(budget.current_savings, cur)} of ${money(budget.savings_goal, cur)}` : "no goal yet"}</span>
        </h2>
        <Progress pct={pct} label="Savings progress" />
        <div className="row">
          <AmountField label="Savings goal" value={budget?.savings_goal ?? 0} onSave={(n) => setBudget({ savings_goal: n })} />
          <AmountField label="Saved so far" value={budget?.current_savings ?? 0} onSave={(n) => setBudget({ current_savings: n })} />
        </div>
      </div>

      <div className="card">
        <h2>
          This month <span className="sub">{today.slice(0, 7)}</span>
        </h2>
        <ul className="tasks">
          {(cats.rows ?? []).map((c) => {
            const s = spent.get(c.id) ?? 0;
            const over = c.budgeted_amount > 0 && s > c.budgeted_amount;
            return (
              <li key={c.id}>
                <span className="txt">
                  <b>{c.name}</b>{" "}
                  <span className={over ? "warn" : "muted"}>
                    {money(s, cur)} of {money(c.budgeted_amount, cur)}
                  </span>
                </span>
                <button
                  className="x"
                  aria-label={`Delete category ${c.name}`}
                  onClick={async () => sure(`the category "${c.name}" and its spending`) && setErr(await write("Deleting", supabase!.from("budget_categories").delete().eq("id", c.id).eq("user_id", userId), reloadAll))}
                >
                  ×
                </button>
              </li>
            );
          })}
          {!cats.rows?.length && <li className="empty">No categories yet.</li>}
        </ul>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = cleanText(newCat).slice(0, 60);
            const amt = newCatAmt ? parseAmount(newCatAmt) : 0;
            if (!n || amt === null) return;
            const id = await ensureBudget();
            if (!id) return;
            const er = await write("Adding category", supabase!.from("budget_categories").insert({ user_id: userId, budget_id: id, name: n, budgeted_amount: amt }), cats.reload);
            setErr(er);
            if (!er) {
              setNewCat("");
              setNewCatAmt("");
            }
          }}
        >
          <input type="text" placeholder="New category" aria-label="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <input type="text" inputMode="decimal" placeholder="Monthly budget" aria-label="Monthly budget" value={newCatAmt} onChange={(e) => setNewCatAmt(e.target.value)} />
          <Btn className="btn">Add</Btn>
        </form>
      </div>

      <div className="card">
        <h2>Log spending</h2>
        <form
          className="add-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const amt = parseAmount(amount);
            const c = cat || cats.rows?.[0]?.id;
            if (!amt || !c) return;
            const er = await write(
              "Saving",
              supabase!.from("transactions").insert({ user_id: userId, category_id: c, amount: amt, description: cleanText(note).slice(0, 160) || null, transaction_date: `${today}T12:00:00Z` }),
              tx.reload,
            );
            setErr(er);
            if (!er) {
              setAmount("");
              setNote("");
              toast(`${money(amt, cur)} logged`);
            }
          }}
        >
          <div className="row" style={{ marginTop: 0 }}>
            <input type="text" inputMode="decimal" placeholder="Amount" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select aria-label="Category" value={cat || cats.rows?.[0]?.id || ""} onChange={(e) => setCat(e.target.value)}>
              {(cats.rows ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <input type="text" placeholder="What for? (optional)" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Btn className="btn" disabled={!parseAmount(amount) || !cats.rows?.length}>
            Log
          </Btn>
        </form>
        <ul className="tasks">
          {(tx.rows ?? [])
            .filter((t) => String(t.transaction_date).slice(0, 7) === today.slice(0, 7))
            .slice(0, 15)
            .map((t) => (
              <li key={t.id}>
                <span className="txt">
                  {money(Number(t.amount), cur)}{" "}
                  <span className="muted">
                    · {cats.rows?.find((c) => c.id === t.category_id)?.name ?? "?"}
                    {t.description ? ` · ${t.description}` : ""} · {String(t.transaction_date).slice(5, 10)}
                  </span>
                </span>
                <button className="x" aria-label="Delete this spending" onClick={async () => sure("this spending entry") && setErr(await write("Deleting", supabase!.from("transactions").delete().eq("id", t.id).eq("user_id", userId), tx.reload))}>
                  ×
                </button>
              </li>
            ))}
        </ul>
      </div>

      <ul className="links">
        <li>
          <Link to="/planner/rewards">
            <b>Bucket list → Rewards</b>
            <span className="muted">Your {bucket.rows?.length ?? 0} dreams live in Rewards now</span>
          </Link>
        </li>
      </ul>
    </>
  );
}

function AmountField({ label, value, onSave }: { label: string; value: number; onSave: (n: number) => void }) {
  const [text, setText] = useState(String(value || ""));
  useEffect(() => setText(String(value || "")), [value]);
  return (
    <label className="field">
      <span className="muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = text.trim() === "" ? 0 : parseAmount(text);
          if (n === null) setText(String(value || ""));
          else if (n !== value) onSave(n);
        }}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Lumi chat                                                           */
/* ------------------------------------------------------------------ */

interface MessageRow {
  id: string;
  sender: string;
  text: string;
  created_at: string;
}

export function LumiScreen({ p, today, userId, toast }: MoreProps) {
  const msgs = useRows<MessageRow>("chat_messages", userId, { build: (q) => q.order("created_at", { ascending: false }).limit(40) });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<{ block: Block; text: string }[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  const list = useMemo(() => [...(msgs.rows ?? [])].reverse(), [msgs.rows]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [list.length, busy]);
  if (!supabase || !userId) return <NeedsSignIn />;

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setErr(null);
    setSuggested([]);
    try {
      const token = (await supabase!.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/lumi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, date: today }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Lumi couldn't answer (${res.status})`);
      setDraft("");
      setSuggested(data.tasks ?? []);
      setAdded(new Set());
      sfx.play("xp-sparkle", 0, 0.5);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
      msgs.reload();
    }
  };

  return (
    <>
      <div className="card chat">
        {msgs.rows === null && <div className="muted">Loading…</div>}
        {msgs.rows && !list.length && <div className="muted">Say hi to Lumi. Ask about your day, or ask it to suggest a task.</div>}
        <ul className="chat-list" aria-live="polite">
          {list.map((m) => (
            <li key={m.id} className={m.sender === "user" ? "me" : "lumi"}>
              {m.sender !== "user" && (
                <span className="chat-av" aria-hidden="true">
                  <Lumi size={28} />
                </span>
              )}
              <span className="chat-bubble">{m.text}</span>
            </li>
          ))}
          {busy && (
            <li className="lumi">
              <span className="chat-av" aria-hidden="true">
                <Lumi size={28} />
              </span>
              <span className="chat-bubble muted">Lumi is thinking…</span>
            </li>
          )}
        </ul>
        {suggested.length > 0 && (
          <div className="suggested">
            <b>Lumi suggests</b>
            {suggested.map((t, i) => {
              const k = `${t.block}|${t.text}`;
              return (
                <div key={i} className="row" style={{ alignItems: "center" }}>
                  <span className="txt">
                    ✨ {t.text} <span className="muted">· {t.block === "deep" ? "deep work" : "course prep"}</span>
                  </span>
                  <Btn
                    className="btn ghost"
                    disabled={added.has(k) || !p.day}
                    onClick={() => {
                      p.addCustom(t.block, t.text, true);
                      setAdded(new Set([...added, k]));
                      toast("Added to today ✨");
                    }}
                  >
                    {added.has(k) ? "Added" : "Add to today"}
                  </Btn>
                </div>
              );
            })}
          </div>
        )}
        <div ref={end} />
      </div>
      <ErrorNote text={err ?? msgs.error} />
      <form
        className="row chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input type="text" placeholder="Talk to Lumi…" aria-label="Message to Lumi" maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Btn className="btn" disabled={busy || !draft.trim()}>
          {busy ? "…" : "Send"}
        </Btn>
      </form>
      <div className="muted" style={{ textAlign: "center" }}>
        Lumi sees today's lists, habits, water and courses. Never your journal.
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Settings cards                                                      */
/* ------------------------------------------------------------------ */

const ABOUT_FIELDS: { key: string; label: string }[] = [
  { key: "university", label: "University" },
  { key: "degree", label: "Degree" },
  { key: "year_of_study", label: "Year of study" },
  { key: "academic_goals", label: "Academic goals" },
  { key: "career_goals", label: "Career goals" },
  { key: "creative_goals", label: "Creative goals" },
  { key: "personal_goals", label: "Personal goals" },
  { key: "wellbeing_goals", label: "Wellbeing goals" },
  { key: "energy_challenges", label: "What makes things hard" },
];

export function AboutMeCard({ userId, toast }: MoreProps) {
  const profile = useRows<{ id: string; name: string; current_focus: string | null }>("profiles", userId, { userColumn: "id" });
  const settings = useRows<{ id: string; widget_settings: Record<string, unknown> }>("settings", userId);
  const [err, setErr] = useState<string | null>(null);
  if (!supabase || !userId) return null;
  const prof = profile.rows?.[0];
  const ws = settings.rows?.[0]?.widget_settings ?? {};
  const saveField = async (key: string, value: string) => {
    const next = { ...ws, [key]: cleanText(value).slice(0, 500) };
    const e = settings.rows?.[0]
      ? await write("Saving", supabase!.from("settings").update({ widget_settings: next }).eq("user_id", userId), settings.reload)
      : await write("Saving", supabase!.from("settings").insert({ user_id: userId, widget_settings: next }), settings.reload);
    setErr(e);
    if (!e) toast("Saved");
  };
  return (
    <div className="card">
      <h2>About me</h2>
      <ErrorNote text={err ?? profile.error ?? settings.error} />
      <TextField
        label="Name"
        value={prof?.name ?? ""}
        onSave={async (v) => setErr(await write("Saving", supabase!.from("profiles").upsert({ id: userId, name: cleanText(v).slice(0, 80) || "Me" }), profile.reload))}
      />
      <TextField
        label="Today's focus"
        value={prof?.current_focus ?? ""}
        onSave={async (v) => setErr(await write("Saving", supabase!.from("profiles").upsert({ id: userId, name: prof?.name ?? "Me", current_focus: cleanText(v).slice(0, 200) }), profile.reload))}
      />
      {ABOUT_FIELDS.map((f) => (
        <React.Fragment key={f.key}>
          <TextField label={f.label} value={typeof ws[f.key] === "string" ? (ws[f.key] as string) : ""} onSave={(v) => saveField(f.key, v)} />
        </React.Fragment>
      ))}
      <div className="muted">Lumi uses this to understand you. Edit anything, any time.</div>
    </div>
  );
}

function TextField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field wide-field">
      <span className="muted">{label}</span>
      <input type="text" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </label>
  );
}

export function CurrencyCard({ p, toast }: MoreProps) {
  const cur = parseCurrency(p.settings.currency);
  return (
    <div className="card">
      <h2>Currency</h2>
      <div className="seg" role="group" aria-label="Currency">
        {CURRENCIES.map((c) => (
          <Btn
            key={c.code}
            className={cur === c.code ? "on" : ""}
            aria-pressed={cur === c.code}
            onClick={() => {
              p.setSetting("currency", c.code);
              toast(`Currency: ${c.label}`);
            }}
          >
            {c.label}
          </Btn>
        ))}
      </div>
      <div className="muted">Used in the Treasury. On 20 Feb 2027 the app will remind you to switch to NZ$.</div>
    </div>
  );
}

export function CurrencyReminder({ p, toast }: { p: Planner; toast: (m: string) => void }) {
  return (
    <div className="note reminder" role="status">
      <span>Back to Auckland? Switch the Treasury to NZ$.</span>
      <div className="row">
        <Btn
          className="btn"
          onClick={() => {
            p.setSetting("currency", "NZD" as Currency);
            toast("Currency: NZ$");
          }}
        >
          Switch to NZ$
        </Btn>
        <Btn className="btn ghost" onClick={() => p.setSetting("currency_reminder_dismissed", true)}>
          Not now
        </Btn>
      </div>
    </div>
  );
}

export function BackupCard({ userId, toast }: MoreProps) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  if (!supabase || !userId) return null;
  const exportAll = async () => {
    setBusy("export");
    try {
      const tables: Backup["tables"] = {};
      for (const { table } of BACKUP_TABLES) {
        const r = await supabase!.from(table).select("*").eq(table === "profiles" ? "id" : "user_id", userId);
        if (r.error) throw new Error(`${table}: ${r.error.message}`);
        tables[table] = r.data ?? [];
      }
      const backup: Backup = { app: "saisha-os", version: 1, exportedAt: new Date().toISOString(), tables };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `saisha-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const n = Object.values(tables).reduce((s, t) => s + t.length, 0);
      setMsg({ ok: true, text: `Exported ${n} rows from ${BACKUP_TABLES.length} tables.` });
    } catch (e: any) {
      setMsg({ ok: false, text: `Export failed: ${e.message}` });
    } finally {
      setBusy("");
    }
  };
  const restore = async (f: File) => {
    setBusy("restore");
    try {
      const plan = prepareRestore(await f.text(), userId);
      if (!window.confirm(`Restore ${plan.rows} rows? Rows in the backup replace the same rows here; nothing else is deleted.`)) return;
      for (const t of plan.tables) {
        if (!t.rows.length) continue;
        const r = await supabase!.from(t.table).upsert(t.rows, t.onConflict ? { onConflict: t.onConflict } : undefined);
        if (r.error) throw new Error(`${t.table}: ${r.error.message}`);
      }
      setMsg({ ok: true, text: `Restored ${plan.rows} rows. Reloading…` });
      toast("Backup restored");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="card">
      <h2>Backup</h2>
      <div className="muted">Everything: planner, gym, water, courses, songs, money, chat, journal. Keep the file somewhere safe; it's private.</div>
      <div className="row">
        <Btn className="btn" disabled={!!busy} onClick={exportAll}>
          {busy === "export" ? "Exporting…" : "Download backup"}
        </Btn>
        <Btn className="btn ghost" disabled={!!busy} onClick={() => file.current?.click()}>
          {busy === "restore" ? "Restoring…" : "Restore from file"}
        </Btn>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
      </div>
      {msg && <div className={"note" + (msg.ok ? "" : " error")}>{msg.text}</div>}
    </div>
  );
}

export function SignOutCard() {
  if (!supabase) return null;
  return (
    <div className="card">
      <div className="row" style={{ marginTop: 0 }}>
        <Btn className="btn ghost wide" onClick={() => signOut().then(() => window.location.assign("/"))}>
          Sign out
        </Btn>
      </div>
    </div>
  );
}
