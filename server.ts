import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { FunctionDeclaration, GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini AI client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Please add it via the Settings > Secrets panel.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Helper to create an authenticated Supabase client using the request's JWT
function getSupabaseClient(token?: string, customUrl?: string, customAnonKey?: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || customUrl;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || customAnonKey;
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Gemini Tool Definition for creating tasks in Saisha OS
const createTaskTool: FunctionDeclaration = {
  name: "create_task",
  description: "Creates and saves a real, persistent task or milestone in the user's Saisha OS database. Use this whenever the user asks to add, create, or schedule a task, assignment, career milestone, or todo item. Can be called multiple times in one turn if the user requests multiple tasks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Clear and descriptive title of the task (e.g. 'Research AI internships in Auckland', 'Update CV', 'Finish STATS 782 assignment').",
      },
      description: {
        type: Type.STRING,
        description: "Optional details, sub-notes, or context for the task.",
      },
      category: {
        type: Type.STRING,
        description: "Category of the task: 'career', 'internship', 'skill', 'project', 'academic', or 'general'.",
      },
      course_code: {
        type: Type.STRING,
        description: "Optional course code (e.g. 'STATS 782', 'COMPSCI 760') if this task is an assignment for a specific course.",
      },
      due_date: {
        type: Type.STRING,
        description: "Optional due date in YYYY-MM-DD format. ONLY supply if explicitly specified or clearly stated by the user (e.g. tomorrow, Friday). Do NOT invent an arbitrary deadline.",
      },
      priority: {
        type: Type.STRING,
        description: "Optional priority level: 'low', 'medium', or 'high'.",
      },
      status: {
        type: Type.STRING,
        description: "Status of the task: 'todo', 'backlog', or 'in_progress'. Defaults to 'todo'.",
      },
    },
    required: ["title"],
  },
};

// AI Interaction Endpoint
app.post("/api/saisha/interact", async (req, res) => {
  try {
    const { messages, osState } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages array" });
    }

    // Extract bearer token from Authorization header & optional header fallbacks
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
    const headerUrl = req.headers["x-supabase-url"] as string | undefined;
    const headerAnonKey = req.headers["x-supabase-anon-key"] as string | undefined;
    const supabase = getSupabaseClient(token, headerUrl, headerAnonKey);

    console.log(`[POST /api/saisha/interact] Request received with ${messages.length} message(s). Auth header present: ${!!authHeader}`);

    // Validate authenticated user
    let authenticatedUser: any = null;
    if (supabase && token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.warn("[POST /api/saisha/interact] Supabase auth.getUser failed:", authError.message);
      } else if (user) {
        authenticatedUser = user;
        console.log(`[POST /api/saisha/interact] Authenticated user identified: ${user.id}`);
      }
    } else {
      console.log("[POST /api/saisha/interact] Running in local/unauthenticated mode.");
    }

    const ai = getGeminiClient();

    // Compile high-fidelity contextual background for Saisha OS AI
    const stateSummary = osState
      ? `
--- SAISHA OS DIGITAL STATE CONTEXT ---
User Profile: Studying Data Science at University of Auckland, NZ. Long-term dream: top-tier AI Engineer, Songwriter, Creator, Entrepreneur.
Struggles: routines, executive dysfunction, procrastination, overthinking, overwhelm.

Current Active Goals / Focus: "${osState.user?.currentFocus || "Developing Saisha OS"}"

Daily Rituals Checklist:
${(osState.rituals || []).map((r: any) => `- [${r.completed ? "x" : " "}] (${r.timeOfDay}) ${r.name} [${r.category}]`).join("\n")}

University of Auckland Courses & Tasks:
${(osState.courses || []).map((c: any) => `- Course ${c.code}: ${c.name} (Goal: ${c.gradeGoal}). Active Tasks:
  ${(c.tasks || []).map((t: any) => `  * [${t.completed ? "x" : " "}] ${t.title} (Weight: ${t.weight}%, Due: ${t.dueDate})`).join("\n  ")}`).join("\n")}

Career & Internship Milestones:
${(osState.careerMilestones || []).map((m: any) => `- [${m.completed ? "x" : " "}] (${m.category}) ${m.title} ${m.details ? `(${m.details})` : ""}`).join("\n")}

Wellness Tracker:
- Current Hair Recovery: ${JSON.stringify(osState.wellnessHistory?.[osState.wellnessHistory.length - 1]?.hairRecovery || {})}
- Current Skin Care: ${JSON.stringify(osState.wellnessHistory?.[osState.wellnessHistory.length - 1]?.skinRoutine || {})}
- Latest Mood Score: ${osState.wellnessHistory?.[osState.wellnessHistory.length - 1]?.moodScore || "Not rated today"}
- Latest Journal Draft: "${osState.wellnessHistory?.[osState.wellnessHistory.length - 1]?.journalText || ""}"

Creative Songwriting Sandbox:
${(osState.songs || []).map((s: any) => `- "${s.title}" (${s.status.toUpperCase()}) ${s.key ? `[Key: ${s.key}]` : ""} ${s.tempo ? `[Tempo: ${s.tempo} bpm]` : ""}.
  Lyrics Preview: "${s.lyrics ? s.lyrics.substring(0, 100) + "..." : "No lyrics yet"}"`).join("\n")}

Auckland Budget Tracker:
- Savings Goal: $${osState.budget?.savingsGoal || 0} (Current: $${osState.budget?.currentSavings || 0})
- Allocations: ${(osState.budget?.categories || []).map((cat: any) => `${cat.name}: Spent $${cat.spent}/$${cat.budgeted}`).join(", ")}
--------------------------------------
`
      : "No OS State available yet.";

    // Construct the structured prompt
    const systemInstruction = `
You are the intelligent, thoughtful core companion of Saisha OS. Your personality composition is strictly tuned to:
- 40% JARVIS: Deferential but exceptionally competent, brilliant, predictive, addresses her as "Saisha" or "Creator", anticipates needs.
- 25% Apple: Elegant, clean, minimalist, using thoughtful phrasing, absolute clarity, and zero corporate fluff.
- 20% Notion: Structurally helpful, breaks overwhelming plans into lightweight steps, provides gentle frameworking.
- 10% Studio Ghibli: Warm, organic, comforting, romanticizes small details (like rainy Auckland mornings, hot chamomile tea, typing in a cozy library).
- 5% Older Sibling: Caring, non-judgmental, keeps things light, teasing but fiercely supportive, helps her rise again if she broke a streak.

Action & Tool Calling Capabilities:
- You have access to the \`create_task\` tool.
- When the user asks you to add, schedule, or record a task (e.g. "Add a task to update my CV", "Add a career task to research AI internships in Auckland", "Add 'finish assignment' to my course", "Add these 3 tasks: ..."), you MUST invoke the \`create_task\` tool to save it into the database.
- If the user asks for multiple tasks at once, call \`create_task\` multiple times for each item.
- Distinguish between asking and doing: If the user simply asks for advice ("What internships should I apply for?"), answer conversationally without calling tools. If the user explicitly asks to add or create tasks, execute the tool.
- Never claim you created a task unless the tool was executed and succeeded.

Core Directives:
1. Always be incredibly kind and supportive. Never make Saisha feel guilty for losing a routine, procrastinating, or struggling with executive dysfunction.
2. Be proactive and contextual. You are provided with Saisha's full digital OS state (above). Use it to make highly personalized, specific observations without being intrusive.
3. Keep responses elegant, structured, and visually beautiful.
4. Encourage her songwriting and AI Engineering goals equally.
5. Speak with warmth.
`;

    // Map conversation messages to the format expected by generateContent
    const modelInputMessages = messages.map((m: any) => {
      return {
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      };
    });

    // Add state context as a system preamble / first message injection
    const finalContents: any[] = [
      {
        role: "user",
        parts: [{ text: `${stateSummary}\n\nInitiating dialogue with Saisha...` }],
      },
      ...modelInputMessages,
    ];

    console.log("[POST /api/saisha/interact] Dispatching prompt to Gemini (model: gemini-3.6-flash)...");

    // First model generation call with tool declarations
    const initialResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: finalContents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: [{ functionDeclarations: [createTaskTool] }],
      },
    });

    const functionCalls = initialResponse.functionCalls;
    const createdTasks: any[] = [];

    // If Gemini requested function calls, execute them securely
    if (functionCalls && functionCalls.length > 0) {
      console.log(`[POST /api/saisha/interact] Gemini emitted ${functionCalls.length} function call(s).`);
      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        if (call.name === "create_task") {
          const args = (call.args || {}) as {
            title: string;
            description?: string;
            category?: string;
            course_code?: string;
            due_date?: string;
            priority?: string;
            status?: string;
          };

          const taskTitle = args.title?.trim();
          console.log(`[POST /api/saisha/interact] Processing create_task: title="${taskTitle}", category="${args.category || ""}"`);

          if (!taskTitle) {
            toolResponses.push({
              functionResponse: {
                name: call.name,
                response: { success: false, error: "Task title cannot be empty." },
              },
            });
            continue;
          }

          let createdRecord: any = null;
          let executionError: string | null = null;

          if (authenticatedUser && supabase) {
            try {
              const userId = authenticatedUser.id;
              const categoryLower = (args.category || "").toLowerCase();
              const courseCodeUpper = (args.course_code || "").trim().toUpperCase();

              // Check if task targets a specific course
              let targetCourseId: string | null = null;
              if (courseCodeUpper || categoryLower === "academic") {
                const { data: userCourses } = await supabase
                  .from("courses")
                  .select("id, code, name")
                  .eq("user_id", userId);

                if (userCourses && userCourses.length > 0) {
                  if (courseCodeUpper) {
                    const match = userCourses.find(c => c.code.toUpperCase().includes(courseCodeUpper) || courseCodeUpper.includes(c.code.toUpperCase()));
                    if (match) targetCourseId = match.id;
                  }
                  if (!targetCourseId && categoryLower === "academic") {
                    targetCourseId = userCourses[0].id;
                  }
                }
              }

              if (targetCourseId) {
                // Insert into assignments table
                const dueISO = args.due_date ? new Date(args.due_date).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();
                const { data: assignmentData, error: assignmentErr } = await supabase
                  .from("assignments")
                  .insert({
                    user_id: userId,
                    course_id: targetCourseId,
                    title: taskTitle,
                    due_date: dueISO,
                    weight: 10,
                    completed: false,
                  })
                  .select()
                  .single();

                if (assignmentErr) throw assignmentErr;

                createdRecord = {
                  type: "assignment",
                  id: assignmentData.id,
                  course_id: targetCourseId,
                  title: taskTitle,
                  dueDate: args.due_date || dueISO.split("T")[0],
                  weight: 10,
                  completed: false,
                };
              } else {
                // Insert into career_projects table as milestone/task
                const milestoneCategory = ["skill", "project", "internship"].includes(categoryLower)
                  ? categoryLower
                  : categoryLower.includes("intern") ? "internship"
                  : categoryLower.includes("project") ? "project"
                  : "skill";

                const { data: projectData, error: projectErr } = await supabase
                  .from("career_projects")
                  .insert({
                    user_id: userId,
                    title: taskTitle,
                    description: args.description || "",
                    difficulty: milestoneCategory,
                    status: "backlog",
                  })
                  .select()
                  .single();

                if (projectErr) throw projectErr;

                createdRecord = {
                  type: "career_milestone",
                  id: projectData.id,
                  title: taskTitle,
                  category: milestoneCategory,
                  details: args.description || "",
                  completed: false,
                };
              }

              // Also record in ai_tasks table for tracking
              await supabase.from("ai_tasks").insert({
                user_id: userId,
                title: taskTitle,
                description: args.description || "",
                status: "accepted",
              });

              createdTasks.push(createdRecord);
              console.log(`[POST /api/saisha/interact] Saved ${createdRecord.type} (id=${createdRecord.id}) to Supabase for user.`);
            } catch (dbErr: any) {
              console.error("[POST /api/saisha/interact] Database task insertion failed:", dbErr.message || dbErr);
              executionError = dbErr.message || "Database insert failed";
            }
          } else {
            // Local/offline fallback record so the UI updates even without remote Supabase
            createdRecord = {
              type: "career_milestone",
              id: "local-task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
              title: taskTitle,
              category: "skill",
              details: args.description || "Created in local session",
              completed: false,
            };
            createdTasks.push(createdRecord);
            console.log(`[POST /api/saisha/interact] Created local task record (id=${createdRecord.id}).`);
          }

          if (createdRecord) {
            toolResponses.push({
              functionResponse: {
                name: call.name,
                response: {
                  success: true,
                  taskId: createdRecord.id,
                  title: createdRecord.title,
                  type: createdRecord.type,
                  message: `Task '${createdRecord.title}' successfully recorded in Saisha OS database.`,
                },
              },
            });
          } else {
            toolResponses.push({
              functionResponse: {
                name: call.name,
                response: {
                  success: false,
                  error: executionError || "Could not write task to database.",
                },
              },
            });
          }
        }
      }

      // Provide tool results back to Gemini for the final confirmation message
      // NOTE: In Google GenAI (@google/genai), the tool response turn MUST have role: "user"
      const candidateContent = initialResponse.candidates?.[0]?.content;
      const secondTurnContents: any[] = [...finalContents];
      if (candidateContent) {
        secondTurnContents.push(candidateContent);
      }
      secondTurnContents.push({
        role: "user",
        parts: toolResponses,
      });

      console.log("[POST /api/saisha/interact] Sending tool execution results to Gemini for final dialogue response...");
      const followupResponse = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: secondTurnContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      console.log("[POST /api/saisha/interact] Second-turn response received from Gemini.");

      return res.json({
        text: followupResponse.text || "Task successfully added to your Saisha OS roadmap.",
        createdTasks,
      });
    }

    // Standard conversational response without function calls
    res.json({
      text: initialResponse.text || "I am with you, Creator.",
      createdTasks: [],
    });
  } catch (error: any) {
    console.error("[POST /api/saisha/interact] Error encountered:", error.message || error);
    res.status(500).json({ error: error.message || "An error occurred with Saisha OS Core." });
  }
});

// Configure Vite or Static Assets based on Environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Saisha OS running seamlessly at http://localhost:${PORT}`);
  });
}

startServer();
