/** Real Supabase + Gemini implementations of PlannerDeps for the Worker. */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import { AI_MAX_PER_BLOCK, Block, HABITS, WATER_METRIC } from "../../src/planner/plan";
import { addDays, DayLists, PlanTask } from "../../src/planner/logic";
import { HttpError, PlannerDeps, ReviewData, SaveRequest } from "./api";

export interface PlannerEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const DEFAULT_MODEL = "gemini-3.6-flash";

function check<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}

export function makePlannerDeps(env: PlannerEnv, token: string | null): PlannerDeps {
  // Supabase settings come only from the Worker's own config, never from request headers.
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  let sb: SupabaseClient | null = null;
  const client = () => {
    if (!url || !key) throw new HttpError(503, "The server isn't configured for Supabase (SUPABASE_URL / SUPABASE_ANON_KEY).");
    // Queries run as the signed-in user, so Row Level Security applies to everything.
    sb ??= createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    });
    return sb;
  };

  return {
    now: () => new Date(),

    async verifyUser(t) {
      const { data, error } = await client().auth.getUser(t);
      return error || !data.user ? null : data.user.id;
    },

    async loadData(userId, date): Promise<ReviewData> {
      const s = client();
      const healthMetrics = [WATER_METRIC, ...HABITS.flatMap((h) => (h.store.kind === "health" ? [h.store.metric] : []))];
      const [tasks, done, items, habits, health, tomorrow] = await Promise.all([
        s.from("plan_tasks").select("id,block,text,phase_start,sort_order,is_custom,is_ai").eq("user_id", userId),
        s.from("task_completions").select("task_id,done_date").eq("user_id", userId),
        s.from("daily_list_items").select("block,task_id,carried_over,position").eq("user_id", userId).eq("date", date).order("position"),
        s.from("habit_logs").select("habit_key,done").eq("user_id", userId).eq("date", date),
        s.from("health_logs").select("metric,value").eq("user_id", userId).in("metric", healthMetrics).eq("logged_at", `${date}T12:00:00Z`),
        s.from("daily_list_items").select("task_id", { count: "exact", head: true }).eq("user_id", userId).eq("date", addDays(date, 1)),
      ]);
      for (const [r, w] of [[tasks, "plan_tasks"], [done, "task_completions"], [items, "daily_list_items"], [habits, "habit_logs"], [health, "health_logs"], [tomorrow, "tomorrow"]] as const)
        check(r, `Loading ${w}`);

      const lists: DayLists = { deep: [], study: [] };
      for (const r of items.data ?? []) lists[r.block as Block].push({ taskId: r.task_id, carriedOver: r.carried_over });
      const habitMap: Record<string, boolean> = {};
      for (const r of habits.data ?? []) habitMap[r.habit_key] = r.done;
      let water = 0;
      for (const r of health.data ?? []) {
        if (r.metric === WATER_METRIC) water = Number(r.value) || 0;
        const h = HABITS.find((x) => x.store.kind === "health" && x.store.metric === r.metric);
        if (h) habitMap[h.key] = r.value === "true";
      }
      return {
        tasks: (tasks.data ?? []).map(
          (r: any): PlanTask => ({
            id: r.id,
            block: r.block,
            text: r.text,
            phaseStart: r.phase_start,
            sortOrder: r.sort_order,
            isCustom: r.is_custom,
            isAi: r.is_ai,
          }),
        ),
        done: new Map((done.data ?? []).map((r: any) => [r.task_id, r.done_date])),
        lists,
        habits: habitMap,
        water,
        tomorrowHasList: (tomorrow.count ?? 0) > 0,
      };
    },

    async askGemini(system, prompt, allowed) {
      if (!env.GEMINI_API_KEY) throw new HttpError(503, "The server has no GEMINI_API_KEY. Locally, add it to .dev.vars; in production, run `npx wrangler secret put GEMINI_API_KEY`.");
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      // Structured output. The ID lists are also constrained to the exact IDs in the
      // report (enum), so the model can't even produce an unknown ID; the server
      // still validates everything afterwards.
      const idList = (ids: string[]) =>
        ids.length
          ? { type: Type.ARRAY, items: { type: Type.STRING, enum: ids }, maxItems: String(AI_MAX_PER_BLOCK) }
          : { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "0" };
      const res = await ai.models.generateContent({
        model: env.GEMINI_MODEL || DEFAULT_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deep: idList(allowed.deep),
              study: idList(allowed.study),
              new: {
                type: Type.ARRAY,
                maxItems: "4",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    block: { type: Type.STRING, enum: ["deep", "study"] },
                    text: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ["block", "text", "reason"],
                },
              },
              note: { type: Type.STRING },
            },
            required: ["deep", "study", "new", "note"],
            propertyOrdering: ["deep", "study", "new", "note"],
          },
        },
      });
      const text = res.text;
      if (!text) throw new HttpError(502, "Gemini returned an empty answer. Try again.");
      return text;
    },

    async saveTomorrow(userId, req: SaveRequest) {
      const s = client();
      check(
        await s.from("planner_days").upsert({ user_id: userId, date: req.date, from_ai: true }, { onConflict: "user_id,date" }),
        "Saving day",
      );
      if (req.newTasks.length)
        check(
          await s.from("plan_tasks").insert(
            req.newTasks.map((t) => ({
              user_id: userId,
              id: t.id,
              block: t.block,
              text: t.text,
              phase_start: t.phaseStart,
              sort_order: t.sortOrder,
              is_custom: true,
              is_ai: true,
            })),
          ),
          "Saving new tasks",
        );
      // Replace tomorrow's lists with the approved ones.
      check(await s.from("daily_list_items").delete().eq("user_id", userId).eq("date", req.date), "Clearing tomorrow");
      const rows = (["deep", "study"] as Block[]).flatMap((b) =>
        req.lists[b].map((it, position) => ({
          user_id: userId,
          date: req.date,
          block: b,
          task_id: it.taskId,
          carried_over: it.carriedOver,
          position,
        })),
      );
      if (rows.length) check(await s.from("daily_list_items").insert(rows), "Saving tomorrow's lists");
    },
  };
}
