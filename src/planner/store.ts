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
});

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
    const [tasks, days, items, done, habits, health, exercises, plans, settings, xp] = await Promise.all([
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
};

export class LocalStore implements PlannerStore {
  readonly kind = "local" as const;
  private snap: Snapshot = { ...emptySnapshot(), xpReady: true };

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
