import { supabase } from "./supabase";
import { SaishaOSState, Ritual, UniversityCourse, CareerMilestone, WellnessEntry, SongDraft, BudgetCategory, ChatMessage, OnboardingData, EMPTY_STATE } from "./types";

/**
 * Deterministically maps any custom string ID to a valid UUID format
 * to prevent database constraint errors while keeping frontend logic identical.
 */
export function toUUID(str: string): string {
  if (!str) return "00000000-0000-0000-0000-000000000000";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let hex = Math.abs(hash).toString(16).padStart(8, "0");
  hex = (hex + "000000000000000000000000").substring(0, 32);
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * Check if the user has completed their Saisha OS onboarding profile in Supabase.
 */
export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1. Check profiles table for an existing named record
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error checking remote profile:", profileError);
      return false;
    }

    if (!profile || !profile.name || profile.name.trim().length === 0) {
      return false;
    }

    // 2. Check settings table for onboarding_completed flag
    const { data: settings } = await supabase
      .from("settings")
      .select("widget_settings")
      .eq("user_id", userId)
      .maybeSingle();

    if (settings?.widget_settings?.onboarding_completed === true) {
      return true;
    }

    // If profile exists and has a non-empty name, consider onboarding done
    return true;
  } catch (err) {
    console.error("Failed checking onboarding status:", err);
    return false;
  }
}

/**
 * Check if remote database already has any data populated for this user.
 */
export async function hasRemoteData(userId: string): Promise<boolean> {
  return checkOnboardingStatus(userId);
}

/**
 * Persist complete user-authored onboarding data to Supabase relational tables.
 */
export async function saveOnboardingData(userId: string, data: OnboardingData): Promise<void> {
  if (!supabase) throw new Error("Supabase is not initialized");

  const now = new Date().toISOString();
  const userName = data.preferredName.trim() || "Creator";
  const userFocus = data.priorityFocus?.trim() || data.academicGoals?.trim() || data.careerGoals?.trim() || "Thriving in academics and daily life";

  try {
    // 1. Save Profile
    await supabase.from("profiles").upsert({
      id: userId,
      name: userName,
      current_focus: userFocus,
      updated_at: now
    });

    // 2. Save Settings with structured Onboarding metadata
    const widgetSettings = {
      onboarding_completed: true,
      university: data.university,
      degree: data.degree,
      year_of_study: data.yearOfStudy,
      enabled_areas: data.enabledAreas,
      career_interests: data.careerInterests,
      desired_roles: data.desiredRoles,
      industries: data.industries,
      skills_to_develop: data.skillsToDevelop,
      internship_goals: data.internshipJobGoals,
      target_locations: data.targetCompaniesOrLocations,
      academic_goals: data.academicGoals,
      career_goals: data.careerGoals,
      creative_goals: data.creativeGoals,
      personal_goals: data.personalGoals,
      wake_time: data.typicalWakeTime,
      sleep_time: data.typicalSleepTime,
      exercise_habits: data.exerciseHabits,
      study_preferences: data.studyPreferences,
      creative_habits: data.creativeHabits,
      self_care_routines: data.selfCareRoutines,
      consistency_focus: data.consistencyFocus,
      wellbeing_enabled: data.enableWellbeing,
      wellbeing_goals: data.wellbeingGoals || "",
      sleep_consistency: data.sleepConsistency || "",
      energy_challenges: data.energyChallenges || "",
      support_preferences: data.supportPreferences || ""
    };

    await supabase.from("settings").upsert({
      user_id: userId,
      theme: "dark",
      widget_settings: widgetSettings,
      updated_at: now
    }, { onConflict: "user_id" });

    // 3. Save User's entered Courses
    if (data.courses && data.courses.length > 0) {
      const validCourses = data.courses.filter(c => c.code.trim() || c.name.trim());
      const dbCourses = validCourses.map((c, index) => ({
        id: toUUID(`course-${userId}-${index}-${c.code || index}`),
        user_id: userId,
        code: c.code.trim().toUpperCase() || "COURSE",
        name: c.name.trim() || "Course Subject",
        professor: "TBA",
        credits: 15,
        grade_goal: c.gradeGoal?.trim() || "A",
        updated_at: now
      }));
      if (dbCourses.length > 0) {
        await supabase.from("courses").upsert(dbCourses);
      }
    }

    // 4. Save Career Milestones if entered
    const dbProjects: any[] = [];
    if (data.careerGoals?.trim()) {
      dbProjects.push({
        id: toUUID(`project-${userId}-career-goal`),
        user_id: userId,
        title: data.careerGoals.trim(),
        description: data.desiredRoles?.length ? `Target roles: ${data.desiredRoles.join(", ")}` : "",
        status: "backlog",
        difficulty: "internship",
        updated_at: now
      });
    }
    if (data.skillsToDevelop && data.skillsToDevelop.length > 0) {
      data.skillsToDevelop.forEach((skill, idx) => {
        if (skill.trim()) {
          dbProjects.push({
            id: toUUID(`project-${userId}-skill-${idx}`),
            user_id: userId,
            title: `Develop Skill: ${skill.trim()}`,
            description: "Identified during onboarding",
            status: "backlog",
            difficulty: "skill",
            updated_at: now
          });
        }
      });
    }
    if (data.internshipJobGoals?.trim()) {
      dbProjects.push({
        id: toUUID(`project-${userId}-internship`),
        user_id: userId,
        title: data.internshipJobGoals.trim(),
        description: data.targetCompaniesOrLocations?.trim() ? `Target: ${data.targetCompaniesOrLocations.trim()}` : "",
        status: "backlog",
        difficulty: "internship",
        updated_at: now
      });
    }
    if (dbProjects.length > 0) {
      await supabase.from("career_projects").upsert(dbProjects);
    }

    // 5. Save Daily Rituals
    if (data.rituals && data.rituals.length > 0) {
      const dbRituals = data.rituals.map((r, idx) => ({
        id: toUUID(`ritual-${userId}-${idx}-${r.name}`),
        user_id: userId,
        name: r.name,
        time_of_day: r.timeOfDay,
        completed: false,
        category: r.category,
        updated_at: now
      }));
      await supabase.from("rituals").upsert(dbRituals);
    }

    // 6. Save Budget if tracking enabled
    if (data.trackFinances) {
      const budgetId = toUUID(`budget-${userId}`);
      await supabase.from("budgets").upsert({
        id: budgetId,
        user_id: userId,
        name: "Primary Budget",
        savings_goal: data.savingsGoal || 0,
        current_savings: 0,
        updated_at: now
      });

      if (data.budgetCategories && data.budgetCategories.length > 0) {
        const validCategories = data.budgetCategories.filter(c => c.name.trim());
        const dbCategories = validCategories.map((cat, idx) => ({
          id: toUUID(`cat-${userId}-${idx}-${cat.name}`),
          user_id: userId,
          budget_id: budgetId,
          name: cat.name.trim(),
          budgeted_amount: cat.budgeted || 0,
          updated_at: now
        }));
        if (dbCategories.length > 0) {
          await supabase.from("budget_categories").upsert(dbCategories);
        }
      }
    }

    // 7. Welcome Chat Message
    const sessionId = toUUID(`session-${userId}-init`);
    await supabase.from("chat_sessions").upsert({
      id: sessionId,
      user_id: userId,
      title: "Welcome Session",
      ai_personality: "jarvis",
      updated_at: now
    });

    const welcomeSegments: string[] = [
      `Welcome to Saisha OS, ${userName}. Your personalized workspace is ready and connected to your cloud vault.`
    ];
    if (data.courses?.filter(c => c.code || c.name).length) {
      welcomeSegments.push(`• ${data.courses.filter(c => c.code || c.name).length} course(s) tracking in The Zenith Workspace.`);
    }
    if (data.rituals?.length) {
      welcomeSegments.push(`• ${data.rituals.length} daily ritual(s) active on your board.`);
    }
    if (data.priorityFocus) {
      welcomeSegments.push(`• Priority Focus: "${data.priorityFocus}".`);
    }
    welcomeSegments.push("How can I assist your alignment and focus today?");

    await supabase.from("chat_messages").upsert({
      id: toUUID(`msg-${userId}-welcome`),
      user_id: userId,
      session_id: sessionId,
      sender: "assistant",
      text: welcomeSegments.join("\n"),
      created_at: now
    });

    console.log("[saveOnboardingData] Successfully persisted new user state to Supabase.");
  } catch (err) {
    console.error("[saveOnboardingData] Error persisting onboarding data:", err);
    throw err;
  }
}

/**
 * Push full local state to remote Supabase DB.
 */
export async function uploadInitialState(userId: string, state: SaishaOSState, bucketList: any[]) {
  if (!supabase) return;

  try {
    // 1. Profile
    if (state.user?.name) {
      await supabase.from("profiles").upsert({
        id: userId,
        name: state.user.name,
        current_focus: state.user.currentFocus || "",
        updated_at: new Date().toISOString()
      });
    }

    // 2. Rituals
    const dbRituals = state.rituals.map(r => ({
      id: toUUID(r.id),
      user_id: userId,
      name: r.name,
      time_of_day: r.timeOfDay,
      completed: r.completed,
      category: r.category,
      updated_at: new Date().toISOString()
    }));
    if (dbRituals.length > 0) {
      await supabase.from("rituals").upsert(dbRituals);
    }

    // 3. Courses & Tasks
    const dbCourses = state.courses.map(c => ({
      id: toUUID(c.id),
      user_id: userId,
      code: c.code,
      name: c.name,
      professor: c.professor || "TBA",
      credits: c.credits,
      grade_goal: c.gradeGoal,
      updated_at: new Date().toISOString()
    }));
    if (dbCourses.length > 0) {
      await supabase.from("courses").upsert(dbCourses);
    }

    const dbAssignments: any[] = [];
    state.courses.forEach(c => {
      c.tasks.forEach(t => {
        dbAssignments.push({
          id: toUUID(t.id),
          user_id: userId,
          course_id: toUUID(c.id),
          title: t.title,
          due_date: new Date(t.dueDate).toISOString(),
          weight: t.weight,
          completed: t.completed,
          updated_at: new Date().toISOString()
        });
      });
    });
    if (dbAssignments.length > 0) {
      await supabase.from("assignments").upsert(dbAssignments);
    }

    // 4. Career Milestones
    const dbProjects = state.careerMilestones.map(m => ({
      id: toUUID(m.id),
      user_id: userId,
      title: m.title,
      description: m.details || "",
      status: m.completed ? "completed" : "backlog",
      difficulty: m.category,
      updated_at: new Date().toISOString()
    }));
    if (dbProjects.length > 0) {
      await supabase.from("career_projects").upsert(dbProjects);
    }

    // 5. Wellness History
    const dbJournals: any[] = [];
    const dbLogs: any[] = [];
    state.wellnessHistory.forEach(entry => {
      const entryDate = entry.date;
      dbJournals.push({
        id: toUUID("journal-" + entryDate),
        user_id: userId,
        title: "Daily Sanctuary Journal",
        prompt: entry.journalPrompt,
        content: entry.journalText || "",
        category: "reflection",
        mood_score: entry.moodScore,
        entry_date: entryDate,
        updated_at: new Date().toISOString()
      });

      const metrics = {
        hair_oiled: entry.hairRecovery?.oiled ? "true" : "false",
        hair_dermarolled: entry.hairRecovery?.dermarolled ? "true" : "false",
        hair_serum_applied: entry.hairRecovery?.serumApplied ? "true" : "false",
        hair_massage_done: entry.hairRecovery?.massageDone ? "true" : "false",
        skin_morning_done: entry.skinRoutine?.morningDone ? "true" : "false",
        skin_night_done: entry.skinRoutine?.nightDone ? "true" : "false",
        mood_score: (entry.moodScore || 7).toString(),
        water_cups: (entry.waterIntakeCups || 0).toString()
      };

      Object.entries(metrics).forEach(([metricName, value]) => {
        dbLogs.push({
          id: toUUID("health-" + entryDate + "-" + metricName),
          user_id: userId,
          metric: metricName,
          value: value,
          unit: metricName.endsWith("_done") || metricName.startsWith("hair_") ? "boolean" : metricName === "mood_score" ? "score" : "cups",
          source: "manual",
          logged_at: `${entryDate}T12:00:00Z`,
          updated_at: new Date().toISOString()
        });
      });
    });
    if (dbJournals.length > 0) {
      await supabase.from("journal_entries").upsert(dbJournals);
    }
    if (dbLogs.length > 0) {
      await supabase.from("health_logs").upsert(dbLogs);
    }

    // 6. Songs & Lyrics
    const dbSongs = state.songs.map(s => ({
      id: toUUID(s.id),
      user_id: userId,
      title: s.title,
      status: s.status,
      key: s.key || "",
      tempo: s.tempo || "",
      chords: s.chords || "",
      tags: s.tags || [],
      updated_at: new Date().toISOString()
    }));
    if (dbSongs.length > 0) {
      await supabase.from("songs").upsert(dbSongs);
    }

    const dbVersions = state.songs.map(s => ({
      id: toUUID("version-" + s.id),
      user_id: userId,
      song_id: toUUID(s.id),
      version_number: 1,
      lyrics: s.lyrics || "",
      updated_at: new Date().toISOString()
    }));
    if (dbVersions.length > 0) {
      await supabase.from("song_versions").upsert(dbVersions);
    }

    // 7. Budget
    if (state.budget && (state.budget.savingsGoal > 0 || state.budget.categories.length > 0)) {
      const budgetId = toUUID("default-budget");
      await supabase.from("budgets").upsert({
        id: budgetId,
        user_id: userId,
        name: "Primary Budget",
        savings_goal: state.budget.savingsGoal,
        current_savings: state.budget.currentSavings,
        updated_at: new Date().toISOString()
      });

      const dbCategories = state.budget.categories.map(cat => ({
        id: toUUID(cat.id),
        user_id: userId,
        budget_id: budgetId,
        name: cat.name,
        budgeted_amount: cat.budgeted,
        updated_at: new Date().toISOString()
      }));
      if (dbCategories.length > 0) {
        await supabase.from("budget_categories").upsert(dbCategories);
      }
    }

    // 8. Bucket List
    if (bucketList && bucketList.length > 0) {
      const dbBucket = bucketList.map(item => ({
        id: toUUID(item.id),
        user_id: userId,
        title: item.title,
        description: item.location || "",
        completed: item.completed,
        updated_at: new Date().toISOString()
      }));
      await supabase.from("bucket_list").upsert(dbBucket);
    }

    console.log("[uploadInitialState] Successfully synchronized state with Supabase.");
  } catch (err) {
    console.error("[uploadInitialState] Failure uploading state:", err);
  }
}

/**
 * Fetch and build the complete SaishaOSState from relational Supabase tables.
 */
export async function fetchFullState(userId: string): Promise<{ state: SaishaOSState; bucketList: any[] }> {
  // Fetch profiles
  const { data: profile } = await supabase!.from("profiles").select("*").eq("id", userId).maybeSingle();

  // Fetch settings for additional profile info
  const { data: settings } = await supabase!.from("settings").select("*").eq("user_id", userId).maybeSingle();
  const widgetSettings = settings?.widget_settings || {};

  // Fetch rituals
  const { data: rituals } = await supabase!.from("rituals").select("*").eq("user_id", userId).order("created_at");

  // Fetch courses and assignments
  const { data: courses } = await supabase!.from("courses").select("*").eq("user_id", userId);
  const { data: assignments } = await supabase!.from("assignments").select("*").eq("user_id", userId);

  // Fetch career projects (milestones)
  const { data: careerProjects } = await supabase!.from("career_projects").select("*").eq("user_id", userId);

  // Fetch wellness history
  const { data: dbJournals } = await supabase!.from("journal_entries").select("*").eq("user_id", userId);
  const { data: dbLogs } = await supabase!.from("health_logs").select("*").eq("user_id", userId);

  const entriesMap: Record<string, Partial<WellnessEntry>> = {};

  // Group journals
  dbJournals?.forEach(j => {
    const dateStr = j.entry_date; // YYYY-MM-DD
    entriesMap[dateStr] = {
      date: dateStr,
      journalPrompt: j.prompt || "How did you embrace stillness on your path today?",
      journalText: j.content,
      moodScore: j.mood_score || 7,
      hairRecovery: { oiled: false, dermarolled: false, serumApplied: false, massageDone: false },
      skinRoutine: { morningDone: false, nightDone: false },
      waterIntakeCups: 0
    };
  });

  // Merge health logs
  dbLogs?.forEach(log => {
    const dateStr = log.logged_at ? log.logged_at.split("T")[0] : "";
    if (!dateStr) return;

    if (!entriesMap[dateStr]) {
      entriesMap[dateStr] = {
        date: dateStr,
        journalPrompt: "How did you embrace stillness on your path today?",
        journalText: "",
        moodScore: 7,
        hairRecovery: { oiled: false, dermarolled: false, serumApplied: false, massageDone: false },
        skinRoutine: { morningDone: false, nightDone: false },
        waterIntakeCups: 0
      };
    }

    const entry = entriesMap[dateStr];
    const valBool = log.value === "true";
    const valNum = Number(log.value);

    if (log.metric === "hair_oiled" && entry.hairRecovery) entry.hairRecovery.oiled = valBool;
    else if (log.metric === "hair_dermarolled" && entry.hairRecovery) entry.hairRecovery.dermarolled = valBool;
    else if (log.metric === "hair_serum_applied" && entry.hairRecovery) entry.hairRecovery.serumApplied = valBool;
    else if (log.metric === "hair_massage_done" && entry.hairRecovery) entry.hairRecovery.massageDone = valBool;
    else if (log.metric === "skin_morning_done" && entry.skinRoutine) entry.skinRoutine.morningDone = valBool;
    else if (log.metric === "skin_night_done" && entry.skinRoutine) entry.skinRoutine.nightDone = valBool;
    else if (log.metric === "mood_score") entry.moodScore = isNaN(valNum) ? 7 : valNum;
    else if (log.metric === "water_cups") entry.waterIntakeCups = isNaN(valNum) ? 0 : valNum;
  });

  const wellnessHistory = Object.values(entriesMap) as WellnessEntry[];

  // Fetch songs & versions
  const { data: dbSongs } = await supabase!.from("songs").select("*").eq("user_id", userId);
  const { data: dbVersions } = await supabase!.from("song_versions").select("*").eq("user_id", userId);

  // Fetch budgets
  const { data: budget } = await supabase!.from("budgets").select("*").eq("user_id", userId).maybeSingle();
  const { data: budgetCategories } = await supabase!.from("budget_categories").select("*").eq("user_id", userId);
  const { data: transactions } = await supabase!.from("transactions").select("*").eq("user_id", userId);

  // Fetch chat history
  const { data: chatMessages } = await supabase!.from("chat_messages").select("*").eq("user_id", userId).order("created_at");

  // Fetch bucket list
  const { data: dbBucket } = await supabase!.from("bucket_list").select("*").eq("user_id", userId).order("created_at");

  // Map Courses & Assignments
  const mappedCourses: UniversityCourse[] = (courses || []).map(c => {
    const courseTasks = (assignments || [])
      .filter(a => a.course_id === c.id)
      .map(a => ({
        id: a.id,
        title: a.title,
        dueDate: a.due_date ? a.due_date.split("T")[0] : "",
        completed: a.completed || false,
        weight: Number(a.weight || 0)
      }));
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      professor: c.professor,
      credits: c.credits || 15,
      gradeGoal: c.grade_goal || "A",
      tasks: courseTasks
    };
  });

  // Map Career Milestones
  const mappedMilestones: CareerMilestone[] = (careerProjects || []).map(p => ({
    id: p.id,
    title: p.title,
    category: (p.difficulty || "skill") as any,
    completed: p.status === "completed",
    details: p.description
  }));

  // Map Songs
  const mappedSongs: SongDraft[] = (dbSongs || []).map(s => {
    const latestVersion = (dbVersions || []).find(v => v.song_id === s.id);
    return {
      id: s.id,
      title: s.title,
      status: s.status as any,
      lyrics: latestVersion?.lyrics || "",
      key: s.key,
      tempo: s.tempo,
      chords: s.chords,
      tags: s.tags || [],
      createdAt: s.created_at ? s.created_at.split("T")[0] : new Date().toISOString().split("T")[0]
    };
  });

  // Map Budget
  const mappedCategories: BudgetCategory[] = (budgetCategories || []).map(cat => {
    const spentTransaction = (transactions || []).find(t => t.category_id === cat.id);
    return {
      id: cat.id,
      name: cat.name,
      budgeted: Number(cat.budgeted_amount || 0),
      spent: Number(spentTransaction?.amount || 0)
    };
  });

  // Map Chat
  const mappedChat: ChatMessage[] = (chatMessages || []).map((m) => ({
    id: m.id,
    sender: m.sender === "assistant" ? "saisha_ai" : "user",
    text: m.text,
    timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }));

  // Map Bucket List
  const mappedBucket = (dbBucket || []).map(b => ({
    id: b.id,
    title: b.title,
    completed: b.completed || false,
    location: b.description || ""
  }));

  const state: SaishaOSState = {
    user: {
      name: profile?.name || "",
      currentFocus: profile?.current_focus || "",
      university: widgetSettings.university || "",
      degree: widgetSettings.degree || "",
      yearOfStudy: widgetSettings.year_of_study || ""
    },
    rituals: (rituals || []).map(r => ({
      id: r.id,
      name: r.name,
      timeOfDay: r.time_of_day as any,
      completed: r.completed || false,
      category: r.category as any
    })),
    courses: mappedCourses,
    careerMilestones: mappedMilestones,
    wellnessHistory,
    songs: mappedSongs,
    budget: {
      savingsGoal: Number(budget?.savings_goal || 0),
      currentSavings: Number(budget?.current_savings || 0),
      categories: mappedCategories
    },
    chatHistory: mappedChat.length > 0 ? mappedChat : [
      {
        id: "init-0",
        sender: "saisha_ai",
        text: `Systems online. Welcome to Saisha OS, ${profile?.name || "Creator"}. How can I support your focus today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ],
    lastSaved: new Date().toISOString()
  };

  return { state, bucketList: mappedBucket };
}

/**
 * Individual sync functions to persist specific parts of the state in real-time.
 */

export async function syncProfile(userId: string, name: string, currentFocus: string) {
  if (!supabase) return;
  await supabase.from("profiles").upsert({
    id: userId,
    name,
    current_focus: currentFocus,
    updated_at: new Date().toISOString()
  });
}

export async function syncRituals(userId: string, rituals: Ritual[]) {
  if (!supabase) return;
  const dbRituals = rituals.map(r => ({
    id: toUUID(r.id),
    user_id: userId,
    name: r.name,
    time_of_day: r.timeOfDay,
    completed: r.completed,
    category: r.category,
    updated_at: new Date().toISOString()
  }));
  if (dbRituals.length > 0) {
    await supabase.from("rituals").upsert(dbRituals);
  }
}

export async function syncCourses(userId: string, courses: UniversityCourse[]) {
  if (!supabase) {
    console.log("[syncCourses] Supabase client is not initialized.");
    return;
  }

  console.log("[syncCourses] Started sync process. userId:", userId, "courses count:", courses.length);

  // 1. Delete courses that are no longer present
  const currentCourseIds = courses.map(c => toUUID(c.id));
  let deleteCoursesResult;
  if (currentCourseIds.length > 0) {
    console.log("[syncCourses] Attempting to delete obsolete courses. Retaining:", currentCourseIds);
    deleteCoursesResult = await supabase.from("courses").delete().eq("user_id", userId).not("id", "in", `(${currentCourseIds.join(",")})`);
  } else {
    console.log("[syncCourses] Attempting to delete all courses for user (no courses in state).");
    deleteCoursesResult = await supabase.from("courses").delete().eq("user_id", userId);
  }
  console.log("[syncCourses] Delete courses result:", {
    error: deleteCoursesResult.error,
    status: deleteCoursesResult.status,
    statusText: deleteCoursesResult.statusText
  });

  // 2. Delete assignments that are no longer present
  const currentAssignmentIds = courses.flatMap(c => c.tasks.map(t => toUUID(t.id)));
  let deleteAssignmentsResult;
  if (currentAssignmentIds.length > 0) {
    console.log("[syncCourses] Attempting to delete obsolete assignments. Retaining:", currentAssignmentIds);
    deleteAssignmentsResult = await supabase.from("assignments").delete().eq("user_id", userId).not("id", "in", `(${currentAssignmentIds.join(",")})`);
  } else {
    console.log("[syncCourses] Attempting to delete all assignments for user.");
    deleteAssignmentsResult = await supabase.from("assignments").delete().eq("user_id", userId);
  }
  console.log("[syncCourses] Delete assignments result:", {
    error: deleteAssignmentsResult.error,
    status: deleteAssignmentsResult.status,
    statusText: deleteAssignmentsResult.statusText
  });

  // 3. Upsert courses
  const dbCourses = courses.map(c => ({
    id: toUUID(c.id),
    user_id: userId,
    code: c.code,
    name: c.name,
    professor: c.professor || "TBA",
    credits: c.credits,
    grade_goal: c.gradeGoal,
    updated_at: new Date().toISOString()
  }));
  if (dbCourses.length > 0) {
    console.log("[syncCourses] Attempting to upsert/insert courses:", dbCourses);
    const upsertCoursesResult = await supabase.from("courses").upsert(dbCourses);
    console.log("[syncCourses] Upsert/insert courses result:", {
      error: upsertCoursesResult.error,
      status: upsertCoursesResult.status,
      statusText: upsertCoursesResult.statusText
    });
  } else {
    console.log("[syncCourses] No courses to upsert.");
  }

  // 4. Upsert assignments
  const dbAssignments: any[] = [];
  courses.forEach(c => {
    c.tasks.forEach(t => {
      dbAssignments.push({
        id: toUUID(t.id),
        user_id: userId,
        course_id: toUUID(c.id),
        title: t.title,
        due_date: new Date(t.dueDate).toISOString(),
        weight: t.weight,
        completed: t.completed,
        updated_at: new Date().toISOString()
      });
    });
  });
  if (dbAssignments.length > 0) {
    console.log("[syncCourses] Attempting to upsert/insert assignments:", dbAssignments);
    const upsertAssignmentsResult = await supabase.from("assignments").upsert(dbAssignments);
    console.log("[syncCourses] Upsert/insert assignments result:", {
      error: upsertAssignmentsResult.error,
      status: upsertAssignmentsResult.status,
      statusText: upsertAssignmentsResult.statusText
    });
  } else {
    console.log("[syncCourses] No assignments to upsert.");
  }
}

export async function syncCareerMilestones(userId: string, milestones: CareerMilestone[]) {
  if (!supabase) return;

  // 1. Delete ones no longer present
  const currentIds = milestones.map(m => toUUID(m.id));
  if (currentIds.length > 0) {
    await supabase.from("career_projects").delete().eq("user_id", userId).not("id", "in", `(${currentIds.join(",")})`);
  } else {
    await supabase.from("career_projects").delete().eq("user_id", userId);
  }

  // 2. Upsert
  const dbProjects = milestones.map(m => ({
    id: toUUID(m.id),
    user_id: userId,
    title: m.title,
    description: m.details || "",
    status: m.completed ? "completed" : "backlog",
    difficulty: m.category,
    updated_at: new Date().toISOString()
  }));
  if (dbProjects.length > 0) {
    await supabase.from("career_projects").upsert(dbProjects);
  }
}

export async function syncWellnessHistory(userId: string, history: WellnessEntry[]) {
  if (!supabase) return;

  const dbJournals: any[] = [];
  const dbLogs: any[] = [];

  history.forEach(entry => {
    const entryDate = entry.date;
    dbJournals.push({
      id: toUUID("journal-" + entryDate),
      user_id: userId,
      title: "Daily Sanctuary Journal",
      prompt: entry.journalPrompt,
      content: entry.journalText || "",
      category: "reflection",
      mood_score: entry.moodScore,
      entry_date: entryDate,
      updated_at: new Date().toISOString()
    });

    const metrics = {
      hair_oiled: entry.hairRecovery.oiled ? "true" : "false",
      hair_dermarolled: entry.hairRecovery.dermarolled ? "true" : "false",
      hair_serum_applied: entry.hairRecovery.serumApplied ? "true" : "false",
      hair_massage_done: entry.hairRecovery.massageDone ? "true" : "false",
      skin_morning_done: entry.skinRoutine.morningDone ? "true" : "false",
      skin_night_done: entry.skinRoutine.nightDone ? "true" : "false",
      mood_score: entry.moodScore.toString(),
      water_cups: entry.waterIntakeCups.toString()
    };

    Object.entries(metrics).forEach(([metricName, value]) => {
      dbLogs.push({
        id: toUUID("health-" + entryDate + "-" + metricName),
        user_id: userId,
        metric: metricName,
        value: value,
        unit: metricName.endsWith("_done") || metricName.startsWith("hair_") ? "boolean" : metricName === "mood_score" ? "score" : "cups",
        source: "manual",
        logged_at: `${entryDate}T12:00:00Z`,
        updated_at: new Date().toISOString()
      });
    });
  });

  if (dbJournals.length > 0) {
    await supabase.from("journal_entries").upsert(dbJournals);
  }
  if (dbLogs.length > 0) {
    await supabase.from("health_logs").upsert(dbLogs);
  }
}

export async function syncSongs(userId: string, songs: SongDraft[]) {
  if (!supabase) return;

  // 1. Delete ones no longer present
  const currentIds = songs.map(s => toUUID(s.id));
  if (currentIds.length > 0) {
    await supabase.from("songs").delete().eq("user_id", userId).not("id", "in", `(${currentIds.join(",")})`);
  } else {
    await supabase.from("songs").delete().eq("user_id", userId);
  }

  // 2. Upsert songs
  const dbSongs = songs.map(s => ({
    id: toUUID(s.id),
    user_id: userId,
    title: s.title,
    status: s.status,
    key: s.key || "",
    tempo: s.tempo || "",
    chords: s.chords || "",
    tags: s.tags || [],
    updated_at: new Date().toISOString()
  }));
  if (dbSongs.length > 0) {
    await supabase.from("songs").upsert(dbSongs);
  }

  // 3. Upsert versions (lyrics)
  const dbVersions = songs.map(s => ({
    id: toUUID("version-" + s.id),
    user_id: userId,
    song_id: toUUID(s.id),
    version_number: 1,
    lyrics: s.lyrics || "",
    updated_at: new Date().toISOString()
  }));
  if (dbVersions.length > 0) {
    await supabase.from("song_versions").upsert(dbVersions);
  }
}

export async function syncBudget(userId: string, savingsGoal: number, currentSavings: number, categories: BudgetCategory[]) {
  if (!supabase) return;
  const budgetId = toUUID("default-budget");

  // 1. Delete categories no longer present
  const currentCatIds = categories.map(cat => toUUID(cat.id));
  if (currentCatIds.length > 0) {
    await supabase.from("budget_categories").delete().eq("user_id", userId).not("id", "in", `(${currentCatIds.join(",")})`);
  } else {
    await supabase.from("budget_categories").delete().eq("user_id", userId);
  }

  // 2. Upsert main budget tracker
  await supabase.from("budgets").upsert({
    id: budgetId,
    user_id: userId,
    name: "Default Budget",
    savings_goal: savingsGoal,
    current_savings: currentSavings,
    updated_at: new Date().toISOString()
  });

  // 3. Upsert categories
  const dbCategories = categories.map(cat => ({
    id: toUUID(cat.id),
    user_id: userId,
    budget_id: budgetId,
    name: cat.name,
    budgeted_amount: cat.budgeted,
    updated_at: new Date().toISOString()
  }));
  if (dbCategories.length > 0) {
    await supabase.from("budget_categories").upsert(dbCategories);
  }

  // 4. Upsert transactions
  const dbTransactions = categories.map(cat => ({
    id: toUUID("transaction-" + cat.id),
    user_id: userId,
    category_id: toUUID(cat.id),
    amount: cat.spent,
    description: "Aggregated spent tracker",
    updated_at: new Date().toISOString()
  }));
  if (dbTransactions.length > 0) {
    await supabase.from("transactions").upsert(dbTransactions);
  }
}

export async function syncBucketList(userId: string, items: any[]) {
  if (!supabase) return;

  // 1. Delete items no longer present
  const currentIds = items.map(item => toUUID(item.id));
  if (currentIds.length > 0) {
    await supabase.from("bucket_list").delete().eq("user_id", userId).not("id", "in", `(${currentIds.join(",")})`);
  } else {
    await supabase.from("bucket_list").delete().eq("user_id", userId);
  }

  // 2. Upsert
  const dbItems = items.map(item => ({
    id: toUUID(item.id),
    user_id: userId,
    title: item.title,
    description: item.location || "Auckland",
    completed: item.completed,
    updated_at: new Date().toISOString()
  }));
  if (dbItems.length > 0) {
    await supabase.from("bucket_list").upsert(dbItems);
  }
}

export async function syncChatHistory(userId: string, chatHistory: ChatMessage[]) {
  if (!supabase) return;
  const sessionId = toUUID("default-chat-session");

  // Ensure session exists
  await supabase.from("chat_sessions").upsert({
    id: sessionId,
    user_id: userId,
    title: "Default Chat Session",
    ai_personality: "jarvis",
    updated_at: new Date().toISOString()
  });

  // Upsert messages
  const dbMessages = chatHistory.map((m, index) => ({
    id: toUUID(m.id || `msg-idx-${index}`),
    user_id: userId,
    session_id: sessionId,
    sender: m.sender === "user" ? "user" : "assistant",
    text: m.text,
    created_at: new Date().toISOString()
  }));
  if (dbMessages.length > 0) {
    await supabase.from("chat_messages").upsert(dbMessages);
  }
}
