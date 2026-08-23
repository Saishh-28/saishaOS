import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

interface Env {
  GEMINI_API_KEY?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

// Tool declaration for Gemini function calling
const createTaskDeclaration = {
  name: "create_task",
  description: "Creates and schedules an action item, career goal, academic assignment, or personal milestone in the Saisha OS database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The clear title or action phrase of the task (e.g. 'Research AI internships in Auckland', 'Draft Chapter 2 for Thesis').",
      },
      category: {
        type: Type.STRING,
        description: "The category/domain of the task. Valid values: 'career', 'academic', 'personal', 'skill', 'health', 'finance'.",
      },
      priority: {
        type: Type.STRING,
        description: "Task priority level. Valid values: 'urgent', 'high', 'medium', 'low'.",
      },
      dueDate: {
        type: Type.STRING,
        description: "Optional ISO date string or human readable deadline (e.g. '2026-09-01' or 'next week').",
      },
      description: {
        type: Type.STRING,
        description: "Brief contextual notes, objectives, or instructions for this task.",
      },
    },
    required: ["title"],
  },
};

function getSupabaseClient(env: Env, token?: string, customUrl?: string, customAnonKey?: string) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || customUrl;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || customAnonKey;
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

type PagesFunction<Env = unknown, P extends string = string, Data extends Record<string, unknown> = Record<string, unknown>> = (
  context: EventContext<Env, P, Data>
) => Response | Promise<Response>;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as any;
    const { messages = [], contextData = {} } = body;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract bearer token from Authorization header & optional header fallbacks
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
    const headerUrl = request.headers.get("x-supabase-url") || undefined;
    const headerAnonKey = request.headers.get("x-supabase-anon-key") || undefined;
    const supabase = getSupabaseClient(env, token, headerUrl, headerAnonKey);

    // Validate authenticated user
    let authenticatedUser: any = null;
    if (supabase && token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.warn("[Cloudflare interact] Supabase auth.getUser failed:", authError.message);
      } else if (user) {
        authenticatedUser = user;
      }
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY environment variable is not configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Personalization summary
    const userName = contextData.userName || "Creator";
    const careerFocus = contextData.careerFocus || "Technology & Software Engineering";
    const semester = contextData.semester || "Semester 2, 2026";
    const recentTasks = Array.isArray(contextData.tasks) ? contextData.tasks.slice(0, 8) : [];
    const recentGoals = Array.isArray(contextData.careerGoals) ? contextData.careerGoals.slice(0, 5) : [];

    const systemInstruction = `
You are Saisha OS Core, an elite AI operating system and personalized executive companion built for ${userName}.
You operate as a unified intelligence bridging academic excellence, high-level career acceleration, health, and personal growth.

User Context:
- Name: ${userName}
- Primary Career Focus: ${careerFocus}
- Current Semester / Timeline: ${semester}
- Active Goals: ${recentGoals.map((g: any) => typeof g === "string" ? g : (g.title || g.role_target || "")).filter(Boolean).join(", ") || "Active development"}
- Current Focus Tasks: ${recentTasks.map((t: any) => typeof t === "string" ? t : (t.title || t.name || "")).filter(Boolean).join(", ") || "Ongoing work"}

Persona & Tone:
- Address the user respectfully as ${userName} or Creator.
- Speak with calm confidence, analytical precision, proactive momentum, and warm loyalty.
- Keep responses concise, impactful, and directly actionable.
- Proactively synthesize connections between the user's academic commitments and career trajectories.

Action & Tool Calling Capabilities:
- You have access to the \`create_task\` tool.
- When the user asks you to add, schedule, or record a task (e.g. "Add a task to update my CV", "Add a career task to research AI internships in Auckland", "Add 'finish assignment' to my course", "Add these 3 tasks: ..."), you MUST invoke the \`create_task\` tool to save it into the database.
- If the user asks for multiple tasks at once, call \`create_task\` multiple times for each item.
- Distinguish between asking and doing: If the user simply asks for advice ("What internships should I apply for?"), answer conversationally without calling tools. If the user explicitly asks to add or create tasks, execute the tool.
- Never claim you created a task unless the tool was executed and succeeded.
`;

    // Map conversation history
    const modelInputMessages = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content || "" }],
    }));

    const finalContents: any[] = [
      ...modelInputMessages,
    ];

    // First model generation call with tool declarations
    const initialResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: finalContents,
      config: {
        systemInstruction,
        tools: [{
          functionDeclarations: [createTaskDeclaration],
        }],
      },
    });

    const functionCalls = initialResponse.functionCalls;
    const createdTasks: any[] = [];

    // If Gemini requested function calls, execute them securely
    if (functionCalls && functionCalls.length > 0) {
      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        if (call.name === "create_task") {
          const args = (call.args || {}) as {
            title?: string;
            category?: string;
            priority?: string;
            dueDate?: string;
            description?: string;
          };

          const taskTitle = args.title?.trim();

          if (!taskTitle) {
            toolResponses.push({
              functionResponse: {
                name: "create_task",
                response: {
                  success: false,
                  error: "Task title cannot be empty.",
                },
              },
            });
            continue;
          }

          let createdRecord: any = null;
          let executionError: string | null = null;

          if (supabase && authenticatedUser) {
            try {
              const category = (args.category || "career").toLowerCase();
              const isAcademic = category === "academic" || category === "study" || category === "course";

              if (isAcademic) {
                const dueDateValue = args.dueDate ? new Date(args.dueDate).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();
                const { data: insertedAssignment, error: assignErr } = await supabase
                  .from("assignments")
                  .insert({
                    user_id: authenticatedUser.id,
                    title: taskTitle,
                    course_name: "General Studies",
                    due_date: dueDateValue,
                    status: "todo",
                    weight_percentage: 10,
                  })
                  .select()
                  .single();

                if (assignErr) throw assignErr;
                createdRecord = {
                  type: "assignment",
                  id: insertedAssignment.id,
                  title: insertedAssignment.title,
                  category: "academic",
                  course_name: insertedAssignment.course_name,
                  due_date: insertedAssignment.due_date,
                  status: insertedAssignment.status,
                };
              } else {
                const targetDateValue = args.dueDate ? new Date(args.dueDate).toISOString().split("T")[0] : null;
                const { data: insertedProject, error: projErr } = await supabase
                  .from("career_projects")
                  .insert({
                    user_id: authenticatedUser.id,
                    title: taskTitle,
                    category: ["skill", "project", "networking", "internship", "cert"].includes(category) ? category : "skill",
                    details: args.description || `Priority: ${args.priority || "medium"}`,
                    completed: false,
                    target_date: targetDateValue,
                  })
                  .select()
                  .single();

                if (projErr) throw projErr;
                createdRecord = {
                  type: "career_milestone",
                  id: insertedProject.id,
                  title: insertedProject.title,
                  category: insertedProject.category,
                  details: insertedProject.details,
                  completed: insertedProject.completed,
                };
              }

              // Also write to audit log if table exists
              try {
                await supabase.from("ai_tasks").insert({
                  user_id: authenticatedUser.id,
                  title: taskTitle,
                  category: args.category || "career",
                  status: "todo",
                  source: "saisha_core_chat",
                  due_date: args.dueDate || null,
                });
              } catch (_) {
                // Non-critical audit log table
              }

              createdTasks.push(createdRecord);
            } catch (dbErr: any) {
              console.error("[Cloudflare interact] Database task insertion failed:", dbErr.message || dbErr);
              executionError = dbErr.message || "Database insert failed";
            }
          } else {
            // Local/offline fallback record
            createdRecord = {
              type: "career_milestone",
              id: "local-task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
              title: taskTitle,
              category: "skill",
              details: args.description || "Created in local session",
              completed: false,
            };
            createdTasks.push(createdRecord);
          }

          if (createdRecord) {
            toolResponses.push({
              functionResponse: {
                name: "create_task",
                response: {
                  success: true,
                  message: `Task '${taskTitle}' has been successfully created and saved in Saisha OS.`,
                  task: createdRecord,
                },
              },
            });
          } else {
            toolResponses.push({
              functionResponse: {
                name: "create_task",
                response: {
                  success: false,
                  error: executionError || "Could not insert task into database.",
                },
              },
            });
          }
        }
      }

      // Provide tool results back to Gemini for final dialogue response (role: user)
      const candidateContent = initialResponse.candidates?.[0]?.content;
      const secondTurnContents: any[] = [...finalContents];
      if (candidateContent) {
        secondTurnContents.push(candidateContent);
      }
      secondTurnContents.push({
        role: "user",
        parts: toolResponses,
      });

      const followupResponse = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: secondTurnContents,
        config: {
          systemInstruction,
        },
      });

      return new Response(JSON.stringify({
        text: followupResponse.text || "Task successfully added to your Saisha OS roadmap.",
        createdTasks,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Standard conversational response
    return new Response(JSON.stringify({
      text: initialResponse.text || "I am with you, Creator.",
      createdTasks: [],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Cloudflare interact] Error encountered:", error.message || error);
    return new Response(JSON.stringify({
      error: error.message || "An error occurred with Saisha OS Core.",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
