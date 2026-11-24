/**
 * Planner persistence. Two implementations of one interface:
 * - SupabaseStore: the real thing, used when signed in.
 * - LocalStore: localStorage fallback, used when Supabase isn't configured
 *   (local development), matching the rest of Saisha OS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { Block, HABITS, WATER_METRIC } from "./plan";
import { DayLists, ImportPlan, ListItem, PlanTask } from "./logic";
import type { ExerciseLog } from "./gym";
import { parsePlanItems, PlanItem, planKey, PlanScope } from "./workouts";
import { glassesToMl } from "./water";
import type { WorkoutDay } from "./plan";
import { isSkill, XpEvent } from "./game";
import { Boss, GermanLesson, Reward, RewardClaim, Tier, TIERS } from "./quests";
import { isMealSlot, MealLog, MealPlanRow, MealSlot } from "./meals";
import { BREAKOUT_AREAS, BreakoutArea, CareStep, HAIR_ITEMS, HairItem, HairLog, SkinLog } from "./care";

export interface DayRecord {
  lists: DayLists;
  fromAi: boolean;
  notes: string | null;
}

export interface Snapshot {
  tasks: PlanTask[];
  done: Map<string, string>; // taskId -> done date
  days: Map<string, DayRecord>;
  habits: Map<string, Record<string, boolean>>; // date -> habit key / gym tick -> done
  water: Map<string, number>; // date -> ml
  exercises: Map<string, Record<string, ExerciseLog>>; // date -> exercise_key -> log
  workoutPlans: Map<string, PlanItem[]>; // `${workout}|${scope}` -> your version of Day A / B
  settings: Record<string, unknown>; // user_settings key -> value
  xp: XpEvent[]; // xp_events, oldest first (empty before the Phase 2 migration)
  /** False until the xp_events table exists (so the game stays hidden instead of writing). */
  xpReady: boolean;
  bosses: Boss[];
  rewards: Reward[];
  claims: RewardClaim[];
  german: GermanLesson[];
  /** False until the Phase 2b tables exist (quests and rewards stay hidden). */
  questsReady: boolean;
  mealPlan: MealPlanRow[];
  meals: MealLog[];
  /** False until the Phase 3b tables exist (Meals stays hidden). */
  mealsReady: boolean;
  careSteps: CareStep[];
  skin: SkinLog[];
  hair: HairLog[];
  /** Days with a journal entry (dates only; the text stays on the Care screen). */
  journalDates: string[];
  bookNotes: { id: string; date: string; section: string }[];
  /** False until the Phase 2.5 tables exist (the new Care screen stays hidden). */
  careReady: boolean;
}

export interface PlannerStore {
  readonly kind: "supabase" | "local";
  load(): Promise<Snapshot>;
  /** Insert any plan tasks the user doesn't have yet. Never overwrites existing rows. */
  seedPlan(tasks: PlanTask[]): Promise<void>;
  createDay(date: string, lists: DayLists): Promise<void>;
  addItem(date: string, block: Block, item: ListItem, position: number): Promise<void>;
  removeItem(date: string, taskId: string): Promise<void>;
  setDone(taskId: string, doneDate: string | null): Promise<void>;
  addTask(task: PlanTask): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  /** Habits, skincare (routed to health_logs) and gym ticks (habit_logs). */
  setHabit(date: string, key: string, done: boolean): Promise<void>;
  /** Water for a day, in ml. */
  setWater(date: string, ml: number): Promise<void>;
  /** Gym exercises, cardio items and yoga poses (exercise_logs). */
  setExercise(date: string, key: string, log: ExerciseLog): Promise<void>;
  /** Save (or with null, delete) your version of a workout for a scope ("always" or a date). */
  setWorkoutPlan(workout: WorkoutDay, scope: PlanScope, items: PlanItem[] | null): Promise<void>;
  /** Small per-user preferences (bottle size, water goal start, "from my bottle"). */
  setSetting(key: string, value: unknown): Promise<void>;
  setNotes(date: string, notes: string | null): Promise<void>;
  /** Add XP rows (never changes or removes any). Rows with a key that already exists are skipped. */
  addXpEvents(events: XpEvent[]): Promise<void>;
  /** Insert bosses / rewards you don't have yet (first run). Never overwrites. */
  seedQuests(bosses: Boss[], rewards: Reward[]): Promise<void>;
  setBoss(boss: Boss): Promise<void>;
  deleteBoss(id: string): Promise<void>;
  setReward(reward: Reward): Promise<void>;
  deleteReward(id: string): Promise<void>;
  /** Spend coins on a reward (add-only). */
  addClaim(claim: RewardClaim): Promise<void>;
  /** Save a Nicos Weg lesson as done, or with null, remove it. */
  setGermanLesson(lesson: number, row: GermanLesson | null): Promise<void>;
  /** Add meal plan rows you don't have yet (first run). Never overwrites. */
  seedMealPlan(rows: MealPlanRow[]): Promise<void>;
  setMealPlanRow(row: MealPlanRow): Promise<void>;
  /** Log a meal ("ate this" / "something else"), or with null, clear it. */
  setMealLog(date: string, slot: MealSlot, log: MealLog | null): Promise<void>;
  seedCareSteps(steps: CareStep[]): Promise<void>;
  setCareStep(step: CareStep): Promise<void>;
  deleteCareStep(id: string): Promise<void>;
  setSkinLog(log: SkinLog): Promise<void>;
  /** Save a wash day, or with null, delete that day's log. */
  setHairLog(date: string, log: HairLog | null): Promise<void>;
  importBackup(plan: ImportPlan): Promise<void>;
  /** Live sync: call `onChange` when another device changes this user's data. Returns unsubscribe. */
  subscribe?(onChange: () => void): () => void;
}

/** Tables the planner reads; changes to any of them trigger a refetch. */
export const LIVE_TABLES = [
  "plan_tasks",
  "planner_days",
  "daily_list_items",
  "task_completions",
  "habit_logs",
  "exercise_logs",
  "health_logs",
  "workout_plans",
  "user_settings",
  "xp_events",
  "boss_battles",
  "rewards",
  "reward_claims",
  "german_lessons",
  "meal_plan",
  "meal_logs",
  "care_steps",
  "skin_logs",
  "hair_logs",
  "journal_entries",
  "book_notes",
] as const;

export const emptySnapshot = (): Snapshot => ({
  tasks: [],
  done: new Map(),
  days: new Map(),
  habits: new Map(),
  water: new Map(),
  exercises: new Map(),
  workoutPlans: new Map(),
  settings: {},
  xp: [],
  xpReady: false,
  bosses: [],
  rewards: [],
  claims: [],
  german: [],
  questsReady: false,
  mealPlan: [],
  meals: [],
  mealsReady: false,
  careSteps: [],
  skin: [],
  hair: [],
  journalDates: [],
  bookNotes: [],
  careReady: false,
});

const isArea = (v: unknown): v is BreakoutArea => BREAKOUT_AREAS.includes(v as BreakoutArea);
const isHairItem = (v: unknown): v is HairItem => HAIR_ITEMS.some((i) => i.id === v);

const isTier = (v: unknown): v is Tier => TIERS.includes(v as Tier);

/** Habit keys stored in Sanctuary's health_logs instead of habit_logs. */
const HEALTH_METRIC_BY_KEY = new Map(
  HABITS.flatMap((h) => (h.store.kind === "health" ? [[h.key, h.store.metric] as const] : [])),
);
const KEY_BY_HEALTH_METRIC = new Map([...HEALTH_METRIC_BY_KEY].map(([k, m]) => [m, k]));

/**
 * One health_logs row per (user, metric, day). Rows are matched on
 * (user_id, metric, logged_at), the same key Sanctuary uses, so both share one
 * row. The database picks the id (IDs used to be built from date + metric only).
 */
export const HEALTH_CONFLICT = "user_id,metric,logged_at";
function healthRow(userId: string, date: string, metric: string, value: string, unit: string) {
  return {
    user_id: userId,
    metric,
    value,
    unit,
    source: "manual",
    logged_at: `${date}T12:00:00Z`,
    updated_at: new Date().toISOString(),
  };
}

function setIn<T>(map: Map<string, Record<string, T>>, date: string, key: string, v: T) {
  map.set(date, { ...(map.get(date) ?? {}), [key]: v });
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

function check<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}

export class SupabaseStore implements PlannerStore {
  readonly kind = "supabase" as const;
  constructor(private sb: SupabaseClient, private userId: string) {}

  async load(): Promise<Snapshot> {
    const uid = this.userId;
    const [tasks, days, items, done, habits, health, exercises, plans, settings, xp, bosses, rewards, claims, german, mealPlan, meals, steps, skin, hair, journal, bookNotes] = await Promise.all([
      this.sb.from("plan_tasks").select("*").eq("user_id", uid),
      this.sb.from("planner_days").select("*").eq("user_id", uid),
      this.sb.from("daily_list_items").select("*").eq("user_id", uid).order("position"),
      this.sb.from("task_completions").select("*").eq("user_id", uid),
      this.sb.from("habit_logs").select("*").eq("user_id", uid),
      this.sb
        .from("health_logs")
        .select("metric,value,logged_at")
        .eq("user_id", uid)
        .in("metric", [WATER_METRIC, ...HEALTH_METRIC_BY_KEY.values()]),
      this.sb.from("exercise_logs").select("*").eq("user_id", uid),
      this.sb.from("workout_plans").select("workout,scope,items").eq("user_id", uid),
      this.sb.from("user_settings").select("key,value").eq("user_id", uid),
      this.sb
        .from("xp_events")
        .select("event_key,source,skill,amount,occurred_on,reason")
        .eq("user_id", uid)
        .order("created_at")
        .limit(20000),
      this.sb.from("boss_battles").select("*").eq("user_id", uid),
      this.sb.from("rewards").select("*").eq("user_id", uid),
      this.sb.from("reward_claims").select("reward_id,title,cost,claimed_on").eq("user_id", uid).order("created_at"),
      this.sb.from("german_lessons").select("lesson,title,done_on").eq("user_id", uid),
      this.sb.from("meal_plan").select("weekday,slot,text").eq("user_id", uid),
      this.sb.from("meal_logs").select("date,slot,ate,note").eq("user_id", uid),
      this.sb.from("care_steps").select("*").eq("user_id", uid),
      this.sb.from("skin_logs").select("date,steps,rating,areas,note").eq("user_id", uid),
      this.sb.from("hair_logs").select("date,items,products,shedding,note").eq("user_id", uid),
      // Dates only (for Journal XP); the text is only loaded on the Care screen.
      this.sb.from("journal_entries").select("entry_date").eq("user_id", uid).neq("content", ""),
      this.sb.from("book_notes").select("id,note_date,section").eq("user_id", uid),
    ]);
    for (const [r, what] of [
      [tasks, "plan_tasks"],
      [days, "planner_days"],
      [items, "daily_list_items"],
      [done, "task_completions"],
      [habits, "habit_logs"],
      [health, "health_logs"],
    ] as const)
      check(r, `Loading ${what}`);
    // Gym logs are optional for loading: if the exercise_logs migration hasn't
    // run yet, the rest of the planner still works (saving a gym tick will say so).
    if (exercises.error) console.warn("[planner] exercise_logs unavailable:", exercises.error.message);
    // Same for workout_plans (Part B migration): without it you get the default workouts.
    if (plans.error) console.warn("[planner] workout_plans unavailable:", plans.error.message);
    if (settings.error) console.warn("[planner] user_settings unavailable:", settings.error.message);
    // Phase 2 migration: without xp_events the game is hidden and nothing is written.
    if (xp.error) console.warn("[planner] xp_events unavailable:", xp.error.message);

    const snap = emptySnapshot();
    snap.tasks = (tasks.data ?? []).map((r: any) => ({
      id: r.id,
      block: r.block,
      text: r.text,
      phaseStart: r.phase_start,
      sortOrder: r.sort_order,
      isCustom: r.is_custom,
      isAi: r.is_ai,
    }));
    for (const r of days.data ?? []) snap.days.set(r.date, { lists: { deep: [], study: [] }, fromAi: r.from_ai, notes: r.notes });
    for (const r of items.data ?? []) {
      snap.days.get(r.date)?.lists[r.block as Block].push({ taskId: r.task_id, carriedOver: r.carried_over });
    }
    for (const r of done.data ?? []) snap.done.set(r.task_id, r.done_date);
    for (const r of habits.data ?? []) setIn(snap.habits, r.date, r.habit_key, r.done);
    for (const r of health.data ?? []) {
      const date = String(r.logged_at).slice(0, 10);
      if (r.metric === WATER_METRIC) snap.water.set(date, Number(r.value) || 0);
      else {
        const key = KEY_BY_HEALTH_METRIC.get(r.metric);
        if (key) setIn(snap.habits, date, key, r.value === "true");
      }
    }
    for (const r of exercises.data ?? [])
      setIn(snap.exercises, r.date, r.exercise_key, {
        done: r.done,
        sets: r.sets,
        reps: r.reps,
        weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
        plannedKey: r.planned_key ?? null,
      });
    for (const r of plans.data ?? []) {
      const list = parsePlanItems(r.items);
      if (list && (r.workout === "A" || r.workout === "B")) snap.workoutPlans.set(planKey(r.workout, r.scope), list);
    }
    for (const r of settings.data ?? []) snap.settings[r.key] = r.value;
    snap.xpReady = !xp.error;
    // Phase 2b migration: without these tables quests and rewards stay hidden.
    const qErr = bosses.error ?? rewards.error ?? claims.error ?? german.error;
    if (qErr) console.warn("[planner] quests/rewards unavailable:", qErr.message);
    snap.questsReady = !qErr;
    for (const r of bosses.data ?? [])
      if (isSkill(r.skill))
        snap.bosses.push({
          id: r.id,
          title: r.title,
          skill: r.skill,
          target: r.target,
          progress: r.progress,
          auto: r.auto ?? null,
          doneOn: r.done_on ?? null,
          sortOrder: r.sort_order,
        });
    for (const r of rewards.data ?? [])
      if (isTier(r.tier)) snap.rewards.push({ id: r.id, tier: r.tier, title: r.title, cost: r.cost, sortOrder: r.sort_order });
    for (const r of claims.data ?? []) snap.claims.push({ rewardId: r.reward_id, title: r.title, cost: r.cost, date: r.claimed_on });
    for (const r of german.data ?? []) snap.german.push({ lesson: r.lesson, title: r.title ?? null, date: r.done_on });
    // Phase 3b migration: without these tables Meals stays hidden.
    const mErr = mealPlan.error ?? meals.error;
    if (mErr) console.warn("[planner] meals unavailable:", mErr.message);
    snap.mealsReady = !mErr;
    for (const r of mealPlan.data ?? []) if (isMealSlot(r.slot)) snap.mealPlan.push({ weekday: r.weekday, slot: r.slot, text: r.text });
    for (const r of meals.data ?? [])
      if (isMealSlot(r.slot) && (r.ate === "plan" || r.ate === "other")) snap.meals.push({ date: r.date, slot: r.slot, ate: r.ate, note: r.note ?? null });
    // Phase 2.5 migration: without these tables the new Care screen stays hidden.
    const cErr = steps.error ?? skin.error ?? hair.error ?? bookNotes.error;
    if (cErr) console.warn("[planner] care unavailable:", cErr.message);
    snap.careReady = !cErr;
    for (const r of steps.data ?? [])
      if (r.routine === "am" || r.routine === "pm")
        snap.careSteps.push({ id: r.id, routine: r.routine, label: r.label, perWeek: r.per_week ?? null, sortOrder: r.sort_order });
    for (const r of skin.data ?? [])
      snap.skin.push({ date: r.date, steps: r.steps ?? [], rating: r.rating ?? null, areas: (r.areas ?? []).filter(isArea), note: r.note ?? null });
    for (const r of hair.data ?? [])
      snap.hair.push({ date: r.date, items: (r.items ?? []).filter(isHairItem), products: r.products ?? null, shedding: r.shedding ?? null, note: r.note ?? null });
    if (!journal.error) snap.journalDates = [...new Set((journal.data ?? []).map((r: any) => String(r.entry_date)))];
    for (const r of bookNotes.data ?? []) snap.bookNotes.push({ id: r.id, date: r.note_date, section: r.section });
    for (const r of xp.data ?? [])
      if (isSkill(r.skill))
        snap.xp.push({ eventKey: r.event_key, source: r.source, skill: r.skill, amount: r.amount, date: r.occurred_on, reason: r.reason ?? "" });
    return snap;
  }

  private taskRow(t: PlanTask) {
    return {
      user_id: this.userId,
      id: t.id,
      block: t.block,
      text: t.text,
      phase_start: t.phaseStart,
      sort_order: t.sortOrder,
      is_custom: t.isCustom,
      is_ai: t.isAi,
    };
  }

  async seedPlan(tasks: PlanTask[]) {
    if (!tasks.length) return;
    check(
      await this.sb.from("plan_tasks").upsert(tasks.map((t) => this.taskRow(t)), { onConflict: "user_id,id", ignoreDuplicates: true }),
      "Seeding plan",
    );
  }

  private itemRows(date: string, lists: DayLists) {
    return (["deep", "study"] as Block[]).flatMap((b) =>
      lists[b].map((it, i) => ({
        user_id: this.userId,
        date,
        block: b,
        task_id: it.taskId,
        carried_over: it.carriedOver,
        position: i,
      })),
    );
  }

  async createDay(date: string, lists: DayLists) {
    check(
      await this.sb.from("planner_days").upsert({ user_id: this.userId, date }, { onConflict: "user_id,date", ignoreDuplicates: true }),
      "Creating day",
    );
    const rows = this.itemRows(date, lists);
    if (rows.length)
      check(
        await this.sb.from("daily_list_items").upsert(rows, { onConflict: "user_id,date,task_id", ignoreDuplicates: true }),
        "Creating day's lists",
      );
  }

  async addItem(date: string, block: Block, item: ListItem, position: number) {
    check(
      await this.sb.from("daily_list_items").upsert({
        user_id: this.userId,
        date,
        block,
        task_id: item.taskId,
        carried_over: item.carriedOver,
        position,
      }),
      "Adding task to today",
    );
  }

  async removeItem(date: string, taskId: string) {
    check(
      await this.sb.from("daily_list_items").delete().eq("user_id", this.userId).eq("date", date).eq("task_id", taskId),
      "Removing task",
    );
  }

  async setDone(taskId: string, doneDate: string | null) {
    if (doneDate)
      check(
        await this.sb.from("task_completions").upsert({ user_id: this.userId, task_id: taskId, done_date: doneDate }),
        "Saving tick",
      );
    else check(await this.sb.from("task_completions").delete().eq("user_id", this.userId).eq("task_id", taskId), "Removing tick");
  }

  async addTask(task: PlanTask) {
    check(await this.sb.from("plan_tasks").insert(this.taskRow(task)), "Adding task");
  }

  async deleteTask(taskId: string) {
    check(await this.sb.from("plan_tasks").delete().eq("user_id", this.userId).eq("id", taskId), "Deleting task");
  }

  async setHabit(date: string, key: string, done: boolean) {
    const metric = HEALTH_METRIC_BY_KEY.get(key);
    if (metric) {
      check(
        await this.sb.from("health_logs").upsert(healthRow(this.userId, date, metric, String(done), "boolean"), { onConflict: HEALTH_CONFLICT }),
        "Saving habit",
      );
    } else {
      check(await this.sb.from("habit_logs").upsert({ user_id: this.userId, date, habit_key: key, done }), "Saving habit");
    }
  }

  async setWater(date: string, ml: number) {
    check(
      await this.sb.from("health_logs").upsert(healthRow(this.userId, date, WATER_METRIC, String(ml), "ml"), { onConflict: HEALTH_CONFLICT }),
      "Saving water",
    );
  }

  async setSetting(key: string, value: unknown) {
    check(await this.sb.from("user_settings").upsert({ user_id: this.userId, key, value }), "Saving setting");
  }

  async setExercise(date: string, key: string, log: ExerciseLog) {
    check(
      await this.sb.from("exercise_logs").upsert({
        user_id: this.userId,
        date,
        exercise_key: key,
        done: log.done,
        sets: log.sets,
        reps: log.reps,
        weight_kg: log.weightKg,
        planned_key: log.plannedKey ?? null,
      }),
      "Saving exercise",
    );
  }

  async setWorkoutPlan(workout: WorkoutDay, scope: PlanScope, items: PlanItem[] | null) {
    if (items)
      check(
        await this.sb.from("workout_plans").upsert({ user_id: this.userId, workout, scope, items }),
        "Saving your workout",
      );
    else
      check(
        await this.sb.from("workout_plans").delete().eq("user_id", this.userId).eq("workout", workout).eq("scope", scope),
        "Resetting your workout",
      );
  }

  async setNotes(date: string, notes: string | null) {
    check(
      await this.sb.from("planner_days").update({ notes }).eq("user_id", this.userId).eq("date", date),
      "Saving notes",
    );
  }

  async addXpEvents(events: XpEvent[]) {
    if (!events.length) return;
    const rows = events.map((e) => ({
      user_id: this.userId,
      event_key: e.eventKey,
      source: e.source,
      skill: e.skill,
      amount: e.amount,
      occurred_on: e.date,
      reason: e.reason.slice(0, 200),
    }));
    for (let i = 0; i < rows.length; i += 500)
      check(
        await this.sb.from("xp_events").upsert(rows.slice(i, i + 500), { onConflict: "user_id,event_key", ignoreDuplicates: true }),
        "Saving XP",
      );
  }

  private bossRow(b: Boss) {
    return {
      user_id: this.userId,
      id: b.id,
      title: b.title,
      skill: b.skill,
      target: b.target,
      progress: b.progress,
      auto: b.auto,
      done_on: b.doneOn,
      sort_order: b.sortOrder,
    };
  }
  private rewardRow(r: Reward) {
    return { user_id: this.userId, id: r.id, tier: r.tier, title: r.title, cost: r.cost, sort_order: r.sortOrder };
  }

  async seedQuests(bosses: Boss[], rewards: Reward[]) {
    if (bosses.length)
      check(
        await this.sb.from("boss_battles").upsert(bosses.map((b) => this.bossRow(b)), { onConflict: "user_id,id", ignoreDuplicates: true }),
        "Adding boss battles",
      );
    if (rewards.length)
      check(
        await this.sb.from("rewards").upsert(rewards.map((r) => this.rewardRow(r)), { onConflict: "user_id,id", ignoreDuplicates: true }),
        "Adding rewards",
      );
  }
  async setBoss(b: Boss) {
    check(await this.sb.from("boss_battles").upsert(this.bossRow(b), { onConflict: "user_id,id" }), "Saving boss battle");
  }
  async deleteBoss(id: string) {
    check(await this.sb.from("boss_battles").delete().eq("user_id", this.userId).eq("id", id), "Deleting boss battle");
  }
  async setReward(r: Reward) {
    check(await this.sb.from("rewards").upsert(this.rewardRow(r), { onConflict: "user_id,id" }), "Saving reward");
  }
  async deleteReward(id: string) {
    check(await this.sb.from("rewards").delete().eq("user_id", this.userId).eq("id", id), "Deleting reward");
  }
  async addClaim(c: RewardClaim) {
    check(
      await this.sb.from("reward_claims").insert({ user_id: this.userId, reward_id: c.rewardId, title: c.title, cost: c.cost, claimed_on: c.date }),
      "Claiming reward",
    );
  }
  async setGermanLesson(lesson: number, row: GermanLesson | null) {
    if (row)
      check(
        await this.sb
          .from("german_lessons")
          .upsert({ user_id: this.userId, lesson, title: row.title, done_on: row.date }, { onConflict: "user_id,lesson" }),
        "Saving German lesson",
      );
    else check(await this.sb.from("german_lessons").delete().eq("user_id", this.userId).eq("lesson", lesson), "Removing German lesson");
  }

  async seedMealPlan(rows: MealPlanRow[]) {
    if (!rows.length) return;
    check(
      await this.sb
        .from("meal_plan")
        .upsert(rows.map((r) => ({ user_id: this.userId, ...r })), { onConflict: "user_id,weekday,slot", ignoreDuplicates: true }),
      "Adding your meal plan",
    );
  }
  async setMealPlanRow(r: MealPlanRow) {
    check(
      await this.sb
        .from("meal_plan")
        .upsert({ user_id: this.userId, ...r, updated_at: new Date().toISOString() }, { onConflict: "user_id,weekday,slot" }),
      "Saving meal",
    );
  }
  async setMealLog(date: string, slot: MealSlot, log: MealLog | null) {
    if (log)
      check(
        await this.sb
          .from("meal_logs")
          .upsert({ user_id: this.userId, date, slot, ate: log.ate, note: log.note, updated_at: new Date().toISOString() }, { onConflict: "user_id,date,slot" }),
        "Saving meal",
      );
    else check(await this.sb.from("meal_logs").delete().eq("user_id", this.userId).eq("date", date).eq("slot", slot), "Clearing meal");
  }

  async seedCareSteps(steps: CareStep[]) {
    if (!steps.length) return;
    check(
      await this.sb.from("care_steps").upsert(steps.map((s) => this.stepRow(s)), { onConflict: "user_id,id", ignoreDuplicates: true }),
      "Adding your skincare steps",
    );
  }
  private stepRow(s: CareStep) {
    return { user_id: this.userId, id: s.id, routine: s.routine, label: s.label, per_week: s.perWeek, sort_order: s.sortOrder };
  }
  async setCareStep(s: CareStep) {
    check(await this.sb.from("care_steps").upsert(this.stepRow(s), { onConflict: "user_id,id" }), "Saving step");
  }
  async deleteCareStep(id: string) {
    check(await this.sb.from("care_steps").delete().eq("user_id", this.userId).eq("id", id), "Deleting step");
  }
  async setSkinLog(l: SkinLog) {
    check(
      await this.sb
        .from("skin_logs")
        .upsert(
          { user_id: this.userId, date: l.date, steps: l.steps, rating: l.rating, areas: l.areas, note: l.note, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date" },
        ),
      "Saving skin log",
    );
  }
  async setHairLog(date: string, l: HairLog | null) {
    if (!l) return void check(await this.sb.from("hair_logs").delete().eq("user_id", this.userId).eq("date", date), "Deleting wash day");
    check(
      await this.sb
        .from("hair_logs")
        .upsert(
          { user_id: this.userId, date, items: l.items, products: l.products, shedding: l.shedding, note: l.note, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date" },
        ),
      "Saving wash day",
    );
  }

  subscribe(onChange: () => void): () => void {
    // RLS applies to Realtime, so only this user's changes arrive. DELETE events
    // can't be filtered by column, so the user_id filter is applied to the
    // others and DELETEs (e.g. an untick) are listened to on their own.
    let ch = this.sb.channel(`planner-${this.userId}-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of LIVE_TABLES) {
      for (const event of ["INSERT", "UPDATE"] as const)
        ch = ch.on("postgres_changes" as any, { event, schema: "public", table, filter: `user_id=eq.${this.userId}` }, onChange);
      ch = ch.on("postgres_changes" as any, { event: "DELETE", schema: "public", table }, onChange);
    }
    ch.subscribe();
    return () => {
      this.sb.removeChannel(ch);
    };
  }

  async importBackup(plan: ImportPlan) {
    const uid = this.userId;
    if (plan.customTasks.length)
      check(
        await this.sb.from("plan_tasks").upsert(plan.customTasks.map((t) => this.taskRow(t)), { onConflict: "user_id,id", ignoreDuplicates: true }),
        "Importing custom tasks",
      );
    if (plan.days.length) {
      // Days that already exist in Supabase are left alone (their lists are not replaced).
      check(
        await this.sb
          .from("planner_days")
          .upsert(plan.days.map((d) => ({ user_id: uid, date: d.date, from_ai: d.fromAi })), { onConflict: "user_id,date", ignoreDuplicates: true }),
        "Importing days",
      );
      const items = plan.days.flatMap((d) => this.itemRows(d.date, d.lists));
      if (items.length)
        check(
          await this.sb.from("daily_list_items").upsert(items, { onConflict: "user_id,date,task_id", ignoreDuplicates: true }),
          "Importing lists",
        );
      const habitRows: any[] = [];
      const healthRows: any[] = [];
      for (const d of plan.days) {
        for (const [key, done] of Object.entries({ ...d.habits, ...d.gymTicks })) {
          const metric = HEALTH_METRIC_BY_KEY.get(key);
          if (metric) healthRows.push(healthRow(uid, d.date, metric, String(done), "boolean"));
          else habitRows.push({ user_id: uid, date: d.date, habit_key: key, done });
        }
        healthRows.push(healthRow(uid, d.date, WATER_METRIC, String(glassesToMl(d.water)), "ml"));
      }
      if (habitRows.length) check(await this.sb.from("habit_logs").upsert(habitRows), "Importing habits");
      if (healthRows.length)
        check(await this.sb.from("health_logs").upsert(healthRows, { onConflict: HEALTH_CONFLICT }), "Importing water and skincare");
    }
    if (plan.completions.length)
      check(
        await this.sb
          .from("task_completions")
          .upsert(plan.completions.map((c) => ({ user_id: uid, task_id: c.taskId, done_date: c.doneDate })), {
            onConflict: "user_id,task_id",
            ignoreDuplicates: true,
          }),
        "Importing completions",
      );
  }
}

/* ------------------------------------------------------------------ */
/* localStorage fallback                                               */
/* ------------------------------------------------------------------ */

const LOCAL_KEY = "saisha_planner_local_v1";

type Serialized = {
  tasks: PlanTask[];
  done: [string, string][];
  days: [string, DayRecord][];
  habits: [string, Record<string, boolean>][];
  water: [string, number][];
  exercises?: [string, Record<string, ExerciseLog>][];
  workoutPlans?: [string, PlanItem[]][];
  settings?: Record<string, unknown>;
  xp?: XpEvent[];
  bosses?: Boss[];
  rewards?: Reward[];
  claims?: RewardClaim[];
  german?: GermanLesson[];
  mealPlan?: MealPlanRow[];
  meals?: MealLog[];
  careSteps?: CareStep[];
  skin?: SkinLog[];
  hair?: HairLog[];
};

export class LocalStore implements PlannerStore {
  readonly kind = "local" as const;
  private snap: Snapshot = { ...emptySnapshot(), xpReady: true, questsReady: true, mealsReady: true, careReady: true };

  constructor(private storage: Pick<Storage, "getItem" | "setItem"> = localStorage) {}

  async load(): Promise<Snapshot> {
    try {
      const raw = this.storage.getItem(LOCAL_KEY);
      if (raw) {
        const s: Serialized = JSON.parse(raw);
        this.snap = {
          tasks: s.tasks,
          done: new Map(s.done),
          days: new Map(s.days),
          habits: new Map(s.habits),
          water: new Map(s.water),
          exercises: new Map(s.exercises ?? []),
          workoutPlans: new Map(s.workoutPlans ?? []),
          settings: s.settings ?? {},
          xp: s.xp ?? [],
          xpReady: true,
          bosses: s.bosses ?? [],
          rewards: s.rewards ?? [],
          claims: s.claims ?? [],
          german: s.german ?? [],
          questsReady: true,
          mealPlan: s.mealPlan ?? [],
          meals: s.meals ?? [],
          mealsReady: true,
          careSteps: s.careSteps ?? [],
          skin: s.skin ?? [],
          hair: s.hair ?? [],
          journalDates: [],
          bookNotes: [],
          careReady: true,
        };
      }
    } catch (e) {
      console.warn("[planner] Could not read local planner data", e);
    }
    return structuredClone(this.snap);
  }

  private save() {
    const s: Serialized = {
      tasks: this.snap.tasks,
      done: [...this.snap.done],
      days: [...this.snap.days],
      habits: [...this.snap.habits],
      water: [...this.snap.water],
      exercises: [...this.snap.exercises],
      workoutPlans: [...this.snap.workoutPlans],
      settings: this.snap.settings,
      xp: this.snap.xp,
      bosses: this.snap.bosses,
      rewards: this.snap.rewards,
      claims: this.snap.claims,
      german: this.snap.german,
      mealPlan: this.snap.mealPlan,
      meals: this.snap.meals,
      careSteps: this.snap.careSteps,
      skin: this.snap.skin,
      hair: this.snap.hair,
    };
    this.storage.setItem(LOCAL_KEY, JSON.stringify(s));
  }

  async seedPlan(tasks: PlanTask[]) {
    const have = new Set(this.snap.tasks.map((t) => t.id));
    this.snap.tasks.push(...tasks.filter((t) => !have.has(t.id)));
    this.save();
  }
  async createDay(date: string, lists: DayLists) {
    if (!this.snap.days.has(date)) this.snap.days.set(date, { lists: structuredClone(lists), fromAi: false, notes: null });
    this.save();
  }
  async addItem(date: string, block: Block, item: ListItem) {
    const d = this.snap.days.get(date);
    if (d && !d.lists[block].some((i) => i.taskId === item.taskId)) d.lists[block].push(item);
    this.save();
  }
  async removeItem(date: string, taskId: string) {
    const d = this.snap.days.get(date);
    if (d) for (const b of ["deep", "study"] as Block[]) d.lists[b] = d.lists[b].filter((i) => i.taskId !== taskId);
    this.save();
  }
  async setDone(taskId: string, doneDate: string | null) {
    if (doneDate) this.snap.done.set(taskId, doneDate);
    else this.snap.done.delete(taskId);
    this.save();
  }
  async addTask(task: PlanTask) {
    this.snap.tasks.push(task);
    this.save();
  }
  async deleteTask(taskId: string) {
    this.snap.tasks = this.snap.tasks.filter((t) => t.id !== taskId);
    this.snap.done.delete(taskId);
    for (const d of this.snap.days.values())
      for (const b of ["deep", "study"] as Block[]) d.lists[b] = d.lists[b].filter((i) => i.taskId !== taskId);
    this.save();
  }
  async setHabit(date: string, key: string, done: boolean) {
    setIn(this.snap.habits, date, key, done);
    this.save();
  }
  async setWater(date: string, ml: number) {
    this.snap.water.set(date, ml);
    this.save();
  }
  async setSetting(key: string, value: unknown) {
    this.snap.settings = { ...this.snap.settings, [key]: value };
    this.save();
  }
  async setExercise(date: string, key: string, log: ExerciseLog) {
    setIn(this.snap.exercises, date, key, log);
    this.save();
  }
  async setWorkoutPlan(workout: WorkoutDay, scope: PlanScope, items: PlanItem[] | null) {
    if (items) this.snap.workoutPlans.set(planKey(workout, scope), items);
    else this.snap.workoutPlans.delete(planKey(workout, scope));
    this.save();
  }
  async setNotes(date: string, notes: string | null) {
    const d = this.snap.days.get(date);
    if (d) d.notes = notes;
    this.save();
  }
  async addXpEvents(events: XpEvent[]) {
    const have = new Set(this.snap.xp.map((e) => e.eventKey));
    this.snap.xp.push(...events.filter((e) => !have.has(e.eventKey)));
    this.save();
  }
  async seedQuests(bosses: Boss[], rewards: Reward[]) {
    const hb = new Set(this.snap.bosses.map((b) => b.id));
    const hr = new Set(this.snap.rewards.map((r) => r.id));
    this.snap.bosses.push(...bosses.filter((b) => !hb.has(b.id)));
    this.snap.rewards.push(...rewards.filter((r) => !hr.has(r.id)));
    this.save();
  }
  async setBoss(b: Boss) {
    this.snap.bosses = [...this.snap.bosses.filter((x) => x.id !== b.id), b];
    this.save();
  }
  async deleteBoss(id: string) {
    this.snap.bosses = this.snap.bosses.filter((x) => x.id !== id);
    this.save();
  }
  async setReward(r: Reward) {
    this.snap.rewards = [...this.snap.rewards.filter((x) => x.id !== r.id), r];
    this.save();
  }
  async deleteReward(id: string) {
    this.snap.rewards = this.snap.rewards.filter((x) => x.id !== id);
    this.save();
  }
  async addClaim(c: RewardClaim) {
    this.snap.claims.push(c);
    this.save();
  }
  async setGermanLesson(lesson: number, row: GermanLesson | null) {
    this.snap.german = this.snap.german.filter((l) => l.lesson !== lesson);
    if (row) this.snap.german.push(row);
    this.save();
  }
  async seedMealPlan(rows: MealPlanRow[]) {
    const have = new Set(this.snap.mealPlan.map((r) => `${r.weekday}|${r.slot}`));
    this.snap.mealPlan.push(...rows.filter((r) => !have.has(`${r.weekday}|${r.slot}`)));
    this.save();
  }
  async setMealPlanRow(r: MealPlanRow) {
    this.snap.mealPlan = [...this.snap.mealPlan.filter((x) => !(x.weekday === r.weekday && x.slot === r.slot)), r];
    this.save();
  }
  async setMealLog(date: string, slot: MealSlot, log: MealLog | null) {
    this.snap.meals = this.snap.meals.filter((x) => !(x.date === date && x.slot === slot));
    if (log) this.snap.meals.push(log);
    this.save();
  }
  async seedCareSteps(steps: CareStep[]) {
    const have = new Set(this.snap.careSteps.map((s) => s.id));
    this.snap.careSteps.push(...steps.filter((s) => !have.has(s.id)));
    this.save();
  }
  async setCareStep(s: CareStep) {
    this.snap.careSteps = [...this.snap.careSteps.filter((x) => x.id !== s.id), s];
    this.save();
  }
  async deleteCareStep(id: string) {
    this.snap.careSteps = this.snap.careSteps.filter((x) => x.id !== id);
    this.save();
  }
  async setSkinLog(l: SkinLog) {
    this.snap.skin = [...this.snap.skin.filter((x) => x.date !== l.date), l];
    this.save();
  }
  async setHairLog(date: string, l: HairLog | null) {
    this.snap.hair = this.snap.hair.filter((x) => x.date !== date);
    if (l) this.snap.hair.push(l);
    this.save();
  }
  async importBackup(plan: ImportPlan) {
    await this.seedPlan(plan.customTasks);
    for (const d of plan.days) {
      if (!this.snap.days.has(d.date)) this.snap.days.set(d.date, { lists: d.lists, fromAi: d.fromAi, notes: null });
      for (const [k, v] of Object.entries({ ...d.habits, ...d.gymTicks })) setIn(this.snap.habits, d.date, k, v);
      this.snap.water.set(d.date, glassesToMl(d.water));
    }
    for (const c of plan.completions) if (!this.snap.done.has(c.taskId)) this.snap.done.set(c.taskId, c.doneDate);
    this.save();
  }
}
