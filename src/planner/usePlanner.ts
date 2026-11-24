import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boss,
  bossState,
  coins,
  dailyQuests,
  DailyQuestDef,
  GermanLesson,
  germanQuest,
  goodWeeks,
  Reward,
  RewardClaim,
  SEED_BOSSES,
  SEED_REWARDS,
  weeklyQuest,
  WeeklyQuest,
} from "./quests";
import { isComebackWeek, parseStoredLevels, StoredLevels, trackLevel, TrackLevel, withStored } from "./training";
import { dayResult, earnedXp, levelInfo, LevelInfo, reconcileXp, Skill, SKILL_KEYS, streakInfo, StreakInfo, ticksToCount, xpTotals } from "./game";
import { Block, GYM_HABIT } from "./plan";
import { Anchor, anchorMl, clampDayMl, mondayOf, parseBottleMl, waterGoal } from "./water";
import { ExerciseLog, GymSession, isSessionComplete } from "./gym";
import { applyEdit, PlanItem, planKey } from "./workouts";
import type { WorkoutDay } from "./plan";
import {
  backupToImportPlan,
  buildPlanTasks,
  createDayLists,
  CUSTOM_SORT_BASE,
  DayLists,
  dayProgress,
  parsePrototypeBackup,
  PlanTask,
  previousDate,
  pullNext,
  queueForDate,
  removeFromDay,
  upgradeStudyItems,
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
    settings: { ...s.settings },
    xp: [...s.xp],
    xpReady: s.xpReady,
    bosses: [...s.bosses],
    rewards: [...s.rewards],
    claims: [...s.claims],
    german: [...s.german],
    questsReady: s.questsReady,
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

  // One-time switch to the new study plan for a day created with the old one.
  useEffect(() => {
    const d = snap?.days.get(today);
    if (!store || !snap || !d || loadedOn !== today || creating.current.has("study:" + today)) return;
    const next = upgradeStudyItems(d.lists.study, snap.tasks, today, snap.done);
    if (!next) return;
    creating.current.add("study:" + today);
    const removed = d.lists.study.filter((i) => !next.some((x) => x.taskId === i.taskId));
    const added = next.filter((i) => !d.lists.study.some((x) => x.taskId === i.taskId));
    mutate(
      (s) => withDay(s, today, (x) => ({ ...x, lists: { ...x.lists, study: next } })),
      async () => {
        for (const i of removed) await store.removeItem(today, i.taskId);
        for (const i of added) await store.addItem(today, "study", i, next.indexOf(i));
      },
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

  /** Add your own task to today (`ai`: suggested by Lumi, shown with ✨). */
  const addCustom = (block: Block, text: string, ai = false) => {
    const clean = text.trim().slice(0, 500);
    if (!store || !day || !clean) return;
    const task: PlanTask = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      block,
      text: clean,
      phaseStart: today,
      sortOrder: CUSTOM_SORT_BASE + (snap?.tasks.filter((t) => t.isCustom).length ?? 0),
      isCustom: true,
      isAi: ai,
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
    const r = pullNext(day.lists[block], queueForDate(snap.tasks, block, today), today, snap.done);
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

  /** Set today's water (ml). */
  const setWater = (ml: number) => {
    const g = clampDayMl(ml);
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

  /** Add (or with a negative number, remove) ml. Returns [before, after]. */
  const addWater = (deltaMl: number): [number, number] => {
    const before = snapRef.current?.water.get(today) ?? 0;
    const after = clampDayMl(before + deltaMl);
    setWater(after);
    return [before, after];
  };

  const setSetting = (key: string, value: unknown) =>
    store &&
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.settings[key] = value;
        return n;
      },
      () => store.setSetting(key, value),
    );

  const settings = snap?.settings ?? {};
  const fromBottleMap = (settings.water_from_bottle ?? {}) as Record<string, boolean>;
  const fromBottle = (key: string) => fromBottleMap[key] === true;
  const setFromBottle = (key: string, on: boolean) => setSetting("water_from_bottle", { ...fromBottleMap, [key]: on });

  /** Tick an anchor quest: habit_logs tick, plus 250 ml unless it's "from my bottle" or a refill. Returns [before, after] ml. */
  const tickAnchor = (anchor: Anchor, checked: boolean): [number, number] => {
    const before = snapRef.current?.water.get(today) ?? 0;
    if (!store || !snapRef.current) return [before, before];
    const delta = anchorMl(anchor, fromBottle(anchor.key)) * (checked ? 1 : -1);
    const after = clampDayMl(before + delta);
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.habits.set(today, { ...(n.habits.get(today) ?? {}), [anchor.key]: checked });
        if (delta) n.water.set(today, after);
        return n;
      },
      async () => {
        await store.setHabit(today, anchor.key, checked);
        if (delta) await store.setWater(today, after);
      },
    );
    return [before, after];
  };

  // The gradual water goal starts the week you first use it.
  const goalStart = typeof settings.water_goal_start === "string" ? (settings.water_goal_start as string) : null;
  useEffect(() => {
    if (store && snap && loadedOn === today && !goalStart && !creating.current.has("water_goal_start")) {
      creating.current.add("water_goal_start");
      setSetting("water_goal_start", mondayOf(today));
    }
  }, [store, snap, loadedOn, today, goalStart]);
  const goal = waterGoal(snap?.water ?? new Map(), goalStart ?? mondayOf(today), today);

  /* ---------------------------- the game ---------------------------- */
  const waterGoalOn = useCallback(
    (date: string) => waterGoal(snap?.water ?? new Map(), goalStart ?? mondayOf(date), date).goalMl,
    [snap, goalStart],
  );
  /* ------------------------- training levels ------------------------- */
  const training = useMemo((): Training | null => {
    if (!snap) return null;
    const stored = parseStoredLevels(snap.settings.training_levels);
    const strength = trackLevel(snap.habits, "strength", today);
    const yoga = trackLevel(snap.habits, "yoga", today);
    return {
      strength: withStored(strength, stored.strength),
      yoga: withStored(yoga, stored.yoga),
      computed: { strength: strength.level, yoga: yoga.level },
      stored,
      comeback: isComebackWeek(snap.habits, today),
    };
  }, [snap, today]);
  const strengthL2On = training?.strength.history.find((s) => s.level >= 2)?.since ?? null;

  // Never level down: remember the highest level reached on any phone.
  useEffect(() => {
    if (!store || !snap || !training || loadedOn !== today) return;
    const next: StoredLevels = { ...training.stored };
    let changed = false;
    for (const k of ["strength", "yoga"] as const) {
      if (training.computed[k] > (training.stored[k]?.level ?? 1)) {
        next[k] = { level: training[k].level, since: training[k].since };
        changed = true;
      }
    }
    if (changed && !creating.current.has("training:" + JSON.stringify(next))) {
      creating.current.add("training:" + JSON.stringify(next));
      setSetting("training_levels", next);
    }
  }, [store, snap, training, loadedOn, today]);

  // XP rows still to write so the stored history matches what you've done.
  const xpMissing = useMemo(
    () =>
      snap && snap.xpReady && loadedOn === today ? reconcileXp(earnedXp({ ...snap, strengthL2On }, today, waterGoalOn), snap.xp) : [],
    [snap, loadedOn, today, waterGoalOn, strengthL2On],
  );
  // If saving XP fails once, stop retrying until the app is reopened (no loop of failing writes).
  const xpBroken = useRef(false);
  useEffect(() => {
    if (!store || !xpMissing.length || xpBroken.current) return;
    const rows = xpMissing;
    mutate(
      (s) => {
        const n = cloneSnap(s);
        const have = new Set(n.xp.map((e) => e.eventKey));
        n.xp = [...n.xp, ...rows.filter((e) => !have.has(e.eventKey))];
        return n;
      },
      async () => {
        try {
          await store.addXpEvents(rows);
        } catch (e) {
          xpBroken.current = true;
          throw e;
        }
      },
    );
  }, [store, xpMissing, mutate]);

  // First run with the Phase 2b tables: add your boss battles and reward list once.
  useEffect(() => {
    if (!store || !snap || !snap.questsReady || loadedOn !== today) return;
    if (snap.settings.game_quests_seeded === true || creating.current.has("quests-seed")) return;
    creating.current.add("quests-seed");
    const hb = new Set(snap.bosses.map((b) => b.id));
    const hr = new Set(snap.rewards.map((r) => r.id));
    const bosses = SEED_BOSSES.filter((b) => !hb.has(b.id));
    const rewards = snap.rewards.length ? [] : SEED_REWARDS.filter((r) => !hr.has(r.id));
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.bosses = [...n.bosses, ...bosses];
        n.rewards = [...n.rewards, ...rewards];
        n.settings.game_quests_seeded = true;
        return n;
      },
      async () => {
        await store.seedQuests(bosses, rewards);
        await store.setSetting("game_quests_seeded", true);
      },
    );
  }, [store, snap, loadedOn, today, mutate]);

  const game = useMemo((): Game | null => {
    if (!snap || !snap.xpReady) return null;
    const totals = xpTotals(snap.xp);
    const skills = Object.fromEntries(SKILL_KEYS.map((k) => [k, levelInfo(totals.bySkill[k])])) as Record<Skill, LevelInfo>;
    const dayOn = (d: string) => dayResult(snap, d, waterGoalOn(d));
    const streak = streakInfo(dayOn, today);
    const rec = snap.days.get(today);
    const prog = rec
      ? dayProgress({ lists: rec.lists, done: snap.done, habits: snap.habits.get(today) ?? {}, water: snap.water.get(today) ?? 0, waterGoalMl: waterGoalOn(today), date: today })
      : { done: 0, total: 1, rest: false };
    return {
      level: levelInfo(totals.total),
      skills,
      streak,
      ticksLeft: prog.rest ? 0 : ticksToCount(prog.done, prog.total),
      rest: prog.rest,
      xpToday: totals.byDate.get(today) ?? 0,
      settled: xpMissing.length === 0,
      quests: snap.questsReady
        ? {
            daily: dailyQuests(today, snap.habits.get(today) ?? {}),
            weekly: weeklyQuest(snap.habits, today, today),
            german: germanQuest(snap.german, today),
            lessons: [...snap.german].sort((a, b) => a.lesson - b.lesson),
            bosses: [...snap.bosses]
              .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
              .map((b) => ({ ...b, ...bossState(b, snap.german, strengthL2On) })),
            rewards: [...snap.rewards].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
            claims: snap.claims,
            coins: coins(totals.total, snap.claims),
            goodWeeks: goodWeeks(dayOn, today),
          }
        : null,
    };
  }, [snap, today, waterGoalOn, xpMissing, strengthL2On]);

  /* ---------------------- quests and rewards ---------------------- */

  /** Tick (or untick) today's Nicos Weg lesson. */
  const setGermanLesson = (lesson: number, title: string | null, done: boolean) => {
    if (!store) return;
    const row: GermanLesson | null = done ? { lesson, title: title?.trim().slice(0, 200) || null, date: today } : null;
    return mutate(
      (s) => {
        const n = cloneSnap(s);
        n.german = n.german.filter((l) => l.lesson !== lesson);
        if (row) n.german.push(row);
        return n;
      },
      () => store.setGermanLesson(lesson, row),
    );
  };

  /** Save a boss (new or edited). A manual boss reaching its target is beaten today (+200 XP). */
  const saveBoss = (b: Boss) => {
    if (!store) return;
    const beaten = !b.auto && b.progress >= b.target;
    const next: Boss = { ...b, doneOn: beaten ? b.doneOn ?? today : null };
    return mutate(
      (s) => {
        const n = cloneSnap(s);
        n.bosses = [...n.bosses.filter((x) => x.id !== b.id), next];
        return n;
      },
      () => store.setBoss(next),
    );
  };

  const deleteBoss = (id: string) =>
    store &&
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.bosses = n.bosses.filter((x) => x.id !== id);
        return n;
      },
      () => store.deleteBoss(id),
    );

  const saveReward = (r: Reward) =>
    store &&
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.rewards = [...n.rewards.filter((x) => x.id !== r.id), r];
        return n;
      },
      () => store.setReward(r),
    );

  const deleteReward = (id: string) =>
    store &&
    mutate(
      (s) => {
        const n = cloneSnap(s);
        n.rewards = n.rewards.filter((x) => x.id !== id);
        return n;
      },
      () => store.deleteReward(id),
    );

  /** Spend coins on a reward. */
  const claimReward = (r: Reward) => {
    if (!store) return;
    const claim: RewardClaim = { rewardId: r.id, title: r.title, cost: r.cost, date: today };
    return mutate(
      (s) => {
        const n = cloneSnap(s);
        n.claims = [...n.claims, claim];
        return n;
      },
      () => store.addClaim(claim),
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
    waterGoalMl: goal.goalMl,
    bottleMl: parseBottleMl(settings.bottle_ml),
    addWater,
    tickAnchor,
    fromBottle,
    setFromBottle,
    setSetting,
    settings,
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
    game,
    training,
    setGermanLesson,
    saveBoss,
    deleteBoss,
    saveReward,
    deleteReward,
    claimReward,
  };
}

export interface Training {
  strength: TrackLevel;
  yoga: TrackLevel;
  /** Levels worked out from your ticks alone (before the stored "never down" level). */
  computed: { strength: number; yoga: number };
  stored: StoredLevels;
  /** This week is a Comeback week (strength < 50% over the last 2 weeks). */
  comeback: boolean;
}

export interface Quests {
  daily: (DailyQuestDef & { done: boolean })[];
  weekly: WeeklyQuest;
  /** Today's Nicos Weg lesson (null on Sundays). */
  german: { lesson: number; done: GermanLesson | null } | null;
  lessons: GermanLesson[];
  bosses: (Boss & { beatenOn: string | null })[];
  rewards: Reward[];
  claims: RewardClaim[];
  coins: { earned: number; spent: number; balance: number };
  goodWeeks: number;
}

export interface Game {
  level: LevelInfo;
  skills: Record<Skill, LevelInfo>;
  streak: StreakInfo;
  /** Ticks still needed today for it to count towards the streak (0 on a rest day). */
  ticksLeft: number;
  /** Today is a rest day: skipped by the streak. */
  rest: boolean;
  xpToday: number;
  /** All earned XP is saved (so a level-up shown now is real). */
  settled: boolean;
  /** Phase 2b (null until its tables exist). */
  quests: Quests | null;
}

export type Planner = ReturnType<typeof usePlanner>;
