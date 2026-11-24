/**
 * Home = the floating kingdom (docs/design/Main.dc.html): player level and
 * XP bar, streak flame with shields, five islands (one per skill, tap to
 * open its screen) and Lumi with a line computed from your data.
 * Plus the level-up celebration (docs/design/LevelUp.dc.html).
 * Original artwork only (CSS shapes + Lumi).
 */
import React, { useEffect, useMemo } from "react";
import { kingdomLine, Skill, SKILLS } from "./game";
import type { Game } from "./usePlanner";
import { Link } from "./router";
import { Lumi, reducedMotion } from "./ui";
import { sfx } from "./sound";

interface IslandLook {
  /** Position inside the 390 × 430 kingdom, in px of that box (scaled to %). */
  left: number;
  top: number;
  w: number;
  depth: number;
  top1: string;
  top2: string;
  glow: string;
  spire: number;
  spireColor: string;
  anim: "a" | "b";
  delay: number;
}

const LOOK: Record<Skill, IslandLook> = {
  body: { left: 18, top: 30, w: 112, depth: 46, top1: "#bff3f0", top2: "#6fc9d6", glow: "#8ee6e0", spire: 34, spireColor: "#9ff0ff", anim: "a", delay: -1 },
  mind: { left: 236, top: 14, w: 120, depth: 52, top1: "#d9c8ff", top2: "#9a7ce0", glow: "#b89cff", spire: 40, spireColor: "#d8c6ff", anim: "b", delay: 0 },
  business: { left: 8, top: 250, w: 100, depth: 40, top1: "#ffe1b8", top2: "#e9a86f", glow: "#ffd98a", spire: 24, spireColor: "#ffd98a", anim: "b", delay: -3 },
  glow: { left: 262, top: 230, w: 108, depth: 44, top1: "#ffd0de", top2: "#e48fb0", glow: "#f6a8c8", spire: 28, spireColor: "#ffc4d8", anim: "a", delay: -4 },
  family: { left: 140, top: 300, w: 104, depth: 38, top1: "#c8f0c6", top2: "#7fc59a", glow: "#9fe3b5", spire: 22, spireColor: "#ffe7a8", anim: "b", delay: -2 },
};
const W = 390;
const H = 430;
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

function Flame() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd98a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z" />
    </svg>
  );
}

function Shield({ on }: { on: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill={on ? "#8ee6e0" : "none"} stroke={on ? "#8ee6e0" : "rgba(255,255,255,0.35)"} strokeWidth="2">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </svg>
  );
}

export function LevelCard({ game }: { game: Game }) {
  const { level, streak } = game;
  const shieldText = `${streak.shields} shield${streak.shields === 1 ? "" : "s"}`;
  return (
    <div className="card k-level">
      <div className="k-level-top">
        <div>
          <div className="k-level-title">
            Level {level.level} · {level.title}
          </div>
          <div className="muted small">
            {level.into} / {level.needed} XP{game.xpToday > 0 ? ` · +${game.xpToday} today` : ""}
          </div>
        </div>
        <div className="k-streak" role="img" aria-label={`Streak: ${streak.current} day${streak.current === 1 ? "" : "s"}, ${shieldText}`}>
          <Flame />
          <b>{streak.current}</b>
          <span className="k-shields">
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                <Shield on={i < streak.shields} />
              </React.Fragment>
            ))}
          </span>
        </div>
      </div>
      <div className="k-xpbar" role="progressbar" aria-label="XP to the next level" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.into}>
        <div className="fill" style={{ width: `${level.pct}%` }} />
        <div className="shimmer" />
      </div>
    </div>
  );
}

export function Kingdom({ game, fallback }: { game: Game; fallback: string }) {
  const line = kingdomLine({ level: game.level, rest: game.rest, streak: game.streak, ticksLeft: game.ticksLeft, fallback });
  return (
    <>
      <LevelCard game={game} />
      <section className="kingdom" aria-label="Your kingdom">
        <div className="k-mist" aria-hidden="true" />
        {SKILLS.map((s) => {
          const l = LOOK[s.key];
          const lv = game.skills[s.key];
          return (
            <Link
              key={s.key}
              to={s.path}
              className={`island float-${l.anim}`}
              style={{ left: pct(l.left, W), top: pct(l.top, H), width: pct(l.w, W), animationDelay: `${l.delay}s` }}
              aria-label={`${s.island}: ${s.name} level ${lv.level}, ${lv.xp} XP`}
            >
              <span className="rock" aria-hidden="true">
                <span className="halo" style={{ background: l.glow }} />
                <span className="spires">
                  <span style={{ height: l.spire, background: l.spireColor, boxShadow: `0 0 10px ${l.spireColor}` }} />
                  <span style={{ height: 22, background: l.spireColor, opacity: 0.85 }} />
                </span>
                <span className="top" style={{ background: `linear-gradient(180deg, ${l.top1}, ${l.top2})` }} />
                <span className="under" style={{ height: l.depth }} />
              </span>
              <span className="name">{s.island}</span>
              <span className="lv">
                {s.name} · Lv {lv.level}
              </span>
            </Link>
          );
        })}
        <div className="k-lumi lumi-float" style={{ left: pct(149, W), top: pct(140, H) }}>
          <Lumi size={92} label="Lumi, your star spirit" />
        </div>
      </section>
      <div className="bubble k-bubble" role="status">
        {line}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Level-up celebration                                                */
/* ------------------------------------------------------------------ */

function Chest() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80" aria-hidden="true">
      <defs>
        <linearGradient id="chest-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b77ad0" />
          <stop offset="1" stopColor="#5a3584" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="34" rx="34" ry="12" fill="#ffd98a" opacity=".55" />
      <path d="M12 34 Q48 4 84 34 Z" fill="url(#chest-wood)" stroke="#ffd98a" strokeWidth="3" transform="rotate(-12 12 34)" />
      <rect x="12" y="34" width="72" height="40" rx="6" fill="url(#chest-wood)" stroke="#ffd98a" strokeWidth="3" />
      <rect x="42" y="40" width="12" height="16" rx="3" fill="#ffd98a" />
    </svg>
  );
}

export function LevelUpOverlay({ level, title, xp, onClose }: { level: number; title: string; xp: number; onClose: () => void }) {
  const motion = !reducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${((i * 0.43) % 4).toFixed(2)}s`,
        size: 3 + (i % 3),
      })),
    [],
  );
  useEffect(() => {
    sfx.levelUp();
    const t = setTimeout(() => sfx.reward(), 1600);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div className="levelup" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      {motion && <div className="rays" aria-hidden="true" />}
      {motion &&
        particles.map((p, i) => (
          <span key={i} className="particle" aria-hidden="true" style={{ left: p.left, animationDelay: p.delay, width: p.size, height: p.size }} />
        ))}
      <div className="levelup-body">
        <div className="eyebrow">THE KINGDOM GROWS BRIGHTER</div>
        <h2 id="levelup-title">Level up!</h2>
        <div className="crest" aria-hidden="true">
          <span>{level}</span>
        </div>
        <div className="levelup-name">
          Level {level} · {title}
        </div>
        <p className="muted">{xp} XP earned since 19 November. Every tick counted.</p>
        <div className="lumi-row" style={{ justifyContent: "center" }}>
          <div className="lumi-float">
            <Lumi size={64} mood="happy" />
          </div>
          <Chest />
        </div>
        <button className="btn wide" onClick={onClose} autoFocus>
          Back to kingdom
        </button>
      </div>
    </div>
  );
}
