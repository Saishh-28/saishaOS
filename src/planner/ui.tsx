/**
 * Enchanted Kingdom look: shared pieces (stars, Lumi, orb ticks, bouncy buttons).
 * Motion is decoration only. With prefers-reduced-motion, MotionConfig turns
 * movement off but state changes (orb fill, opacity) still show.
 */
import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";

const PALETTE = ["#8ee6e0", "#f2c6b4", "#ffd98a", "#fff6d6"];

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Fixed twinkling star field behind the planner. Deterministic, so it doesn't jump between renders. */
export function Stars({ count = 34 }: { count?: number }) {
  const stars = useMemo(() => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
    return Array.from({ length: count }, () => ({
      left: `${(rnd() * 100).toFixed(1)}%`,
      top: `${(rnd() * 100).toFixed(1)}%`,
      size: rnd() > 0.85 ? 3 : 2,
      delay: `${(rnd() * 3).toFixed(2)}s`,
    }));
  }, [count]);
  return (
    <div className="k-stars" aria-hidden="true">
      {stars.map((s, i) => (
        <span key={i} style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }} />
      ))}
    </div>
  );
}

/** Lumi, the star spirit (original artwork from docs/design). */
export function Lumi({ size = 54, mood = "smile", label }: { size?: number; mood?: "smile" | "happy"; label?: string }) {
  const id = useMemo(() => "lumi" + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={id} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fffbe9" />
          <stop offset="45%" stopColor="#ffe7a8" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`} />
      <path d="M50 18 C54 38 62 46 82 50 C62 54 54 62 50 82 C46 62 38 54 18 50 C38 46 46 38 50 18 Z" fill="#fff6d6" />
      {mood === "happy" ? (
        <>
          <path d="M41 49 Q44 45 47 49" stroke="#3b2a6b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M53 49 Q56 45 59 49" stroke="#3b2a6b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="44" cy="49" rx="2.6" ry="3.6" fill="#3b2a6b" />
          <ellipse cx="56" cy="49" rx="2.6" ry="3.6" fill="#3b2a6b" />
        </>
      )}
      <circle cx="40" cy="56" r="3" fill="#f6a8b8" opacity=".7" />
      <circle cx="60" cy="56" r="3" fill="#f6a8b8" opacity=".7" />
      <path d="M46 57 Q50 61 54 57" stroke="#3b2a6b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Small sparkle burst from an element (skipped with reduced motion; the orb still fills). */
export function sparkleFrom(el: Element | null) {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  confetti({
    particleCount: 26,
    spread: 70,
    startVelocity: 18,
    gravity: 0.6,
    ticks: 70,
    scalar: 0.7,
    shapes: ["star", "circle"],
    colors: PALETTE,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
    disableForReducedMotion: true,
    zIndex: 50,
  });
}

/** Bouncy press. */
export const Btn = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof motion.button>>(function Btn(props, ref) {
  return <motion.button ref={ref} whileTap={{ scale: 0.94 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} {...props} />;
});

/**
 * Glowing orb checkbox (44 × 44). On tick: sparkle burst and a floating "+N XP".
 * `onChange` gets the new state.
 */
export function Orb({
  checked,
  onChange,
  label,
  xp,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  xp?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [burst, setBurst] = useState(0);
  return (
    <span className="orb-wrap">
      <motion.button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        className={"orb" + (checked ? " on" : "")}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.86 }}
        animate={checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 16 }}
        onClick={() => {
          const next = !checked;
          if (next) {
            sparkleFrom(ref.current);
            if (xp) setBurst((b) => b + 1);
          }
          onChange(next);
        }}
      >
        {checked && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e2160" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </motion.button>
      <AnimatePresence>
        {burst > 0 && xp ? (
          <motion.span
            key={burst}
            className="xp-float"
            aria-hidden="true"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: -30 }}
            transition={{ duration: 1.3, delay: 0.12, ease: "easeOut" }}
            onAnimationComplete={() => setBurst(0)}
          >
            +{xp} XP
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function Progress({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="k-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.span initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      <i className="shimmer" />
    </div>
  );
}

/** Stroke icons for the bottom nav (24 × 24). */
export const ICONS: Record<string, string> = {
  today: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  deep: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1",
  study: "M4 5c3-1 5-1 8 1 3-2 5-2 8-1v14c-3-1-5-1-8 1-3-2-5-2-8-1zM12 6v14",
  gym: "M3 20l6-11 4 6 3-4 5 9zM14 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1z",
  habits: "M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z",
  review: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5zM17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6z",
  more: "M4 6h16M4 12h16M4 18h16",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Moonlit Garden fountain: the basin fills with the day's water. Full = glow. */
export function Fountain({ pct, size = 96, label }: { pct: number; size?: number; label: string }) {
  const p = Math.max(0, Math.min(1, pct));
  const full = p >= 1;
  const top = 70 - 46 * p; // water surface inside the basin (y from 24 to 70)
  return (
    <svg className={"fountain" + (full ? " full" : "")} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
      <defs>
        <linearGradient id="fw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9fbff" />
          <stop offset="100%" stopColor="#8ee6e0" />
        </linearGradient>
        <clipPath id="fbasin">
          <path d="M22 24 H78 L72 70 Q50 78 28 70 Z" />
        </clipPath>
      </defs>
      <ellipse cx="50" cy="88" rx="34" ry="6" fill="rgba(142,230,224,0.25)" />
      <rect x="44" y="70" width="12" height="18" rx="3" fill="#5b4a8f" />
      <path d="M22 24 H78 L72 70 Q50 78 28 70 Z" fill="rgba(10,6,40,0.55)" stroke="rgba(191,243,240,0.6)" strokeWidth="2" />
      <g clipPath="url(#fbasin)">
        <rect x="0" y={top} width="100" height="80" fill="url(#fw)" opacity="0.9" />
        <path d={`M0 ${top} Q 25 ${top - 3} 50 ${top} T 100 ${top}`} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
      </g>
      {full && <circle cx="50" cy="14" r="5" fill="#fff6d6" className="f-spark" />}
    </svg>
  );
}
