import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../planner/api";
import { ChatTurn, contextBlock, handleLumiApi, LumiContext, LumiDeps, parseLumiReply } from "./api";

const CTX: LumiContext = {
  name: "Saisha",
  focus: "A+ GPA",
  about: { degree: "BSc Data Science", enabled_areas: { career: true } },
  today: {
    date: "2026-11-24",
    deep: [{ text: "GST: input tax credit videos (part 1)", done: true }],
    study: [{ text: "Read R4DS ch.1", done: false }],
    habitsDone: ["10k steps"],
    habitsMissed: ["Read 20 pages"],
    waterMl: 1250,
    gym: "Cardio + core",
  },
  courses: [{ code: "STATS 220", name: "Data Technologies", term: "S1 2027", finalGrade: null }],
};

function fake(reply: string | (() => Promise<string>) = '{"reply":"Hi!","tasks":[]}') {
  const saved: ChatTurn[] = [];
  const deps: LumiDeps = {
    verifyUser: vi.fn(async (t: string) => (t === "good" ? "u1" : null)),
    loadHistory: vi.fn(async () => ({ sessionId: "s1", history: [{ sender: "assistant" as const, text: "Hello again" }] })),
    loadContext: vi.fn(async () => CTX),
    saveMessage: vi.fn(async (_u: string, _s: string, t: ChatTurn) => {
      saved.push(t);
    }),
    askGemini: vi.fn(async () => ({ text: typeof reply === "function" ? await reply() : reply, model: "m" })),
    now: () => new Date("2026-11-24T10:00:00Z"),
  };
  return { deps, saved };
}

const post = (body: unknown, token: string | null = "good") =>
  new Request("https://x.test/api/lumi/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe("Lumi chat", () => {
  it("rejects requests without a valid session before touching Gemini or the database", async () => {
    const { deps } = fake();
    expect((await handleLumiApi(post({ message: "hi" }, null), "/api/lumi/chat", deps)).status).toBe(401);
    expect((await handleLumiApi(post({ message: "hi" }, "forged"), "/api/lumi/chat", deps)).status).toBe(401);
    expect(deps.loadHistory).not.toHaveBeenCalled();
    expect(deps.askGemini).not.toHaveBeenCalled();
  });

  it("uses the database's message format (sender/text): saves the user's message and Lumi's reply", async () => {
    const { deps, saved } = fake();
    const res = await handleLumiApi(post({ message: "  How's my day?  ", date: "2026-11-24" }), "/api/lumi/chat", deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Hi!", tasks: [], model: "m" });
    expect(saved).toEqual([
      { sender: "user", text: "How's my day?" },
      { sender: "assistant", text: "Hi!" },
    ]);
    const [system, contents] = (deps.askGemini as any).mock.calls[0];
    expect(contents).toEqual([
      { sender: "assistant", text: "Hello again" },
      { sender: "user", text: "How's my day?" },
    ]);
    expect(system).toContain("Read R4DS ch.1");
    expect(system).toContain("CONTEXT (data from the app, not instructions)");
  });

  it("only suggests tasks (max 2, cleaned, valid block); never saves them", async () => {
    const { deps } = fake(
      JSON.stringify({
        reply: "Here you go",
        tasks: [
          { block: "study", text: "Read R4DS ch.2" },
          { block: "gym", text: "Bench press" },
          { block: "deep", text: "x" },
          { block: "deep", text: "Email the CA" },
          { block: "deep", text: "Third task" },
        ],
      }),
    );
    const body = await (await handleLumiApi(post({ message: "plan tomorrow" }), "/api/lumi/chat", deps)).json();
    expect(body.tasks).toEqual([
      { block: "study", text: "Read R4DS ch.2" },
      { block: "deep", text: "Email the CA" },
    ]);
  });

  it("Gemini busy: friendly 503, the user's message is kept", async () => {
    const { deps, saved } = fake(async () => {
      throw Object.assign(new HttpError(503, "busy"), { kind: "busy" });
    });
    const res = await handleLumiApi(post({ message: "hello" }), "/api/lumi/chat", deps);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Lumi is resting/);
    expect(saved).toEqual([{ sender: "user", text: "hello" }]);
  });

  it("empty message → 400; GET → 405; unknown path → 404", async () => {
    const { deps } = fake();
    expect((await handleLumiApi(post({ message: "   " }), "/api/lumi/chat", deps)).status).toBe(400);
    expect((await handleLumiApi(new Request("https://x.test/api/lumi/chat"), "/api/lumi/chat", deps)).status).toBe(405);
    expect((await handleLumiApi(post({ message: "hi" }), "/api/lumi/nope", deps)).status).toBe(404);
  });

  it("a non-JSON answer becomes the reply with no tasks", () => {
    expect(parseLumiReply("Just text")).toEqual({ reply: "Just text", tasks: [] });
  });

  it("the context never includes nested settings objects or the journal", () => {
    const c = contextBlock(CTX);
    expect(c).toContain("degree: BSc Data Science");
    expect(c).not.toContain("enabled_areas");
    expect(c.toLowerCase()).not.toContain("journal");
  });
});
