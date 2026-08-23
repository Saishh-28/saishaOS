import { onRequestPost } from "./functions/api/saisha/interact";

interface Env {
  GEMINI_API_KEY?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route API requests to the Gemini + Supabase backend
    if (url.pathname === "/api/saisha/interact") {
      if (request.method === "POST") {
        const context: any = {
          request,
          env,
          waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
          next: () => (env.ASSETS ? env.ASSETS.fetch(request) : fetch(request)),
          params: {},
          data: {},
          functionPath: url.pathname,
        };
        return onRequestPost(context);
      }
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Health check endpoint
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Serve static frontend assets from dist (with automatic SPA index.html fallback)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
