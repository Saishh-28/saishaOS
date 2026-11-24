/**
 * Phase 2b: quests (daily, weekly, boss battles), coins, rewards and the
 * Nicos Weg German track. Everything here is computed from your data;
 * only boss battles, rewards, reward claims and German lessons are stored.
 */
import type { DayResult, Earned, GameData, Skill } from "./game";
import { addDays, dayOfWeek, isRestDay } from "./logic";
import { sessionFor } from "./gym";

/* ------------------------------------------------------------------ */
/* Nicos Weg (DW Learn German, A1)                                     */
/* ------------------------------------------------------------------ */

/** A1 lessons in order, as listed on learngerman.dw.com/en/nicos-weg/c-36519789 (slug, page id). */
const A1: [string, number][] = [
  ["hallo", 37250531], ["kein-problem", 37251054], ["tschüss", 37251033], ["von-a-bis-z", 37256418],
  ["ich-heiße-emma", 37262882], ["das-ist-nico", 37262923], ["woher-kommst-du", 37263828], ["nico-hat-ein-problem", 37265543],
  ["zahlen-von-1-bis-100", 37265621], ["wichtige-nummern", 37269501], ["adressen", 37269671], ["auf-dem-amt", 37269629],
  ["was-machst-du-hier", 37278679], ["was-trinkst-du", 37279418], ["eine-pizza-bitte", 37279261], ["zahlen-bitte", 37280348],
  ["ich-war-schon-in-berlin", 37325550], ["wo-liegt-das", 37337877], ["in-europa", 37328492], ["andere-länder", 37337244],
  ["was-ist-das", 37368285], ["wem-gehört-das", 37372077], ["ich-habe-kein", 37382992], ["das-auto-ist-rot", 37401537],
  ["so-wohne-ich", 37425145], ["meine-wohnung", 37425763], ["sofa-sessel-und-tisch", 37438475], ["unser-haus", 37439097],
  ["emmas-tag", 37442425], ["tageszeiten", 37445884], ["am-sonntag-koche-ich", 37452061], ["emmas-wochenende", 37452629],
  ["wie-spät-ist-es", 37453621], ["hast-du-morgen-zeit", 37461035], ["wann-spielen-wir", 37468614], ["zu-spät", 37460778],
  ["ich-bin-lehrerin", 37469204], ["mein-beruf", 37475138], ["wo-ist-der-aufzug", 37476734], ["traumberufe", 37477568],
  ["wo-ist-der-bahnhof", 37594551], ["an-der-ampel-links", 37595076], ["mit-bus-und-bahn", 37595395], ["im-büro", 37595501],
  ["lebensmittel", 37597045], ["ich-mag-nicht", 37599970], ["haushaltsarbeit", 37631238], ["was-macht-dir-spaß", 37630630],
  ["mengen-und-preise", 37628421], ["was-darf-es-sein", 37635620], ["sonst-noch-etwas", 37646611], ["wie-viel-mehl", 37647289],
  ["wie-war-dein-urlaub", 37648534], ["jahreszeiten", 37651758], ["der-ausflug", 37651657], ["wie-wird-das-wetter", 37653197],
  ["das-ist-jetzt-modern", 37655848], ["mein-lieblingspulli", 37656274], ["das-passt-gut", 37661740], ["schick", 37661765],
  ["meine-familie", 37661741], ["meine-eltern", 37664246], ["meine-tante", 37664498], ["mein-bruder", 37664164],
  ["von-kopf-bis-fuß", 37664951], ["bist-du-fit", 37668333], ["fitness", 37668815], ["ist-das-gesund", 37670365],
  ["geht-es-dir-gut", 37778457], ["beim-arzt", 37778169], ["gute-besserung", 37780308], ["nehmen-sie", 37782214],
  ["meine-heimat", 37776166], ["leben-in-deutschland", 37777069], ["anders-als-zu-hause", 37779968], ["ich-träume-von", 37783730],
];
export const NICOS_WEG_A1_LESSONS = A1.length; // 76 (plus a final test)

/** Lesson n's link on DW, or null past A1. */
export function lessonUrl(n: number): string | null {
  const l = A1[n - 1];
  return l ? `https://learngerman.dw.com/en/${l[0]}/l-${l[1]}` : null;
}

/** A starting point for the title box, from the lesson's address ("ich-heiße-emma" → "Ich heiße Emma"). Edit it to match the page. */
export function suggestedTitle(n: number): string {
  const l = A1[n - 1];
  if (!l) return "";
  const s = l[0].replace(/-/g, " ");
  return s[0].toUpperCase() + s.slice(1);
}

export const GERMAN_XP = 15;

export interface GermanLesson {
  lesson: number;
  title: string | null;
  date: string;
}

/** The lesson to do next: one after the highest done (a skipped day keeps the same lesson). */
export function nextLesson(lessons: readonly GermanLesson[]): number {
  return lessons.reduce((m, l) => Math.max(m, l.lesson), 0) + 1;
}

/** German evening quest for `date`: Mon–Sat; on Sunday none. */
export function germanQuest(lessons: readonly GermanLesson[], date: string): { lesson: number; done: GermanLesson | null } | null {
  if (dayOfWeek(date) === 0) return null;
  const done = lessons.find((l) => l.date === date) ?? null;
  return { lesson: done ? done.lesson : nextLesson(lessons), done };
}

export const TUTOR_PROMPT = `You are my friendly German tutor. I'm an A1 beginner working through DW's
"Nicos Weg" course. Today I did: Lesson [number] – "[lesson title]".

Here is the lesson's vocabulary and key phrases:
[I'll paste these from the DW lesson page]

Rules:
- Use ONLY the vocabulary and grammar above, plus anything from earlier lessons.
  Don't introduce new advanced words. If you need one, mark it NEW and translate it.
- Write in simple German with English translations in brackets.
- Correct every mistake I make: show my sentence, the corrected version, and a
  one-line explanation in English.
- Ask me ONE thing at a time and wait for my answer.

Today's 15-minute session:
1. Warm-up: quiz me on 8 words from the list (English → German).
2. Mini role-play based on the lesson's situation. You play the other person.
3. Ask me to write 3 sentences about my own life using today's grammar.
4. Finish with: my mistakes summarised, 5 flashcards (German – English),
   and one sentence of encouragement.`;

/** The tutor prompt with the lesson number and title filled in (the vocabulary line stays for you to paste). */
export function tutorPrompt(n: number, title: string): string {
  const t = title.trim() || "[lesson title]";
  return TUTOR_PROMPT.replace("[number]", String(n)).replace("[lesson title]", t);
}

/* ------------------------------------------------------------------ */
/* Daily quests (3 a day, from that day's habits)                      */
/* ------------------------------------------------------------------ */

export interface DailyQuestDef {
  id: string;
  title: string;
  skill: Skill;
  keys: string[];
}

export const DAILY_POOL: DailyQuestDef[] = [
  { id: "walks", title: "Walk after both meals", skill: "body", keys: ["walkLunch", "walkDinner"] },
  { id: "glow", title: "Skincare morning and night", skill: "glow", keys: ["skinAM", "skinPM"] },
  { id: "family", title: "Walk with Dad + teach your brother", skill: "family", keys: ["walk", "teach"] },
  { id: "steps", title: "10k steps + phone away by 9:30", skill: "body", keys: ["steps", "phone"] },
  { id: "mind", title: "Read 20 pages + protein at every meal", skill: "mind", keys: ["read", "protein"] },
];
/** Rest days: only the gentle ones. */
const REST_POOL = ["walks", "glow"];
export const DAILY_QUEST_XP = 5;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** That day's 3 daily quests (2 on a rest day), rotating through the pool. */
export function dailyQuests(date: string, habits: Readonly<Record<string, boolean>>): (DailyQuestDef & { done: boolean })[] {
  const pool = isRestDay(date, habits) ? DAILY_POOL.filter((q) => REST_POOL.includes(q.id)) : DAILY_POOL;
  const start = ((daysBetween("2026-11-19", date) % pool.length) + pool.length) % pool.length;
  const n = Math.min(3, pool.length);
  return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length]).map((q) => ({ ...q, done: q.keys.every((k) => !!habits[k]) }));
}

/* ------------------------------------------------------------------ */
/* Weekly quest                                                        */
/* ------------------------------------------------------------------ */

export const WEEKLY_XP = 100;
export const mondayOfWeek = (date: string) => addDays(date, -((dayOfWeek(date) + 6) % 7));

export interface WeeklyQuest {
  title: string;
  strength: number;
  walks: number;
  needStrength: number;
  needWalks: number;
  /** The day it was completed, or null. */
  doneOn: string | null;
}

/** "3 strength sessions + 10 after-meal walks" in the Mon–Sun week of `date` (up to `today`). */
export function weeklyQuest(habitsByDate: GameData["habits"], date: string, today: string): WeeklyQuest {
  const monday = mondayOfWeek(date);
  let strength = 0;
  let walks = 0;
  let doneOn: string | null = null;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (d > today) break;
    const h = habitsByDate.get(d) ?? {};
    if (h.gym && sessionFor(d).kind === "strength") strength++;
    walks += (h.walkLunch ? 1 : 0) + (h.walkDinner ? 1 : 0);
    if (!doneOn && strength >= 3 && walks >= 10) doneOn = d;
  }
  return { title: "3 strength sessions + 10 after-meal walks", strength, walks, needStrength: 3, needWalks: 10, doneOn };
}

/* ------------------------------------------------------------------ */
/* Boss battles                                                        */
/* ------------------------------------------------------------------ */

export type BossAuto = "nicos_weg" | "strength_level";

export interface Boss {
  id: string;
  title: string;
  skill: Skill;
  target: number;
  progress: number;
  auto: BossAuto | null;
  doneOn: string | null;
  sortOrder: number;
}

export const BOSS_XP = 200;

export const SEED_BOSSES: Boss[] = [
  { id: "boss-ca-interviews", title: "The Silent Ledger: finish 10 CA interviews", skill: "business", target: 10, progress: 0, auto: null, doneOn: null, sortOrder: 1 },
  { id: "boss-strength-2", title: "Unlock Strength Level 2", skill: "body", target: 1, progress: 0, auto: "strength_level", doneOn: null, sortOrder: 2 },
  { id: "boss-first-customer", title: "First paying customer", skill: "business", target: 1, progress: 0, auto: null, doneOn: null, sortOrder: 3 },
  { id: "boss-nicos-weg-a1", title: "Finish Nicos Weg A1", skill: "mind", target: NICOS_WEG_A1_LESSONS, progress: 0, auto: "nicos_weg", doneOn: null, sortOrder: 4 },
];

/** A boss's progress and the day it was beaten (auto bosses from your data). */
export function bossState(b: Boss, lessons: readonly GermanLesson[], strengthL2On: string | null = null): { progress: number; beatenOn: string | null } {
  if (b.auto === "nicos_weg") {
    const dates = lessons.map((l) => l.date).sort();
    const progress = Math.min(b.target, lessons.length);
    return { progress, beatenOn: lessons.length >= b.target ? dates[b.target - 1] : null };
  }
  if (b.auto === "strength_level") {
    // Beaten the Monday you reach Strength Level 2 (training.ts).
    return { progress: strengthL2On ? 1 : 0, beatenOn: strengthL2On };
  }
  const progress = Math.min(b.target, b.progress);
  return { progress, beatenOn: progress >= b.target ? b.doneOn : null };
}

/* ------------------------------------------------------------------ */
/* XP from quests                                                      */
/* ------------------------------------------------------------------ */

export function questXp(d: GameData, today: string, inRange: (date: string) => boolean): Earned[] {
  const out: Earned[] = [];
  for (const [date, habits] of d.habits) {
    if (!inRange(date)) continue;
    for (const q of dailyQuests(date, habits))
      if (q.done) out.push({ source: `quest:${date}:${q.id}`, skill: q.skill, amount: DAILY_QUEST_XP, date, reason: `Daily quest: ${q.title}` });
  }
  const weeks = new Set([...d.habits.keys()].filter(inRange).map(mondayOfWeek));
  for (const monday of weeks) {
    const w = weeklyQuest(d.habits, monday, today);
    if (w.doneOn && inRange(w.doneOn))
      out.push({ source: `weekly:${monday}:strength-walks`, skill: "body", amount: WEEKLY_XP, date: w.doneOn, reason: `Weekly quest: ${w.title}` });
  }
  for (const l of d.german ?? [])
    if (inRange(l.date))
      out.push({ source: `german:${l.lesson}`, skill: "mind", amount: GERMAN_XP, date: l.date, reason: `Nicos Weg lesson ${l.lesson}${l.title ? `: ${l.title}` : ""}`.slice(0, 120) });
  for (const b of d.bosses ?? []) {
    const s = bossState(b, d.german ?? [], d.strengthL2On ?? null);
    if (s.beatenOn && inRange(s.beatenOn))
      out.push({ source: `boss:${b.id}`, skill: b.skill, amount: BOSS_XP, date: s.beatenOn, reason: `Boss beaten: ${b.title}`.slice(0, 120) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Coins and rewards                                                   */
/* ------------------------------------------------------------------ */

/** 1 coin per 10 XP. Spending coins never touches XP or your level. */
export const XP_PER_COIN = 10;

export interface RewardClaim {
  rewardId: string;
  title: string;
  cost: number;
  date: string;
}

export function coins(totalXp: number, claims: readonly RewardClaim[]): { earned: number; spent: number; balance: number } {
  const earned = Math.floor(Math.max(0, totalXp) / XP_PER_COIN);
  const spent = claims.reduce((s, c) => s + c.cost, 0);
  return { earned, spent, balance: earned - spent };
}

export type Tier = "small" | "medium" | "big" | "epic";
export const TIERS: Tier[] = ["small", "medium", "big", "epic"];
export const TIER_COST: Record<Tier, number> = { small: 100, medium: 250, big: 500, epic: 1200 };
export const TIER_LABEL: Record<Tier, string> = { small: "Small", medium: "Medium", big: "Big", epic: "Epic" };

export interface Reward {
  id: string;
  tier: Tier;
  title: string;
  cost: number;
  sortOrder: number;
}

const seed = (tier: Tier, titles: string[], base: number): Reward[] =>
  titles.map((title, i) => ({ id: `seed-${tier}-${i + 1}`, tier, title, cost: TIER_COST[tier], sortOrder: base + i }));

/** Your list from the brief (no food rewards). Seeded once; edit freely. */
export const SEED_REWARDS: Reward[] = [
  ...seed("small", ["Silk scrunchies / satin bonnet", "New book", "Movie night with my brother", "Guilt-free day-off pass"], 100),
  ...seed("medium", ["New gym outfit or shoes", "Skincare upgrade", "Day out in Delhi", "Desk plant"], 200),
  ...seed("big", ["Curly-hair specialist cut", "Spa / salon day", "Concert or gig tickets"], 300),
  ...seed("epic", ["USB mic or MIDI keyboard for songwriting", "Weekend trip"], 400),
];

/** The last day of the 13-week journey (the "full 3 months" for Epic). */
export const JOURNEY_END = "2027-02-20";
export const GOOD_WEEK_PCT = 80;

/**
 * Finished Mon–Sun weeks (from the journey start) whose working days averaged
 * ≥ 80%. Rest days are left out of the average.
 */
export function goodWeeks(dayOn: (date: string) => DayResult, today: string, start = "2026-11-19"): number {
  let n = 0;
  for (let monday = mondayOfWeek(start); addDays(monday, 6) < today; monday = addDays(monday, 7)) {
    const pcts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (d < start) continue;
      const r = dayOn(d);
      if (!r.rest) pcts.push(r.pct);
    }
    if (pcts.length && pcts.reduce((a, b) => a + b, 0) / pcts.length >= GOOD_WEEK_PCT) n++;
  }
  return n;
}

export interface UnlockContext {
  goodWeeks: number;
  strengthLevel: number;
  firstCustomer: boolean;
  today: string;
}

/** Can a reward of this tier be claimed yet? `why` says what's still needed. */
export function tierUnlock(tier: Tier, c: UnlockContext): { ok: boolean; why: string } {
  const weeks = (n: number) => `${n} week${n > 1 ? "s" : ""} at ≥ ${GOOD_WEEK_PCT}% (you have ${c.goodWeeks})`;
  switch (tier) {
    case "small":
      return { ok: c.goodWeeks >= 1, why: weeks(1) };
    case "medium":
      return { ok: c.goodWeeks >= 2, why: weeks(2) };
    case "big":
      return { ok: c.goodWeeks >= 4 && c.strengthLevel >= 2, why: `${weeks(4)} + Strength Level 2` };
    case "epic":
      return { ok: c.firstCustomer || c.today >= JOURNEY_END, why: "First paying customer, or the full 3 months (20 Feb 2027)" };
  }
}
