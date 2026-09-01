import { describe, it, expect, vi, beforeEach } from "vitest";
import { Delok } from "../src/Delok";
import { DelokHttpError } from "../src/errors/DelokHttpError";
import { DelokNetworkError } from "../src/errors/DelokNetworkError";
import { DelokTimeoutError } from "../src/errors/DelokTimeoutError";
import { DelokError } from "../src/errors/DelokError";
import * as utils from "../src/utils";

// Helper to create a fetch mock that returns sequential responses
function mockFetchSequence(responses: Array<() => Promise<any>>) {
  let idx = 0;
  const fn = vi.fn(async (...args: any[]) => {
    const responder = responses[idx++] ?? responses[responses.length - 1];
    return responder();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("Transport reliability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("performance", { now: vi.fn(() => Date.now()) } as any);
  });

  it("retries 500 then succeeds", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const fetchMock = mockFetchSequence([
      async () => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ success: false, error: { code: "INTERNAL", message: "err" }, timestamp: "" }),
      }),
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await expect(delok.info({ event: "evt" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries timeout (AbortError) and succeeds", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const abortErr = new Error("abort");
    abortErr.name = "AbortError";
    const fetchMock = mockFetchSequence([
      async () => { throw abortErr; },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await expect(delok.info({ event: "evt" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries network error and succeeds", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const fetchMock = mockFetchSequence([
      async () => { throw new TypeError("Failed to fetch"); },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await expect(delok.info({ event: "evt" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("limits retries to 3 total attempts then throws DelokTimeoutError", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const abortErr = new Error("abort"); abortErr.name = "AbortError";
    const fetchMock = mockFetchSequence([async () => { throw abortErr; }]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await expect(delok.info({ event: "evt" })).rejects.toBeInstanceOf(DelokTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("limits retries for 502/503/504", async () => {
    for (const code of [502, 503, 504]) {
      vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
      const fetchMock = mockFetchSequence([
        async () => ({
          ok: false, status: code, statusText: "err",
          json: async () => ({ success: false, error: { code: "E", message: "m" }, timestamp: "" }),
        }),
      ]);
      const delok = new Delok({ apiKey: "k", environment: "development" });
      await expect(delok.info({ event: "evt" })).rejects.toBeInstanceOf(DelokHttpError);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
      vi.stubGlobal("performance", { now: vi.fn(() => Date.now()) } as any);
    }
  });

  it("does not retry non-retryable 400/401/403/404", async () => {
    for (const code of [400, 401, 403, 404]) {
      const fetchMock = mockFetchSequence([
        async () => ({
          ok: false, status: code, statusText: "err",
          json: async () => ({ success: false, error: { code: "E", message: "m" }, timestamp: "" }),
        }),
      ]);
      const delok = new Delok({ apiKey: "k", environment: "development" });
      await expect(delok.info({ event: "evt" })).rejects.toBeInstanceOf(DelokHttpError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
      vi.stubGlobal("performance", { now: vi.fn(() => Date.now()) } as any);
    }
  });

  it("preserves status on valid JSON error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ success: false, error: { code: "INVALID_API_KEY", message: "Invalid API key" }, timestamp: "" }),
      })) as any,
    );
    const delok = new Delok({ apiKey: "k", environment: "development" });
    try { await delok.info({ event: "evt" }); expect.fail(); }
    catch (e: any) {
      expect(e).toBeInstanceOf(DelokHttpError);
      expect(e.metadata.status).toBe(401);
      expect(e.metadata.error.code).toBe("INVALID_API_KEY");
    }
  });

  it("preserves status on invalid JSON error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      })) as any,
    );
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    try { await delok.info({ event: "evt" }); expect.fail(); }
    catch (e: any) {
      expect(e).toBeInstanceOf(DelokHttpError);
      expect(e.metadata.status).toBe(502);
      expect(e.metadata.error.code).toBe("UNKNOWN_ERROR");
    }
  });

  it("timeout error message uses ms unit and preserves attempts/duration", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; }) as any);
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    try { await delok.info({ event: "evt" }); expect.fail(); }
    catch (e: any) {
      expect(e).toBeInstanceOf(DelokTimeoutError);
      expect(e.message).toContain("5000ms");
      expect(e.message).not.toContain("5000 seconds");
      expect(e.metadata.attempts).toBe(3);
      expect(typeof e.metadata.duration).toBe("number");
    }
  });

  it("network error preserves attempts and is retryable", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as any);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    try { await delok.info({ event: "evt" }); expect.fail(); }
    catch (e: any) {
      expect(e).toBeInstanceOf(DelokNetworkError);
      expect(e.metadata.attempts).toBe(3);
    }
  });

  it("unknown transport error (non-Error throwable) becomes DelokError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw "string thrown"; }) as any);
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await expect(delok.info({ event: "evt" })).rejects.toBeInstanceOf(DelokError);
    // ensure not swallowed and is DelokError subclass or base
    try { await delok.info({ event: "evt" }); } catch (e: any) { expect(e).toBeInstanceOf(DelokError); }
  });

  it("exponential backoff delays are 500 then 1000", async () => {
    const sleepSpy = vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const fetchMock = mockFetchSequence([
      async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; },
      async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await delok.info({ event: "evt" });
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 500);
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 1000);
  });

  it("does not log retry to console.info", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const consoleSpy = vi.spyOn(console, "info");
    const fetchMock = mockFetchSequence([
      async () => { throw new TypeError("net"); },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await delok.info({ event: "evt" });
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
