/** Real Supabase + Gemini implementations of LumiDeps for the Worker. */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import { HABITS, WATER_METRIC } from "../../src/planner/plan";
import { habitsOn } from "../../src/planner/logic";
import { sessionFor } from "../../src/planner/gym";
import { HttpError } from "../planner/api";
import { PlannerEnv } from "../planner/deps";
import { ATTEMPT_TIMEOUT_MS, DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, generateWithFallback } from "../planner/gemini";
import { ChatTurn, LumiContext, LumiDeps } from "./api";

function check<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}

export function makeLumiDeps(env: PlannerEnv, token: string | null): LumiDeps {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  let sb: SupabaseClient | null = null;
  const client = () => {
    if (!url || !key) throw new HttpError(503, "The server isn't configured for Supabase (SUPABASE_URL / SUPABASE_ANON_KEY).");
    // Every query runs as the signed-in user: Row Level Security applies.
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

    async loadHistory(userId) {
      const s = client();
      // Keep using the most recent session (the old chat history stays visible).
      const sessions = check(
        await s.from("chat_sessions").select("id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1),
        "Loading chat",
      );
      let sessionId = sessions.data?.[0]?.id as string | undefined;
      if (!sessionId) {
        const created = check(
          await s.from("chat_sessions").insert({ user_id: userId, title: "Lumi", ai_personality: "lumi" }).select("id").single(),
          "Starting chat",
        );
        sessionId = created.data!.id as string;
      }
      const msgs = check(
        await s.from("chat_messages").select("sender,text,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        "Loading messages",
      );
      const history: ChatTurn[] = (msgs.data ?? [])
        .reverse()
        .map((m: any): ChatTurn => ({ sender: m.sender === "user" ? "user" : "assistant", text: String(m.text ?? "") }))
        .filter((m) => m.text);
      return { sessionId, history };
    },

    async loadContext(userId, date) {
      const s = client();
      const [profile, settings, items, done, habits, health, courses] = await Promise.all([
        s.from("profiles").select("name,current_focus").eq("id", userId).maybeSingle(),
        s.from("settings").select("widget_settings").eq("user_id", userId).maybeSingle(),
        s.from("daily_list_items").select("block,task_id,position").eq("user_id", userId).eq("date", date).order("position"),
        s.from("task_completions").select("task_id").eq("user_id", userId),
        s.from("habit_logs").select("habit_key,done").eq("user_id", userId).eq("date", date),
        s.from("health_logs").select("metric,value").eq("user_id", userId).eq("logged_at", `${date}T12:00:00Z`),
        s.from("courses").select("code,name,term,final_grade").eq("user_id", userId),
      ]);
      const ids = (items.data ?? []).map((r: any) => r.task_id);
      const tasks = ids.length
        ? check(await s.from("plan_tasks").select("id,text").eq("user_id", userId).in("id", ids), "Loading tasks").data ?? []
        : [];
      const textOf = new Map(tasks.map((t: any) => [t.id, t.text]));
      const doneSet = new Set((done.data ?? []).map((r: any) => r.task_id));
      const habitMap: Record<string, boolean> = {};
      for (const r of habits.data ?? []) habitMap[r.habit_key] = r.done;
      let waterMl = 0;
      for (const r of health.data ?? []) {
        if (r.metric === WATER_METRIC) waterMl = Number(r.value) || 0;
        const h = HABITS.find((x) => x.store.kind === "health" && x.store.metric === r.metric);
        if (h) habitMap[h.key] = r.value === "true";
      }
      const block = (b: string) =>
        (items.data ?? []).filter((r: any) => r.block === b).map((r: any) => ({ text: String(textOf.get(r.task_id) ?? ""), done: doneSet.has(r.task_id) }));
      const hs = habitsOn(date);
      const gym = sessionFor(date);
      const ctx: LumiContext = {
        name: (profile.data?.name as string)?.split(" ")[0] || "friend",
        focus: (profile.data?.current_focus as string) ?? null,
        about: (settings.data?.widget_settings as Record<string, unknown>) ?? {},
        today: {
          date,
          deep: block("deep"),
          study: block("study"),
          habitsDone: hs.filter((h) => habitMap[h.key]).map((h) => h.label),
          habitsMissed: hs.filter((h) => !habitMap[h.key]).map((h) => h.label),
          waterMl,
          gym: `${gym.title}${habitMap.gym ? " (done)" : ""}`,
        },
        courses: (courses.data ?? []).map((c: any) => ({ code: c.code, name: c.name, term: c.term ?? null, finalGrade: c.final_grade ?? null })),
      };
      return ctx;
    },

    async saveMessage(userId, sessionId, turn) {
      const s = client();
      check(await s.from("chat_messages").insert({ user_id: userId, session_id: sessionId, sender: turn.sender, text: turn.text }), "Saving message");
      await s.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId);
    },

    async askGemini(system, contents) {
      if (!env.GEMINI_API_KEY) throw new HttpError(503, "The server has no GEMINI_API_KEY.");
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: ATTEMPT_TIMEOUT_MS } });
      const request = async (model: string) => {
        const res = await ai.models.generateContent({
          model,
          contents: contents.map((t) => ({ role: t.sender === "user" ? "user" : "model", parts: [{ text: t.text }] })),
          config: {
            systemInstruction: system,
            temperature: 0.6,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                tasks: {
                  type: Type.ARRAY,
                  maxItems: "2",
                  items: {
                    type: Type.OBJECT,
                    properties: { block: { type: Type.STRING, enum: ["deep", "study"] }, text: { type: Type.STRING } },
                    required: ["block", "text"],
                  },
                },
              },
              required: ["reply", "tasks"],
            },
          },
        });
        return res.text ?? "";
      };
      const fallback = (env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL).trim();
      return generateWithFallback(request, {
        primary: (env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
        fallback: fallback.toLowerCase() === "none" ? "" : fallback,
      });
    },
  };
}
