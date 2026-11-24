/**
 * Phase 2b screens: Today's quests (Home card), Quests (daily, weekly,
 * Nicos Weg, boss battles) and Rewards (coins, your reward list, Dreams).
 */
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { isSkill, Skill, SKILLS } from "./game";
import {
  BOSS_XP,
  DAILY_QUEST_XP,
  GERMAN_XP,
  lessonUrl,
  NICOS_WEG_A1_LESSONS,
  Reward,
  suggestedTitle,
  Tier,
  TIER_COST,
  TIER_LABEL,
  TIERS,
  tierUnlock,
  tutorPrompt,
  WEEKLY_XP,
} from "./quests";
import type { Planner, Quests } from "./usePlanner";
import { Link } from "./router";
import { Orb, Progress } from "./ui";
import { sfx } from "./sound";
import { useRows, write } from "./db";
import { longDate } from "./gym";

interface Props {
  p: Planner;
  today: string;
  toast: (msg: string) => void;
}
const skillName = (s: Skill) => SKILLS.find((x) => x.key === s)!.name;

function Missing() {
  return (
    <div className="card">
      <div className="muted">Quests and rewards appear once the Phase 2b migration has run.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home: Today's quests                                                */
/* ------------------------------------------------------------------ */

export function questCount(q: Quests): { done: number; total: number; next: string | null } {
  const items = [...q.daily.map((d) => ({ done: d.done, title: d.title }))];
  if (q.german) items.push({ done: !!q.german.done, title: `German: Nicos Weg A1 lesson ${q.german.lesson}` });
  return { done: items.filter((i) => i.done).length, total: items.length, next: items.find((i) => !i.done)?.title ?? null };
}

export function TodaysQuestsCard({ q }: { q: Quests }) {
  const c = questCount(q);
  const deg = c.total ? Math.round((c.done / c.total) * 360) : 0;
  return (
    <div className="card k-quests">
      <div className="ring" style={{ background: `conic-gradient(#8ee6e0 0 ${deg}deg, rgba(255,255,255,0.15) ${deg}deg 360deg)` }} aria-hidden="true">
        <span>
          {c.done}/{c.total}
        </span>
      </div>
      <div className="k-quests-text">
        <b>Today's quests</b>
        <span className="muted">{c.next ? `Next: ${c.next}` : "All done. The kingdom glows ✨"}</span>
      </div>
      <Link to="/planner/quests" className="btn" aria-label={`Open today's quests: ${c.done} of ${c.total} done`}>
        Open
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quests screen                                                       */
/* ------------------------------------------------------------------ */

const TITLE_DRAFT = (n: number) => `saisha_german_title_${n}`;

function GermanCard({ p, today, toast, q }: Props & { q: Quests }) {
  const g = q.german;
  const lesson = g?.lesson ?? q.lessons.reduce((m, l) => Math.max(m, l.lesson), 0) + 1;
  const [title, setTitle] = useState("");
  useEffect(() => {
    setTitle(g?.done?.title ?? localStorage.getItem(TITLE_DRAFT(lesson)) ?? suggestedTitle(lesson));
  }, [lesson, g?.done?.title]);
  const url = lessonUrl(lesson);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tutorPrompt(lesson, title));
      toast("Tutor prompt copied. Paste the lesson's vocabulary into it.");
    } catch {
      toast("Couldn't copy here. Long-press to copy from a browser tab instead.");
    }
  };
  return (
    <div className="card">
      <h2>
        Evening quest <span className="sub">+{GERMAN_XP} XP · Mind</span>
      </h2>
      {!g ? (
        <div className="muted">Sunday: no German today. Lesson {lesson} is waiting for Monday.</div>
      ) : (
        <>
          <ul className="quests" style={{ marginBottom: 10 }}>
            <li className={"quest" + (g.done ? " done" : "")}>
              <Orb
                checked={!!g.done}
                xp={GERMAN_XP}
                label={`${g.done ? "Done" : "Mark done"}: German, Nicos Weg A1 lesson ${lesson}`}
                onChange={(v) => {
                  p.setGermanLesson(lesson, title, v);
                  if (v) localStorage.removeItem(TITLE_DRAFT(lesson));
                  toast(v ? `Lesson ${lesson} done. Bis morgen!` : `Lesson ${lesson} unticked`);
                }}
              />
              <div className="q-body">
                <span className="q-text">German: Nicos Weg A1 lesson {lesson}</span>
                <span className="q-meta">Library of Stars{lesson > 1 && !g.done ? " · skipped days keep the same lesson" : ""}</span>
              </div>
            </li>
          </ul>
          <label className="field">
            <span className="muted">Lesson title</span>
            <input
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!g.done) localStorage.setItem(TITLE_DRAFT(lesson), e.target.value);
              }}
              onBlur={() => g.done && title.trim() !== (g.done.title ?? "") && p.setGermanLesson(lesson, title, true)}
              placeholder="As shown on the DW page"
            />
          </label>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button className="btn" onClick={copy}>
              Copy tutor prompt
            </button>
            {url && (
              <a className="btn ghost" href={url} target="_blank" rel="noopener noreferrer">
                Open lesson on DW
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GermanProgress({ q }: { q: Quests }) {
  const done = q.lessons.length;
  const recent = [...q.lessons].sort((a, b) => b.lesson - a.lesson).slice(0, 5);
  return (
    <div className="card">
      <h2>
        German progress <span className="sub">{done} / {NICOS_WEG_A1_LESSONS} A1 lessons</span>
      </h2>
      <Progress pct={Math.round((done / NICOS_WEG_A1_LESSONS) * 100)} label="Nicos Weg A1 progress" />
      {recent.length ? (
        <ul className="tasks">
          {recent.map((l) => (
            <li key={l.lesson}>
              <span className="txt">
                {l.lesson}. {l.title ?? "(no title)"} <span className="muted">· {longDate(l.date)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="muted">Your first tick starts the count at lesson 1.</div>
      )}
    </div>
  );
}

function BossCard({ p, today, toast, q }: Props & { q: Quests }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("5");
  const [skill, setSkill] = useState<Skill>("business");
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="card">
      <h2>
        Boss battles <span className="sub">+{BOSS_XP} XP each</span>
      </h2>
      <ul className="bosses">
        {q.bosses.map((b) => {
          const beaten = !!b.beatenOn || b.progress >= b.target;
          return (
            <li key={b.id} className={"boss" + (beaten ? " beaten" : "")}>
              <div className="boss-top">
                <b>{b.title}</b>
                <span className="pill">{beaten ? "Beaten ✨" : skillName(b.skill)}</span>
              </div>
              <Progress pct={Math.round((Math.min(b.progress, b.target) / b.target) * 100)} label={`${b.title} progress`} />
              <div className="boss-row">
                <span className="muted">
                  {b.progress} / {b.target}
                  {b.auto === "nicos_weg" ? " · counts your Nicos Weg lessons" : b.auto === "strength_level" ? " · unlocks with Strength levels (Phase 2c)" : ""}
                  {b.beatenOn ? ` · beaten ${longDate(b.beatenOn)}` : ""}
                </span>
                {!b.auto && (
                  <span className="boss-btns">
                    <button className="btn ghost" aria-label={`One less for ${b.title}`} disabled={b.progress <= 0} onClick={() => p.saveBoss({ ...b, progress: b.progress - 1 })}>
                      −
                    </button>
                    <button
                      className="btn ghost"
                      aria-label={`One more for ${b.title}`}
                      disabled={b.progress >= b.target}
                      onClick={() => {
                        p.saveBoss({ ...b, progress: b.progress + 1 });
                        if (b.progress + 1 >= b.target) {
                          sfx.reward();
                          toast(`Boss beaten: ${b.title}! +${BOSS_XP} XP`);
                        }
                      }}
                    >
                      +
                    </button>
                  </span>
                )}
                <button className="btn ghost" onClick={() => setEditing(editing === b.id ? null : b.id)}>
                  Edit
                </button>
              </div>
              {editing === b.id && (
                <BossEditor
                  boss={b}
                  onSave={(t, n) => {
                    p.saveBoss({ ...b, title: t, target: n });
                    setEditing(null);
                  }}
                  onDelete={() => {
                    if (window.confirm(`Delete the boss battle "${b.title}"? This can't be undone.`)) p.deleteBoss(b.id);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Math.round(Number(target));
            if (!title.trim() || !(n >= 1 && n <= 10000)) return toast("Give it a name and a target from 1 to 10000.");
            p.saveBoss({
              id: `boss-${Date.now().toString(36)}`,
              title: title.trim().slice(0, 200),
              skill,
              target: n,
              progress: 0,
              auto: null,
              doneOn: null,
              sortOrder: 100 + q.bosses.length,
            });
            setTitle("");
            setAdding(false);
          }}
        >
          <input type="text" aria-label="Boss battle name" placeholder="e.g. Finish the 1-page findings summary" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          <div className="row" style={{ gap: 8 }}>
            <input type="number" inputMode="numeric" aria-label="Target" min={1} max={10000} value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: 90 }} />
            <select aria-label="Skill" value={skill} onChange={(e) => isSkill(e.target.value) && setSkill(e.target.value)}>
              {SKILLS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn">Add</button>
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn ghost wide" onClick={() => setAdding(true)}>
          Add your own boss battle
        </button>
      )}
    </div>
  );
}

function BossEditor({ boss, onSave, onDelete }: { boss: { title: string; target: number; auto: string | null }; onSave: (title: string, target: number) => void; onDelete: () => void }) {
  const [t, setT] = useState(boss.title);
  const [n, setN] = useState(String(boss.target));
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Math.round(Number(n));
        if (t.trim() && v >= 1 && v <= 10000) onSave(t.trim().slice(0, 200), v);
      }}
    >
      <input type="text" aria-label="Name" value={t} maxLength={200} onChange={(e) => setT(e.target.value)} />
      <div className="row" style={{ gap: 8 }}>
        <input type="number" aria-label="Target" min={1} max={10000} value={n} onChange={(e) => setN(e.target.value)} style={{ width: 90 }} disabled={boss.auto === "strength_level"} />
        <button className="btn">Save</button>
        <button type="button" className="btn ghost" onClick={onDelete}>
          Delete
        </button>
      </div>
    </form>
  );
}

export function QuestsScreen(props: Props) {
  const q = props.p.game?.quests;
  if (!q) return <Missing />;
  const w = q.weekly;
  return (
    <>
      <div className="card">
        <h2>
          Daily quests <span className="sub">+{DAILY_QUEST_XP} XP each</span>
        </h2>
        <ul className="quests" style={{ marginBottom: 0 }}>
          {q.daily.map((d) => (
            <li key={d.id} className={"quest" + (d.done ? " done" : "")}>
              <Orb checked={d.done} disabled label={`${d.title}${d.done ? ": done" : ": tick both habits on the Habits screen"}`} onChange={() => {}} />
              <div className="q-body">
                <span className="q-text">{d.title}</span>
                <span className="q-meta">
                  {skillName(d.skill)} · <Link to="/planner/habits">ticked on Habits</Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <GermanCard {...props} q={q} />
      <div className="card">
        <h2>
          Weekly quest <span className="sub">+{WEEKLY_XP} XP · Body</span>
        </h2>
        <div className="q-text">{w.title}</div>
        <div className="muted">
          Strength sessions {Math.min(w.strength, w.needStrength)} / {w.needStrength}
        </div>
        <Progress pct={Math.round((Math.min(w.strength, w.needStrength) / w.needStrength) * 100)} label="Strength sessions this week" />
        <div className="muted">
          After-meal walks {Math.min(w.walks, w.needWalks)} / {w.needWalks}
        </div>
        <Progress pct={Math.round((Math.min(w.walks, w.needWalks) / w.needWalks) * 100)} label="After-meal walks this week" />
        {w.doneOn && <div className="note">Done on {longDate(w.doneOn)} ✨</div>}
      </div>
      <BossCard {...props} q={q} />
      <GermanProgress q={q} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Rewards screen                                                      */
/* ------------------------------------------------------------------ */

function RewardRow({ p, toast, r, unlock, balance }: { p: Planner; toast: (m: string) => void; r: Reward; unlock: { ok: boolean; why: string }; balance: number }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(r.title);
  const [cost, setCost] = useState(String(r.cost));
  const canClaim = unlock.ok && balance >= r.cost;
  return (
    <li className="reward">
      <div className="reward-top">
        <span className="q-text">{r.title}</span>
        <span className="pill">{r.cost} coins</span>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 6 }}>
        <button
          className="btn"
          disabled={!canClaim}
          onClick={() => {
            if (!window.confirm(`Claim "${r.title}" for ${r.cost} coins?`)) return;
            p.claimReward(r);
            sfx.reward();
            toast(`Enjoy it: ${r.title} 💛`);
          }}
        >
          Claim
        </button>
        <button className="btn ghost" onClick={() => setEditing(!editing)}>
          Edit
        </button>
        {!unlock.ok ? <span className="muted small">Needs {unlock.why}</span> : balance < r.cost ? <span className="muted small">{r.cost - balance} more coins</span> : null}
      </div>
      {editing && (
        <form
          className="row"
          style={{ gap: 8, flexWrap: "wrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            const c = Math.round(Number(cost));
            if (!title.trim() || !(c >= 0 && c <= 100000)) return toast("Give it a name and a cost from 0 to 100000.");
            p.saveReward({ ...r, title: title.trim().slice(0, 200), cost: c });
            setEditing(false);
          }}
        >
          <input type="text" aria-label="Reward" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          <input type="number" aria-label="Cost in coins" min={0} value={cost} onChange={(e) => setCost(e.target.value)} style={{ width: 90 }} />
          <button className="btn">Save</button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => window.confirm(`Delete the reward "${r.title}"? This can't be undone.`) && p.deleteReward(r.id)}
          >
            Delete
          </button>
        </form>
      )}
    </li>
  );
}

function AddReward({ p, toast, count }: { p: Planner; toast: (m: string) => void; count: number }) {
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<Tier>("small");
  return (
    <form
      className="row"
      style={{ gap: 8, flexWrap: "wrap" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        p.saveReward({ id: `r-${Date.now().toString(36)}`, tier, title: title.trim().slice(0, 200), cost: TIER_COST[tier], sortOrder: 1000 + count });
        setTitle("");
        toast("Reward added");
      }}
    >
      <input type="text" aria-label="New reward" placeholder="Add a reward (no food rewards)" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      <select aria-label="Tier" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {TIER_LABEL[t]} · {TIER_COST[t]}
          </option>
        ))}
      </select>
      <button className="btn">Add</button>
    </form>
  );
}

interface BucketRow {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
}

/** Your bucket list (moved here from Treasury): dreams, not things to buy. */
function Dreams({ userId, toast }: { userId: string | null; toast: (m: string) => void }) {
  const bucket = useRows<BucketRow>("bucket_list", userId, { build: (q) => q.order("created_at") });
  const [draft, setDraft] = useState("");
  if (!supabase || !userId) return null;
  const run = async (what: string, q: PromiseLike<any>) => {
    const e = await write(what, q, bucket.reload);
    if (e) toast(e);
  };
  return (
    <div className="card">
      <h2>
        Dreams <span className="sub">your bucket list</span>
      </h2>
      <ul className="quests" style={{ marginBottom: 10 }}>
        {(bucket.rows ?? []).map((b) => (
          <li key={b.id} className={"quest" + (b.completed ? " done" : "")}>
            <Orb
              checked={b.completed}
              label={(b.completed ? "Done: " : "Mark done: ") + b.title}
              onChange={(v) =>
                run(
                  "Saving dream",
                  supabase!
                    .from("bucket_list")
                    .update({ completed: v, completed_date: v ? new Date().toISOString().slice(0, 10) : null, updated_at: new Date().toISOString() })
                    .eq("id", b.id)
                    .eq("user_id", userId),
                )
              }
            />
            <div className="q-body">
              <span className="q-text">{b.title}</span>
              {b.description && <span className="q-meta">{b.description}</span>}
            </div>
          </li>
        ))}
        {bucket.rows && !bucket.rows.length && <li className="empty">Nothing yet.</li>}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim().slice(0, 200);
          if (!t) return;
          run("Adding dream", supabase!.from("bucket_list").insert({ user_id: userId, title: t }));
          setDraft("");
        }}
      >
        <input type="text" aria-label="New dream" placeholder="Add a dream" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}

export function RewardsScreen({ p, today, toast, userId }: Props & { userId: string | null }) {
  const q = p.game?.quests;
  if (!q || !p.game) return <Missing />;
  const ctx = {
    goodWeeks: q.goodWeeks,
    strengthLevel: p.training?.strength.level ?? 1,
    firstCustomer: q.bosses.some((b) => b.id === "boss-first-customer" && !!b.beatenOn),
    today,
  };
  return (
    <>
      <div className="card coins-card">
        <div className="coin-big" aria-hidden="true">
          ✦
        </div>
        <div>
          <div className="k-level-title">{q.coins.balance} coins</div>
          <div className="muted small">
            {q.coins.earned} earned (1 per 10 XP) · {q.coins.spent} spent · spending never lowers your level
          </div>
          <div className="muted small">
            Good weeks (≥ 80%): {q.goodWeeks}
          </div>
        </div>
      </div>
      {TIERS.map((t) => {
        const list = q.rewards.filter((r) => r.tier === t);
        const unlock = tierUnlock(t, ctx);
        return (
          <div className="card" key={t}>
            <h2>
              {TIER_LABEL[t]} <span className="sub">{unlock.ok ? "Unlocked ✨" : "Locked"}</span>
            </h2>
            {!unlock.ok && <div className="muted small">Unlocks with {unlock.why}.</div>}
            <ul className="rewards">
              {list.map((r) => (
                <React.Fragment key={r.id}>
                  <RewardRow p={p} toast={toast} r={r} unlock={unlock} balance={q.coins.balance} />
                </React.Fragment>
              ))}
              {!list.length && <li className="empty">Nothing here yet.</li>}
            </ul>
          </div>
        );
      })}
      <div className="card">
        <AddReward p={p} toast={toast} count={q.rewards.length} />
      </div>
      {q.claims.length > 0 && (
        <div className="card">
          <h2>
            Claimed <span className="sub">{q.claims.length}</span>
          </h2>
          <ul className="tasks">
            {[...q.claims].reverse().map((c, i) => (
              <li key={i}>
                <span className="txt">
                  {c.title} <span className="muted">· {c.cost} coins · {longDate(c.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Dreams userId={userId} toast={toast} />
    </>
  );
}
