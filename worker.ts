/**
 * Saisha OS production entry point (Cloudflare Workers with static assets).
 * This file is what runs in production AND in local dev (`npm run dev`,
 * via @cloudflare/vite-plugin).
 *
 * Routes:
 *   POST /api/planner/review, /api/planner/review/approve → Daily Planner AI review (worker/planner)
 *   POST /api/lumi/chat → Lumi chat (worker/lumi)
 *   POST /api/saisha/interact → LEGACY AI chat for the old dashboard (functions/api/saisha/interact.ts),
 *     kept until the old dashboard is removed
 *   GET  /api/health
 *   everything else → static assets from the Vite build, with SPA fallback to index.html
 *     (assets.not_found_handling = "single-page-application"), so deep links such as
 *     /planner/deep load the app directly.
 */
import { onRequestPost } from "./functions/api/saisha/interact";
import { handlePlannerApi } from "./worker/planner/api";
import { makePlannerDeps, PlannerEnv } from "./worker/planner/deps";
import { handleLumiApi } from "./worker/lumi/api";
import { makeLumiDeps } from "./worker/lumi/deps";

interface Env extends PlannerEnv {
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

    // Daily Planner API (auth-checked, Gemini evening review)
    if (url.pathname.startsWith("/api/planner/")) {
      const auth = request.headers.get("Authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      return handlePlannerApi(request, url.pathname, makePlannerDeps(env, token));
    }

    // Lumi chat (auth-checked; suggests tasks, never writes them)
    if (url.pathname.startsWith("/api/lumi/")) {
      const auth = request.headers.get("Authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      return handleLumiApi(request, url.pathname, makeLumiDeps(env, token));
    }

    // LEGACY: old dashboard chat (replaced by /api/lumi/chat)
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

    // Unknown API paths should be a JSON 404, not the SPA's index.html
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
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
