import { describe, expect, it, vi } from "vitest";
import { HttpError } from "./api";
import { withGeminiRetry } from "./deps";

const apiError = (status: number) => Object.assign(new Error(`status ${status}`), { status });
const noWait = async () => {};

describe("withGeminiRetry", () => {
  it("retries when Gemini is busy, then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(apiError(503)).mockRejectedValueOnce(apiError(429)).mockResolvedValue("ok");
    await expect(withGeminiRetry(fn, [1, 1], noWait)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives a clear message when Gemini stays busy", async () => {
    const fn = vi.fn().mockRejectedValue(apiError(503));
    const err = (await withGeminiRetry(fn, [1, 1], noWait).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toMatch(/busy/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a bad key", async () => {
    const fn = vi.fn().mockRejectedValue(apiError(400));
    const err = (await withGeminiRetry(fn, [1, 1], noWait).catch((e: unknown) => e)) as HttpError;
    expect(err.message).toMatch(/GEMINI_API_KEY/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("treats a timeout as temporary, and stops retrying when the time budget is used up", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "AbortError" });
    const fn = vi.fn().mockRejectedValue(timeout);
    let clock = 0;
    const err = (await withGeminiRetry(fn, [1000, 1000], async (ms) => void (clock += ms), 30_000, () => (clock += 12_000)).catch(
      (e: unknown) => e,
    )) as HttpError;
    expect(err.status).toBe(504);
    expect(fn.mock.calls.length).toBeLessThan(3);
  });
});
