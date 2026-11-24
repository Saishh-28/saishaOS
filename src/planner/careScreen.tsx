/**
 * Care · Moonlit Garden (Phase 2.5): skincare AM/PM steps (editable, with the
 * salicylic acid "tonight?" hint), skin log, hair wash days with reminders,
 * mood, a private journal (shared with Lumi only when you tick it), book notes
 * and trends. Routine ticks keep the Skincare AM / PM habits in sync.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { Planner } from "./usePlanner";
import { useRows, write } from "./db";
import { Lumi, Orb } from "./ui";
import { sfx } from "./sound";
import { longDate } from "./gym";
import { HEALTH_CONFLICT } from "./store";
import { mondayOf, waterGoal } from "./water";
import {
  BOOK_NOTE_XP,
  BREAKOUT_AREAS,
  CARE_LOG_XP,
  careTrend,
  CareStep,
  HAIR_ITEMS,
  HairItem,
  HairLog,
  hairReminders,
  JOURNAL_XP,
  journalPrompt,
  Routine,
  ROUTINE_HABIT,
  stepHint,
  stepsFor,
  TrendPoint,
} from "./care";

interface Props {
  p: Planner;
  today: string;
  userId: string | null;
  toast: (msg: string) => void;
}

const ROUTINE_TITLE: Record<Routine, string> = { am: "Morning skincare", pm: "Night skincare" };

/* ------------------------------------------------------------------ */
/* Skincare                                                            */
/* ------------------------------------------------------------------ */

function RoutineCard({ p, today, routine, toast }: { p: Planner; today: string; routine: Routine; toast: (m: string) => void }) {
  const snap = p.snap!;
  const steps = stepsFor(snap.careSteps, routine);
  const log = snap.skin.find((l) => l.date === today);
  const done = log?.steps ?? [];
  const habitDone = !!snap.habits.get(today)?.[ROUTINE_HABIT[routine]];
  return (
    <div className="card">
      <h2>
        {ROUTINE_TITLE[routine]} <span className="sub">{habitDone ? "Done ✨" : "+5 XP when complete"}</span>
      </h2>
      <ul className="quests" style={{ marginBottom: 0 }}>
        {steps.map((s) => {
          const on = done.includes(s.id);
          const hint = stepHint(s, snap.skin, today);
          return (
            <li key={s.id} className={"quest" + (on ? " done" : "") + (hint && !hint.due && !on ? " optional" : "")}>
              <Orb
                checked={on}
                label={`${on ? "Done" : "Mark done"}: ${s.label}`}
                onChange={(v) => {
                  const completed = p.tickCareStep(routine, s.id, v);
                  if (completed) {
                    sfx.blockComplete();
                    toast(`${ROUTINE_TITLE[routine]} done. Skincare habit ticked ✨`);
                  }
                }}
              />
              <div className="q-body">
                <span className="q-text">{s.label}</span>
                {hint ? (
                  <span className={"q-meta" + (hint.due ? " suggest" : "")}>{hint.text}</span>
                ) : (
                  <span className="q-meta">Every {routine === "am" ? "morning" : "night"}</span>
                )}
              </div>
            </li>
          );
        })}
        {!steps.length && <li className="empty">No steps yet. Add them under "Edit my routine".</li>}
      </ul>
    </div>
  );
}

function StepEditor({ p }: { p: Planner }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [routine, setRoutine] = useState<Routine>("pm");
  const [perWeek, setPerWeek] = useState("");
  const steps = p.snap!.careSteps;
  if (!open)
    return (
      <button className="btn ghost wide" style={{ marginBottom: 14 }} onClick={() => setOpen(true)}>
        Edit my routine
      </button>
    );
  const save = (s: CareStep, patch: Partial<CareStep>) => p.saveCareStep({ ...s, ...patch });
  return (
    <div className="card">
      <h2>
        My routine <span className="sub">tap Done when finished</span>
      </h2>
      {(["am", "pm"] as Routine[]).map((r) => (
        <React.Fragment key={r}>
          <h3 className="care-h3">{r === "am" ? "Morning" : "Night"}</h3>
          <ul className="step-edit">
            {stepsFor(steps, r).map((s, i, list) => (
              <li key={s.id}>
                <input type="text" aria-label="Step" defaultValue={s.label} maxLength={120} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.label && save(s, { label: e.target.value.trim() })} />
                <select
                  aria-label={`How often: ${s.label}`}
                  value={s.perWeek ?? ""}
                  onChange={(e) => save(s, { perWeek: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Every day</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}× a week
                    </option>
                  ))}
                </select>
                <button
                  className="btn ghost"
                  aria-label={`Move ${s.label} up`}
                  disabled={i === 0}
                  onClick={() => {
                    const order = [...list];
                    [order[i - 1], order[i]] = [order[i], order[i - 1]];
                    order.forEach((x, j) => x.sortOrder !== j + 1 && save(x, { sortOrder: j + 1 }));
                  }}
                >
                  ↑
                </button>
                <button className="btn ghost" aria-label={`Delete ${s.label}`} onClick={() => window.confirm(`Delete the step "${s.label}"?`) && p.deleteCareStep(s.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </React.Fragment>
      ))}
      <form
        className="row"
        style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = label.trim().slice(0, 120);
          if (!t) return;
          const max = Math.max(0, ...stepsFor(steps, routine).map((s) => s.sortOrder));
          p.saveCareStep({ id: `${routine}-${Date.now().toString(36)}`, routine, label: t, perWeek: perWeek ? Number(perWeek) : null, sortOrder: max + 1 });
          setLabel("");
        }}
      >
        <input type="text" aria-label="New step" placeholder="Add a step" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        <select aria-label="Routine" value={routine} onChange={(e) => setRoutine(e.target.value as Routine)}>
          <option value="am">Morning</option>
          <option value="pm">Night</option>
        </select>
        <select aria-label="How often" value={perWeek} onChange={(e) => setPerWeek(e.target.value)}>
          <option value="">Every day</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}× a week
            </option>
          ))}
        </select>
        <button className="btn">Add</button>
      </form>
      <button className="btn wide" style={{ marginTop: 10 }} onClick={() => setOpen(false)}>
        Done
      </button>
    </div>
  );
}

function Scale({ value, onPick, label, low, high }: { value: number | null; onPick: (n: number | null) => void; label: string; low: string; high: string }) {
  return (
    <div>
      <div className="scale" role="group" aria-label={`${label}, 1 (${low}) to 5 (${high})`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={"chip-btn" + (value === n ? " on" : "")} aria-pressed={value === n} onClick={() => onPick(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="scale-ends muted small">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function SkinCard({ p, today }: { p: Planner; today: string }) {
  const log = p.snap!.skin.find((l) => l.date === today);
  const [note, setNote] = useState(log?.note ?? "");
  useEffect(() => setNote(log?.note ?? ""), [log?.note]);
  const areas = log?.areas ?? [];
  return (
    <div className="card">
      <h2>
        Skin today <span className="sub">+{CARE_LOG_XP} XP Glow</span>
      </h2>
      <div className="muted small">How does your skin feel?</div>
      <Scale value={log?.rating ?? null} onPick={(n) => p.saveSkin({ rating: n })} label="Skin rating" low="rough" high="glowing" />
      <div className="muted small" style={{ marginTop: 10 }}>
        Breakouts
      </div>
      <div className="tag-row" role="group" aria-label="Breakout areas">
        {BREAKOUT_AREAS.map((a) => {
          const on = areas.includes(a);
          return (
            <button key={a} className={"chip-btn" + (on ? " on" : "")} aria-pressed={on} onClick={() => p.saveSkin({ areas: on ? areas.filter((x) => x !== a) : [...areas, a] })}>
              {a[0].toUpperCase() + a.slice(1)}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        aria-label="Skin note"
        placeholder="Short note (optional)"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (log?.note ?? "") && p.saveSkin({ note })}
        style={{ marginTop: 10, width: "100%" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hair                                                                */
/* ------------------------------------------------------------------ */

function HairCard({ p, today, toast }: { p: Planner; today: string; toast: (m: string) => void }) {
  const snap = p.snap!;
  const log = snap.hair.find((l) => l.date === today);
  const empty: HairLog = { date: today, items: [], products: null, shedding: null, note: null };
  const cur = log ?? empty;
  const [products, setProducts] = useState(cur.products ?? "");
  const [note, setNote] = useState(cur.note ?? "");
  useEffect(() => {
    setProducts(log?.products ?? "");
    setNote(log?.note ?? "");
  }, [log?.products, log?.note]);
  const save = (patch: Partial<HairLog>) => {
    const next = { ...cur, ...patch };
    const isEmpty = !next.items.length && next.shedding == null && !next.products && !next.note;
    p.saveHair(today, isEmpty ? null : next);
  };
  const reminders = hairReminders(snap.hair, today);
  const recent = [...snap.hair].filter((l) => l.date < today && l.items.length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <div className="card">
      <h2>
        Hair wash day <span className="sub">+{CARE_LOG_XP} XP Glow</span>
      </h2>
      {reminders.map((r) => (
        <div key={r.item} className="note hair-due">
          {r.text}
        </div>
      ))}
      <div className="tag-row" role="group" aria-label="What you did today">
        {HAIR_ITEMS.map((i) => {
          const on = cur.items.includes(i.id);
          return (
            <button
              key={i.id}
              className={"chip-btn" + (on ? " on" : "")}
              aria-pressed={on}
              onClick={() => {
                save({ items: on ? cur.items.filter((x) => x !== i.id) : [...cur.items, i.id as HairItem] });
                if (!on && !cur.items.length) toast(`Wash day logged · +${CARE_LOG_XP} XP Glow`);
              }}
            >
              {i.label}
            </button>
          );
        })}
      </div>
      <div className="muted small" style={{ marginTop: 10 }}>
        Shedding / breakage
      </div>
      <Scale value={cur.shedding} onPick={(n) => save({ shedding: n })} label="Shedding or breakage" low="very little" high="a lot" />
      <input
        type="text"
        aria-label="Products used"
        placeholder="Products used (optional)"
        value={products}
        maxLength={300}
        onChange={(e) => setProducts(e.target.value)}
        onBlur={() => products !== (cur.products ?? "") && save({ products: products.trim() || null })}
        style={{ marginTop: 10, width: "100%" }}
      />
      <input
        type="text"
        aria-label="Hair note"
        placeholder="Note (optional)"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (cur.note ?? "") && save({ note: note.trim() || null })}
        style={{ marginTop: 8, width: "100%" }}
      />
      {recent.length > 0 && (
        <ul className="tasks" style={{ marginTop: 10 }}>
          {recent.map((l) => (
            <li key={l.date}>
              <span className="txt">
                {longDate(l.date)} <span className="muted">· {l.items.map((i) => HAIR_ITEMS.find((x) => x.id === i)?.label).join(", ")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mood + Journal                                                      */
/* ------------------------------------------------------------------ */

function MoodCard({ today, userId, setErr }: { today: string; userId: string; setErr: (e: string | null) => void }) {
  const health = useRows<{ metric: string; value: string }>("health_logs", userId, {
    build: (q) => q.eq("logged_at", `${today}T12:00:00Z`).eq("metric", "mood_score"),
    key: today,
  });
  const mood = Number(health.rows?.[0]?.value ?? 0);
  return (
    <div className="card">
      <h2>
        Mood <span className="sub">{mood ? `${mood}/10` : "not set"}</span>
      </h2>
      <div className="mood" role="group" aria-label="Mood from 1 to 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={"chip-btn" + (n === mood ? " on" : "")}
            aria-pressed={n === mood}
            onClick={async () =>
              setErr(
                await write(
                  "Saving mood",
                  supabase!
                    .from("health_logs")
                    .upsert({ user_id: userId, metric: "mood_score", value: String(n), unit: "score", source: "manual", logged_at: `${today}T12:00:00Z` }, { onConflict: HEALTH_CONFLICT }),
                  health.reload,
                ),
              )
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function JournalCard({ today, userId, toast, setErr }: { today: string; userId: string; toast: (m: string) => void; setErr: (e: string | null) => void }) {
  const journal = useRows<{ id: string; prompt: string | null; content: string; share_with_lumi: boolean }>("journal_entries", userId, {
    build: (q) => q.eq("entry_date", today),
    key: today,
  });
  const entry = journal.rows?.[0];
  const [text, setText] = useState("");
  const [usePrompt, setUsePrompt] = useState(true);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (journal.rows && loadedFor.current !== today) {
      loadedFor.current = today;
      setText(entry?.content ?? "");
    }
  }, [journal.rows, today]);
  const prompt = entry?.prompt ?? (usePrompt ? journalPrompt(today) : null);
  const save = async (patch: { content?: string; share?: boolean }) => {
    const content = (patch.content ?? text).slice(0, 20000);
    const share = patch.share ?? entry?.share_with_lumi ?? false;
    if (!content.trim() && !entry) return;
    const e = await write(
      "Saving journal",
      supabase!.from("journal_entries").upsert(
        {
          user_id: userId,
          entry_date: today,
          title: "Journal",
          prompt,
          content,
          category: "reflection",
          share_with_lumi: share,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,entry_date" },
      ),
      journal.reload,
    );
    setErr(e);
    if (!e && patch.content !== undefined && !entry && content.trim()) toast(`Journal saved · +${JOURNAL_XP} XP Mind`);
    else if (!e && patch.share !== undefined) toast(patch.share ? "Lumi can read today's entry in your evening review" : "Today's entry is private again");
  };
  return (
    <div className="card">
      <h2>
        Journal <span className="sub">{entry?.share_with_lumi ? "shared with Lumi" : "private"}</span>
      </h2>
      {prompt ? (
        <label className="muted" htmlFor="journal">
          {prompt}{" "}
          {!entry && (
            <button className="link-btn" onClick={() => setUsePrompt(false)}>
              no prompt
            </button>
          )}
        </label>
      ) : (
        <label className="muted" htmlFor="journal">
          Write about anything.
        </label>
      )}
      <textarea
        id="journal"
        className="notes"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (entry?.content ?? "") && save({ content: text })}
        placeholder="Write freely. Only you can read this."
      />
      <label className="check-row">
        <input type="checkbox" checked={!!entry?.share_with_lumi} disabled={!entry && !text.trim()} onChange={(e) => save({ share: e.target.checked })} />
        <span>Share today's entry with Lumi (only for tonight's evening review)</span>
      </label>
      <div className="muted small">Unticked, it's never sent to Lumi, Gemini or the evening review.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Books                                                               */
/* ------------------------------------------------------------------ */

interface BookRow {
  id: string;
  title: string;
  author: string | null;
}
interface NoteRow {
  id: string;
  book_id: string;
  section: string;
  main_idea: string | null;
  experiment: string | null;
  result: string | null;
  note_date: string;
}

function BooksCard({ today, userId, toast, setErr }: { today: string; userId: string; toast: (m: string) => void; setErr: (e: string | null) => void }) {
  const books = useRows<BookRow>("books", userId, { build: (q) => q.order("created_at") });
  const notes = useRows<NoteRow>("book_notes", userId, { build: (q) => q.order("note_date", { ascending: false }) });
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [n, setN] = useState({ section: "", main: "", exp: "", result: "" });
  const run = async (what: string, q: PromiseLike<any>, reload: () => void) => {
    const e = await write(what, q, reload);
    setErr(e);
    return !e;
  };
  const book = books.rows?.find((b) => b.id === open);
  return (
    <div className="card">
      <h2>
        Book notes <span className="sub">+{BOOK_NOTE_XP} XP Mind per note</span>
      </h2>
      <ul className="tasks">
        {(books.rows ?? []).map((b) => (
          <li key={b.id}>
            <button className="course-row" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
              <span className="txt">
                <b>{b.title}</b>
                <span className="muted">
                  {b.author ? ` · ${b.author}` : ""} · {(notes.rows ?? []).filter((x) => x.book_id === b.id).length} notes
                </span>
              </span>
            </button>
          </li>
        ))}
        {books.rows && !books.rows.length && <li className="empty">No books yet. Add the one you're reading.</li>}
      </ul>
      {book && (
        <div className="book-open">
          {(notes.rows ?? [])
            .filter((x) => x.book_id === book.id)
            .map((x) => (
              <div key={x.id} className="book-note">
                <div className="book-note-top">
                  <b>{x.section}</b>
                  <span className="muted small">{longDate(x.note_date)}</span>
                </div>
                {x.main_idea && (
                  <p>
                    <span className="muted small">Main idea · </span>
                    {x.main_idea}
                  </p>
                )}
                {x.experiment && (
                  <p>
                    <span className="muted small">This week's experiment · </span>
                    {x.experiment}
                  </p>
                )}
                {x.result && (
                  <p>
                    <span className="muted small">Result · </span>
                    {x.result}
                  </p>
                )}
                <button
                  className="link-btn"
                  onClick={() => window.confirm(`Delete the note "${x.section}"? This can't be undone.`) && run("Deleting note", supabase!.from("book_notes").delete().eq("id", x.id).eq("user_id", userId), notes.reload)}
                >
                  Delete
                </button>
              </div>
            ))}
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!n.section.trim()) return toast("Give the section a name (e.g. Chapter 3)");
              const ok = await run(
                "Saving note",
                supabase!.from("book_notes").insert({
                  user_id: userId,
                  book_id: book.id,
                  section: n.section.trim().slice(0, 200),
                  main_idea: n.main.trim().slice(0, 2000) || null,
                  experiment: n.exp.trim().slice(0, 2000) || null,
                  result: n.result.trim().slice(0, 2000) || null,
                  note_date: today,
                }),
                notes.reload,
              );
              if (ok) {
                setN({ section: "", main: "", exp: "", result: "" });
                toast(`Note saved · +${BOOK_NOTE_XP} XP Mind`);
              }
            }}
          >
            <input type="text" aria-label="Section" placeholder="Section (e.g. Chapter 3)" value={n.section} maxLength={200} onChange={(e) => setN({ ...n, section: e.target.value })} />
            <textarea aria-label="Main idea in my words" placeholder="Main idea (in my words)" rows={2} value={n.main} maxLength={2000} onChange={(e) => setN({ ...n, main: e.target.value })} />
            <textarea aria-label="This week's experiment" placeholder="This week's experiment" rows={2} value={n.exp} maxLength={2000} onChange={(e) => setN({ ...n, exp: e.target.value })} />
            <textarea aria-label="Result" placeholder="Result (fill in later)" rows={2} value={n.result} maxLength={2000} onChange={(e) => setN({ ...n, result: e.target.value })} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn">Add note</button>
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  window.confirm(`Delete "${book.title}" and all its notes? This can't be undone.`) &&
                  run("Deleting book", supabase!.from("books").delete().eq("id", book.id).eq("user_id", userId), () => {
                    books.reload();
                    notes.reload();
                    setOpen(null);
                  })
                }
              >
                Delete book
              </button>
            </div>
          </form>
        </div>
      )}
      <form
        className="row"
        style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const t = title.trim().slice(0, 200);
          if (!t) return;
          if (await run("Adding book", supabase!.from("books").insert({ user_id: userId, title: t, author: author.trim().slice(0, 200) || null }), books.reload)) {
            setTitle("");
            setAuthor("");
          }
        }}
      >
        <input type="text" aria-label="Book title" placeholder="Add a book" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        <input type="text" aria-label="Author" placeholder="Author (optional)" value={author} maxLength={200} onChange={(e) => setAuthor(e.target.value)} />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */

function TrendChart({ points }: { points: TrendPoint[] }) {
  const W = 340;
  const H = 150;
  const pad = { l: 22, r: 6, t: 8, b: 20 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (i + 0.5) * (iw / points.length);
  const bw = Math.max(2, iw / points.length - 3);
  const y5 = (v: number) => pad.t + ih - ((v - 1) / 4) * ih;
  const line = (key: "skin" | "shedding") => {
    const pts = points.map((p, i) => (p[key] != null ? `${x(i).toFixed(1)},${y5(p[key]!).toFixed(1)}` : null)).filter(Boolean);
    return pts.join(" ");
  };
  const hasSkin = points.some((p) => p.skin != null);
  const hasShed = points.some((p) => p.shedding != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="Last 30 days: skin rating and shedding (1 to 5), water and after-meal walks">
      {[1, 3, 5].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y5(v)} y2={y5(v)} stroke="rgba(255,255,255,0.12)" />
          <text x={4} y={y5(v) + 4} fontSize="10" fill="#d9cff5">
            {v}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <rect key={p.date} x={x(i) - bw / 2} y={pad.t + ih - Math.min(1, p.water) * ih} width={bw} height={Math.min(1, p.water) * ih} rx={2} fill="rgba(142,230,224,0.22)" />
      ))}
      {points.map((p, i) =>
        p.walks ? <circle key={"w" + p.date} cx={x(i)} cy={H - 6} r={p.walks === 2 ? 3 : 2} fill="#c8f0c6" /> : null,
      )}
      {hasSkin && <polyline points={line("skin")} fill="none" stroke="#ffc4d8" strokeWidth="2.5" strokeLinejoin="round" />}
      {hasShed && <polyline points={line("shedding")} fill="none" stroke="#d8c6ff" strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />}
      {points.map((p, i) => (p.skin != null ? <circle key={"s" + p.date} cx={x(i)} cy={y5(p.skin)} r={3} fill="#ffc4d8" /> : null))}
      {points.map((p, i) => (p.shedding != null ? <circle key={"h" + p.date} cx={x(i)} cy={y5(p.shedding)} r={3} fill="#d8c6ff" /> : null))}
    </svg>
  );
}

function TrendsCard({ p, today }: { p: Planner; today: string }) {
  const snap = p.snap!;
  const goalStart = typeof snap.settings.water_goal_start === "string" ? (snap.settings.water_goal_start as string) : null;
  const points = useMemo(
    () =>
      careTrend({
        skin: snap.skin,
        hair: snap.hair,
        water: snap.water,
        habits: snap.habits,
        goalOn: (d) => waterGoal(snap.water, goalStart ?? mondayOf(d), d).goalMl,
        today,
      }),
    [snap, today, goalStart],
  );
  const any = points.some((x) => x.skin != null || x.shedding != null);
  return (
    <div className="card">
      <h2>
        Trends <span className="sub">last 30 days</span>
      </h2>
      <TrendChart points={points} />
      <div className="cal-legend" aria-hidden="true">
        <span>
          <i className="sw" style={{ background: "#ffc4d8" }} />
          Skin (1–5)
        </span>
        <span>
          <i className="sw" style={{ background: "#d8c6ff" }} />
          Shedding (1–5)
        </span>
        <span>
          <i className="sw" style={{ background: "rgba(142,230,224,0.5)" }} />
          Water (% of goal)
        </span>
        <span>
          <i className="m-gym" style={{ background: "#c8f0c6", boxShadow: "none" }} />
          After-meal walks
        </span>
      </div>
      {!any && <div className="muted small">Rate your skin and log wash days, and the lines appear here.</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function CareScreen2({ p, today, userId, toast }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const snap = p.snap!;
  const pm = stepsFor(snap.careSteps, "pm").map((s) => stepHint(s, snap.skin, today)).find((h) => h?.due);
  const due = hairReminders(snap.hair, today);
  const line = pm
    ? `Tonight could be a salicylic acid night. ${due.length ? due[0].text + "." : "Small care, every day, adds up."}`
    : due.length
      ? `${due[0].text}. Small care, every day, adds up.`
      : "The Moonlit Garden. Small care, every day, adds up.";
  return (
    <>
      <div className="lumi-row">
        <div className="lumi-float">
          <Lumi size={56} />
        </div>
        <div className="bubble">{line}</div>
      </div>
      {err && (
        <div className="note error" role="alert">
          {err}
        </div>
      )}
      <RoutineCard p={p} today={today} routine="am" toast={toast} />
      <RoutineCard p={p} today={today} routine="pm" toast={toast} />
      <StepEditor p={p} />
      <SkinCard p={p} today={today} />
      <HairCard p={p} today={today} toast={toast} />
      {supabase && userId && (
        <>
          <MoodCard today={today} userId={userId} setErr={setErr} />
          <JournalCard today={today} userId={userId} toast={toast} setErr={setErr} />
          <BooksCard today={today} userId={userId} toast={toast} setErr={setErr} />
        </>
      )}
      <TrendsCard p={p} today={today} />
    </>
  );
}
