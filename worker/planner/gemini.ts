/**
 * Gemini call policy for the evening review:
 *   1. primary model (GEMINI_MODEL), retried with backoff on busy / rate-limit / timeout;
 *   2. if it is still busy or timing out, ONE attempt with a lighter model
 *      (GEMINI_FALLBACK_MODEL) before telling the user Gemini is busy.
 * Each attempt has its own timeout and the whole thing has a time budget, so
 * the phone never spins for minutes.
 */
import { HttpError } from "./api";

export const DEFAULT_MODEL = "gemini-3.6-flash";
export const DEFAULT_FALLBACK_MODEL = "gemini-flash-lite-latest";

export const ATTEMPT_TIMEOUT_MS = 20_000;
export const PRIMARY_BUDGET_MS = 35_000;

export type GeminiFailureKind = "busy" | "timeout" | "rate_limit" | "rejected" | "not_found" | "network";

export class GeminiFailure extends HttpError {
  constructor(public kind: GeminiFailureKind, status: number, message: string) {
    super(status, message);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HTTP status from a @google/genai ApiError (or undefined). */
function geminiStatus(e: unknown): number | undefined {
  const s = (e as { status?: unknown })?.status;
  return typeof s === "number" ? s : undefined;
}

function classify(e: unknown): GeminiFailureKind {
  const status = geminiStatus(e);
  if (status === undefined && /abort|timeout|timed out/i.test(String((e as Error)?.name) + String((e as Error)?.message))) return "timeout";
  if (status === 429) return "rate_limit";
  if (status !== undefined && status >= 500) return "busy";
  if (status === 400 || status === 401 || status === 403) return "rejected";
  if (status === 404) return "not_found";
  return "network";
}

function failure(kind: GeminiFailureKind): GeminiFailure {
  switch (kind) {
    case "timeout":
      return new GeminiFailure(kind, 504, "Gemini took too long to answer. Try again in a minute.");
    case "rate_limit":
      return new GeminiFailure(kind, 503, "Gemini's rate limit was hit. Wait a minute and try again.");
    case "busy":
      return new GeminiFailure(kind, 503, "Gemini is busy right now. Try again in a minute.");
    case "rejected":
      return new GeminiFailure(kind, 502, "Gemini rejected the request. Check that GEMINI_API_KEY is valid and the model name is right.");
    case "not_found":
      return new GeminiFailure(kind, 502, "Gemini model not found. Check GEMINI_MODEL / GEMINI_FALLBACK_MODEL.");
    default:
      return new GeminiFailure(kind, 502, "Couldn't reach Gemini. Try again.");
  }
}

const TRANSIENT: GeminiFailureKind[] = ["busy", "timeout", "rate_limit"];

/** Retry transient failures with backoff within a time budget, then throw a GeminiFailure. */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  delays = [1500, 4000],
  wait: (ms: number) => Promise<void> = sleep,
  budgetMs = PRIMARY_BUDGET_MS,
  now = () => Date.now(),
): Promise<T> {
  const started = now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const kind = classify(e);
      const timeLeft = budgetMs - (now() - started);
      if (TRANSIENT.includes(kind) && attempt < delays.length && timeLeft > delays[attempt] + ATTEMPT_TIMEOUT_MS / 2) {
        await wait(delays[attempt]);
        continue;
      }
      console.error("[gemini]", kind, geminiStatus(e), e instanceof Error ? e.message.slice(0, 300) : e);
      throw failure(kind);
    }
  }
}

/**
 * Run `call(model)` on the primary model with retries; if it ends busy or timed
 * out, try the fallback model once. Returns the text and which model answered.
 */
export async function generateWithFallback(
  call: (model: string) => Promise<string>,
  models: { primary: string; fallback: string },
  opts: { delays?: number[]; wait?: (ms: number) => Promise<void> } = {},
): Promise<{ text: string; model: string }> {
  try {
    return { text: await withGeminiRetry(() => call(models.primary), opts.delays, opts.wait), model: models.primary };
  } catch (e) {
    const canFallBack =
      e instanceof GeminiFailure && (e.kind === "busy" || e.kind === "timeout") && models.fallback && models.fallback !== models.primary;
    if (!canFallBack) throw e;
    console.warn(`[gemini] ${models.primary} ${e.kind}; trying fallback ${models.fallback}`);
    try {
      return { text: await withGeminiRetry(() => call(models.fallback), [], opts.wait), model: models.fallback };
    } catch {
      throw e; // report the primary model's failure ("busy" / "took too long")
    }
  }
}
