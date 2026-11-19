import { describe, expect, it, vi } from "vitest";
import { GeminiFailure, generateWithFallback, withGeminiRetry } from "./gemini";

const apiError = (status: number) => Object.assign(new Error(`status ${status}`), { status });
const timeout = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "AbortError" });
const noWait = async () => {};
const fail = async <T,>(p: Promise<T>) => (await p.catch((e: unknown) => e)) as GeminiFailure;

describe("withGeminiRetry", () => {
  it("retries when Gemini is busy, then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(apiError(503)).mockRejectedValueOnce(apiError(429)).mockResolvedValue("ok");
    await expect(withGeminiRetry(fn, [1, 1], noWait)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives a clear message when Gemini stays busy", async () => {
    const fn = vi.fn().mockRejectedValue(apiError(503));
    const err = await fail(withGeminiRetry(fn, [1, 1], noWait));
    expect(err).toBeInstanceOf(GeminiFailure);
    expect(err.kind).toBe("busy");
    expect(err.message).toMatch(/busy/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a bad key", async () => {
    const fn = vi.fn().mockRejectedValue(apiError(400));
    const err = await fail(withGeminiRetry(fn, [1, 1], noWait));
    expect(err.message).toMatch(/GEMINI_API_KEY/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("treats a timeout as temporary and stops retrying when the time budget is used up", async () => {
    const fn = vi.fn().mockRejectedValue(timeout());
    let clock = 0;
    const err = await fail(withGeminiRetry(fn, [1000, 1000], async (ms) => void (clock += ms), 30_000, () => (clock += 12_000)));
    expect(err.kind).toBe("timeout");
    expect(err.status).toBe(504);
    expect(fn.mock.calls.length).toBeLessThan(3);
  });
});

describe("generateWithFallback", () => {
  const models = { primary: "big-model", fallback: "lite-model" };

  it("uses the primary model when it works", async () => {
    const call = vi.fn(async (m: string) => `from ${m}`);
    await expect(generateWithFallback(call, models, { delays: [1], wait: noWait })).resolves.toEqual({ text: "from big-model", model: "big-model" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("tries the lighter model once after the primary stays busy", async () => {
    const call = vi.fn(async (m: string) => {
      if (m === "big-model") throw apiError(503);
      return "from lite";
    });
    await expect(generateWithFallback(call, models, { delays: [1, 1], wait: noWait })).resolves.toEqual({ text: "from lite", model: "lite-model" });
    expect(call.mock.calls.map((c) => c[0])).toEqual(["big-model", "big-model", "big-model", "lite-model"]);
  });

  it("falls back after a timeout too", async () => {
    const call = vi.fn(async (m: string) => {
      if (m === "big-model") throw timeout();
      return "ok";
    });
    expect((await generateWithFallback(call, models, { delays: [], wait: noWait })).model).toBe("lite-model");
  });

  it("shows 'busy' if the fallback fails too, and tries it only once", async () => {
    const call = vi.fn(async (_model: string): Promise<string> => {
      throw apiError(503);
    });
    const err = await fail(generateWithFallback(call, models, { delays: [1], wait: noWait }));
    expect(err.kind).toBe("busy");
    expect(call.mock.calls.filter((c) => c[0] === "lite-model")).toHaveLength(1);
  });

  it("does not fall back for a bad key, a rate limit, or when no fallback is configured", async () => {
    const bad = vi.fn(async () => {
      throw apiError(403);
    });
    expect((await fail(generateWithFallback(bad, models, { delays: [], wait: noWait }))).kind).toBe("rejected");
    expect(bad).toHaveBeenCalledTimes(1);

    const limited = vi.fn(async () => {
      throw apiError(429);
    });
    expect((await fail(generateWithFallback(limited, models, { delays: [], wait: noWait }))).kind).toBe("rate_limit");
    expect(limited).toHaveBeenCalledTimes(1);

    const busy = vi.fn(async () => {
      throw apiError(503);
    });
    await fail(generateWithFallback(busy, { primary: "big-model", fallback: "" }, { delays: [], wait: noWait }));
    expect(busy).toHaveBeenCalledTimes(1);
  });
});
