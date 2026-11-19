/**
 * Planner persistence. Two implementations of one interface:
 * - SupabaseStore: the real thing, used when signed in.
 * - LocalStore: localStorage fallback, used when Supabase isn't configured
 *   (local development), matching the rest of Saisha OS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { toUUID } from "../supabaseSync";
import { Block, HABITS, WATER_METRIC } from "./plan";
import { DayLists, ImportPlan, ListItem, PlanTask } from "./logic";

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
  water: Map<string, number>; // date -> glasses
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
  setWater(date: string, glasses: number): Promise<void>;
  setNotes(date: string, notes: string | null): Promise<void>;
  importBackup(plan: ImportPlan): Promise<void>;
}

export const emptySnapshot = (): Snapshot => ({
  tasks: [],
  done: new Map(),
  days: new Map(),
  habits: new Map(),
  water: new Map(),
});

/** Habit keys stored in Sanctuary's health_logs instead of habit_logs. */
const HEALTH_METRIC_BY_KEY = new Map(
  HABITS.flatMap((h) => (h.store.kind === "health" ? [[h.key, h.store.metric] as const] : [])),
);
const KEY_BY_HEALTH_METRIC = new Map([...HEALTH_METRIC_BY_KEY].map(([k, m]) => [m, k]));

/** Same row ID scheme Sanctuary uses (see syncWellnessHistory), so both share one row. */
function healthRow(userId: string, date: string, metric: string, value: string, unit: string) {
  return {
    id: toUUID("health-" + date + "-" + metric),
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
    const [tasks, days, items, done, habits, health] = await Promise.all([
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
      check(await this.sb.from("health_logs").upsert(healthRow(this.userId, date, metric, String(done), "boolean")), "Saving habit");
    } else {
      check(await this.sb.from("habit_logs").upsert({ user_id: this.userId, date, habit_key: key, done }), "Saving habit");
    }
  }

  async setWater(date: string, glasses: number) {
    check(await this.sb.from("health_logs").upsert(healthRow(this.userId, date, WATER_METRIC, String(glasses), "cups")), "Saving water");
  }

  async setNotes(date: string, notes: string | null) {
    check(
      await this.sb.from("planner_days").update({ notes }).eq("user_id", this.userId).eq("date", date),
      "Saving notes",
    );
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
        healthRows.push(healthRow(uid, d.date, WATER_METRIC, String(d.water), "cups"));
      }
      if (habitRows.length) check(await this.sb.from("habit_logs").upsert(habitRows), "Importing habits");
      if (healthRows.length) check(await this.sb.from("health_logs").upsert(healthRows), "Importing water and skincare");
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
};

export class LocalStore implements PlannerStore {
  readonly kind = "local" as const;
  private snap: Snapshot = emptySnapshot();

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
  async setWater(date: string, glasses: number) {
    this.snap.water.set(date, glasses);
    this.save();
  }
  async setNotes(date: string, notes: string | null) {
    const d = this.snap.days.get(date);
    if (d) d.notes = notes;
    this.save();
  }
  async importBackup(plan: ImportPlan) {
    await this.seedPlan(plan.customTasks);
    for (const d of plan.days) {
      if (!this.snap.days.has(d.date)) this.snap.days.set(d.date, { lists: d.lists, fromAi: d.fromAi, notes: null });
      for (const [k, v] of Object.entries({ ...d.habits, ...d.gymTicks })) setIn(this.snap.habits, d.date, k, v);
      this.snap.water.set(d.date, d.water);
    }
    for (const c of plan.completions) if (!this.snap.done.has(c.taskId)) this.snap.done.set(c.taskId, c.doneDate);
    this.save();
  }
}
