import { useCallback, useEffect, useRef, useState } from "react";
import { Block, GYM_HABIT, WATER_MAX } from "./plan";
import { ExerciseLog, GymSession, isSessionComplete } from "./gym";
import { applyEdit, PlanItem, planKey } from "./workouts";
import type { WorkoutDay } from "./plan";
import {
  backupToImportPlan,
  buildPlanTasks,
  createDayLists,
  CUSTOM_SORT_BASE,
  DayLists,
  parsePrototypeBackup,
  PlanTask,
  previousDate,
  pullNext,
  queueFor,
  removeFromDay,
} from "./logic";
import { DayRecord, PlannerStore, Snapshot } from "./store";

function cloneSnap(s: Snapshot): Snapshot {
  return {
    tasks: [...s.tasks],
    done: new Map(s.done),
    days: new Map(s.days),
    habits: new Map(s.habits),
    water: new Map(s.water),
    exercises: new Map(s.exercises),
    workoutPlans: new Map(s.workoutPlans),
  };
}

function withDay(s: Snapshot, date: string, fn: (d: DayRecord) => DayRecord): Snapshot {
  const next = cloneSnap(s);
  const d = next.days.get(date);
  if (d) next.days.set(date, fn({ ...d, lists: { deep: [...d.lists.deep], study: [...d.lists.study] } }));
  return next;
}

export interface ImportSummary {
  days: number;
  completions: number;
  customTasks: number;
  skipped: string[];
}

export function usePlanner(store: PlannerStore | null, today: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The day the current snapshot was loaded for. A new day always reloads from
  // the database first, so a list approved last night (AI review) is used as-is
  // instead of being merged with an automatic rollover.
  const [loadedOn, setLoadedOn] = useState<string | null>(null);
  const creating = useRef(new Set<string>());
  const snapRef = useRef<Snapshot | null>(null);
  snapRef.current = snap;

  const loadGen = useRef(0);
  // Writes in flight. A live-sync reload waits until they finish, so it can't
  // briefly undo a tick that is still being saved.
  const pending = useRef(0);
  const reloadWanted = useRef(false);

  const reload = useCallback(async () => {
    if (!store) return;
    // Only the most recent load may update state (StrictMode and retries can overlap).
    const gen = ++loadGen.current;
    try {
      let s = await store.load();
      if (gen !== loadGen.current) return;
      // Seed any plan tasks this user doesn't have yet (first open, or new tasks added to plan.ts).
      const have = new Set(s.tasks.map((t) => t.id));
      const missing = buildPlanTasks().filter((t) => !have.has(t.id));
      if (missing.length) {
        await store.seedPlan(missing);
        s = { ...s, tasks: [...s.tasks, ...missing] };
      }
      if (gen !== loadGen.current) return;
      setSnap(s);
      setLoadedOn(today);
      // A save error stays on screen after the reload that follows it; the
      // Retry button (clearError + reload) dismisses it.
    } catch (e: any) {
      if (gen === loadGen.current) setError(e.message ?? String(e));
    }
  }, [store, today]);

  useEffect(() => {
    setSnap(null);
  }, [store]);

  useEffect(() => {
    creating.current.clear();
    reload();
  }, [reload]);

  /** Optimistic update: apply locally, persist, reload on failure. */
  const mutate = useCallback(
    async (fn: (s: Snapshot) => Snapshot, persist: () => Promise<void>) => {
      if (!snapRef.current) return;
      const next = fn(snapRef.current);
      snapRef.current = next;
      setSnap(next);
      pending.current++;
      try {
        await persist();
      } catch (e: any) {
        setError(e.message ?? String(e));
        reloadWanted.current = true;
      } finally {
        pending.current--;
        if (pending.current === 0 && reloadWanted.current) {
          reloadWanted.current = false;
          reload();
        }
      }
    },
    [reload],
  );

  // Live sync: another device changed something, so refetch (debounced).
  useEffect(() => {
    if (!store?.subscribe) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending.current > 0) reloadWanted.current = true;
        else reload();
      }, 300);
    };
    const unsubscribe = store.subscribe(onChange);
    // Also catch up when the app comes back to the foreground (phones pause sockets).
    const onVisible = () => document.visibilityState === "visible" && onChange();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [store, reload]);

  // First time a day is opened: roll over + fill to 5.
  useEffect(() => {
    if (!store || !snap || loadedOn !== today || snap.days.has(today) || creating.current.has(today)) return;
    creating.current.add(today);
    const prevDate = previousDate(snap.days.keys(), today);
    const lists = createDayLists({
      date: today,
      tasks: snap.tasks,
      done: snap.done,
      prev: prevDate ? snap.days.get(prevDate)!.lists : null,
    });
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.days.set(today, { lists, fromAi: false, notes: null });
        return n;
      },
      () => store.createDay(today, lists),
    );
  }, [store, snap, loadedOn, today, mutate]);

  const day: DayRecord | undefined = snap?.days.get(today);
  const tasksById = new Map<string, PlanTask>((snap?.tasks ?? []).map((t) => [t.id, t] as const));

  const toggleDone = (taskId: string, checked: boolean) =>
    store &&
    mutate(
      (s) => {
        const n = cloneSnap(s);
        if (checked) n.done.set(taskId, today);
        else n.done.delete(taskId);
        return n;
      },
      () => store.setDone(taskId, checked ? today : null),
    );

  const removeTask = (block: Block, taskId: string) => {
    const task = tasksById.get(taskId);
    if (!store || !day || !task) return;
    const r = removeFromDay(day.lists[block], task);
    return mutate(
      (s) => {
        const n = withDay(s, today, (d) => ({ ...d, lists: { ...d.lists, [block]: r.items } }));
        if (r.deleteTask) {
          n.tasks = n.tasks.filter((t) => t.id !== taskId);
          n.done.delete(taskId);
        }
        return n;
      },
      async () => {
        // Deleting a custom task cascades to its list items and completion.
        if (r.deleteTask) await store.deleteTask(taskId);
        else await store.removeItem(today, taskId);
      },
    );
  };

  const addCustom = (block: Block, text: string) => {
    const clean = text.trim().slice(0, 500);
    if (!store || !day || !clean) return;
    const task: PlanTask = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      block,
      text: clean,
      phaseStart: today,
      sortOrder: CUSTOM_SORT_BASE + (snap?.tasks.filter((t) => t.isCustom).length ?? 0),
      isCustom: true,
      isAi: false,
    };
    const position = day.lists[block].length;
    const item = { taskId: task.id, carriedOver: false };
    return mutate(
      (s) => {
        const n = withDay(s, today, (d) => ({ ...d, lists: { ...d.lists, [block]: [...d.lists[block], item] } }));
        n.tasks = [...n.tasks, task];
        return n;
      },
      async () => {
        await store.addTask(task);
        await store.addItem(today, block, item, position);
      },
    );
  };

  const pull = (block: Block): { added: PlanTask | null; early: boolean } => {
    if (!store || !snap || !day) return { added: null, early: false };
    const r = pullNext(day.lists[block], queueFor(snap.tasks, block), today, snap.done);
    if (r.added) {
      const item = r.items[r.items.length - 1];
      mutate(
        (s) => withDay(s, today, (d) => ({ ...d, lists: { ...d.lists, [block]: r.items } })),
        () => store.addItem(today, block, item, r.items.length - 1),
      );
    }
    return { added: r.added, early: r.early };
  };

  const habitsFor = (date: string) => snap?.habits.get(date) ?? {};

  const setHabit = (key: string, done: boolean, date = today) =>
    store &&
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.habits.set(date, { ...(n.habits.get(date) ?? {}), [key]: done });
        return n;
      },
      () => store.setHabit(date, key, done),
    );

  const exercisesFor = (date: string): Record<string, ExerciseLog> => snap?.exercises.get(date) ?? {};

  /**
   * Update one exercise / pose / cardio item for today. When this ticks the
   * last item of today's session, the gym habit is ticked too.
   * Returns true if that happened.
   */
  const setExercise = (session: GymSession, key: string, patch: Partial<ExerciseLog>, date = today): boolean => {
    if (!store || !snapRef.current) return false;
    // Read the latest state (not this render's), so quick successive taps don't drop ticks.
    const cur = snapRef.current;
    const todays = cur.exercises.get(date) ?? {};
    const log: ExerciseLog = { done: false, sets: null, reps: null, weightKg: null, ...todays[key], ...patch };
    const after = { ...todays, [key]: log };
    const habits = cur.habits.get(date) ?? {};
    const completes = !!patch.done && isSessionComplete(session, (k) => !!after[k]?.done) && !habits[GYM_HABIT];
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.exercises.set(date, after);
        if (completes) n.habits.set(date, { ...habits, [GYM_HABIT]: true });
        return n;
      },
      async () => {
        await store.setExercise(date, key, log);
        if (completes) await store.setHabit(date, GYM_HABIT, true);
      },
    );
    return completes;
  };

  /**
   * Change your version of Day A / B (swap, reorder, add, remove) for `date` only,
   * or always. See workouts.ts applyEdit.
   */
  const editWorkout = (w: WorkoutDay, date: string, scope: "today" | "always", fn: (list: PlanItem[]) => PlanItem[]) => {
    if (!store || !snapRef.current) return;
    const rows = applyEdit(snapRef.current.workoutPlans, w, date, scope, fn);
    return mutate(
      (s) => {
        const n = cloneSnap(s);
        for (const r of rows) {
          if (r.items) n.workoutPlans.set(planKey(w, r.scope), r.items);
          else n.workoutPlans.delete(planKey(w, r.scope));
        }
        return n;
      },
      async () => {
        for (const r of rows) await store.setWorkoutPlan(w, r.scope, r.items);
      },
    );
  };

  const setWater = (glasses: number) => {
    const g = Math.max(0, Math.min(WATER_MAX, glasses));
    return (
      store &&
      mutate(
        (s) => {
          const n = cloneSnap(s);
          n.water.set(today, g);
          return n;
        },
        () => store.setWater(today, g),
      )
    );
  };

  const setNotes = (notes: string) =>
    store &&
    mutate(
      (s) => withDay(s, today, (d) => ({ ...d, notes: notes || null })),
      () => store.setNotes(today, notes.trim() ? notes.slice(0, 2000) : null),
    );

  /** Import the prototype's backup JSON. Days that already exist here are kept as they are. */
  const importBackup = async (json: string): Promise<ImportSummary> => {
    if (!store || !snap) throw new Error("Planner isn't loaded yet.");
    const plan = backupToImportPlan(parsePrototypeBackup(json), snap.tasks);
    const existing = plan.days.filter((d) => snap.days.has(d.date));
    const fresh = { ...plan, days: plan.days.filter((d) => !snap.days.has(d.date)) };
    await store.importBackup(fresh);
    await reload();
    return {
      days: fresh.days.length,
      completions: plan.completions.filter((c) => !snap.done.has(c.taskId)).length,
      customTasks: plan.customTasks.length,
      skipped: [...existing.map((d) => `${d.date}: already exists here, kept as is.`), ...plan.skipped],
    };
  };

  const lists: DayLists = day?.lists ?? { deep: [], study: [] };

  return {
    snap,
    error,
    clearError: () => setError(null),
    reload,
    day,
    lists,
    tasksById,
    habitsFor,
    water: snap?.water.get(today) ?? 0,
    toggleDone,
    removeTask,
    addCustom,
    pull,
    setHabit,
    exercisesFor,
    setExercise,
    editWorkout,
    workoutPlans: snap?.workoutPlans ?? new Map<string, PlanItem[]>(),
    setWater,
    setNotes,
    importBackup,
  };
}

export type Planner = ReturnType<typeof usePlanner>;
