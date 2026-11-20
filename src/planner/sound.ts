/**
 * Sounds and vibration.
 *
 * Web Audio (not <audio>) so notes can overlap and ring into each other.
 * Nothing plays before the first tap: browsers block it, and it would be rude.
 * The first tap unlocks audio and preloads every file.
 */

import { waterMilestone } from "./water";

export type SoundName =
  | "tick-1"
  | "tick-2"
  | "tick-3"
  | "tick-4"
  | "tick-5"
  | "tick-6"
  | "xp-sparkle"
  | "block-complete"
  | "level-up"
  | "reward"
  | "wake-up"
  | "good-night";

export const SOUND_NAMES: SoundName[] = [
  "tick-1",
  "tick-2",
  "tick-3",
  "tick-4",
  "tick-5",
  "tick-6",
  "xp-sparkle",
  "block-complete",
  "level-up",
  "reward",
  "wake-up",
  "good-night",
];

export interface SoundSettings {
  sound: boolean;
  volume: number; // 0..1
  vibrate: boolean;
}

export const DEFAULT_SETTINGS: SoundSettings = { sound: true, volume: 0.7, vibrate: true };
const SETTINGS_KEY = "saisha_sound_v1";
const WAKE_KEY = "saisha_wake_played";

/** The Nth tick of the day (1-based) plays tick-N; the 6th and later all play tick-6. */
export function tickSound(n: number): SoundName {
  return `tick-${Math.min(6, Math.max(1, Math.floor(n) || 1))}` as SoundName;
}

export function parseSettings(raw: string | null): SoundSettings {
  try {
    const v = raw ? JSON.parse(raw) : {};
    const volume = Number(v.volume);
    return {
      sound: typeof v.sound === "boolean" ? v.sound : DEFAULT_SETTINGS.sound,
      vibrate: typeof v.vibrate === "boolean" ? v.vibrate : DEFAULT_SETTINGS.vibrate,
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const VIBRATE = {
  tick: 25,
  cue: [60, 80, 60],
  levelUp: [80, 60, 80, 60, 200, 100, 400],
} as const;

/* ------------------------------------------------------------------ */
/* Browser side                                                        */
/* ------------------------------------------------------------------ */

type Listener = () => void;

class SoundBoard {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private listeners = new Set<Listener>();
  private unlocked = false;
  settings: SoundSettings = DEFAULT_SETTINGS;
  /** Called once, right after the first tap (used for the morning wake-up chime). */
  onUnlock: (() => void) | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    this.settings = parseSettings(localStorage.getItem(SETTINGS_KEY));
    const unlock = () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      this.unlock();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }

  private unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.ctx.resume?.();
    for (const name of SOUND_NAMES) {
      fetch(`/sounds/${name}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => this.ctx!.decodeAudioData(b))
        .then((buf) => {
          this.buffers.set(name, buf);
          if (name === "wake-up") this.onUnlock?.();
        })
        .catch((e) => console.warn(`[sound] ${name} failed to load`, e));
    }
  }

  play(name: SoundName, delayMs = 0, gain = 1) {
    if (!this.settings.sound || !this.ctx) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = this.settings.volume * gain;
    src.connect(g).connect(this.ctx.destination);
    src.start(this.ctx.currentTime + delayMs / 1000);
  }

  vibrate(pattern: number | readonly number[]) {
    if (!this.settings.vibrate || typeof navigator === "undefined" || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern as number | number[]);
    } catch {
      /* some browsers throw without a user gesture */
    }
  }

  /** Nth tick of the day: rising note, then the XP sparkle just after. */
  tick(n: number) {
    this.play(tickSound(n));
    this.play("xp-sparkle", 160, 0.6);
    this.vibrate(VIBRATE.tick);
  }

  blockComplete() {
    this.play("block-complete", 350);
  }

  /** Water changed (ml): a soft chime at half the goal; sparkle sound when the goal is reached. */
  water(prevMl: number, nextMl: number, goalMl: number) {
    const m = waterMilestone(prevMl, nextMl, goalMl);
    if (m === "half") {
      this.play("tick-3", 0, 0.8);
      this.vibrate(VIBRATE.tick);
    } else if (m === "full") {
      this.play("xp-sparkle");
      this.play("tick-5", 120, 0.6);
      this.vibrate(VIBRATE.cue);
    }
  }

  levelUp() {
    this.play("level-up");
    this.vibrate(VIBRATE.levelUp);
  }

  reward() {
    this.play("reward");
  }

  goodNight() {
    this.play("good-night");
  }

  /** Yoga timer: switch sides / next round. */
  cue() {
    this.play("tick-3", 0, 0.7);
    this.vibrate(VIBRATE.cue);
  }

  /** Yoga timer finished. */
  done() {
    this.play("tick-5");
    this.play("tick-6", 220, 0.8);
    this.vibrate(VIBRATE.cue);
  }

  /** First open of the day before noon (after the first tap): wake-up chime, once per day. */
  wakeUpOnce(date: string, hour: number) {
    if (hour >= 12 || localStorage.getItem(WAKE_KEY) === date) return;
    localStorage.setItem(WAKE_KEY, date);
    this.play("wake-up", 0, 0.8);
  }

  update(patch: Partial<SoundSettings>) {
    this.settings = parseSettings(JSON.stringify({ ...this.settings, ...patch }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    this.listeners.forEach((l) => l());
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}

export const sfx = new SoundBoard();
