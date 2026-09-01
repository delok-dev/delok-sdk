import { describe, it, expect, vi, beforeEach } from "vitest";
import { Delok } from "../src/Delok";
import * as utils from "../src/utils";

function mockFetchSequence(responses: Array<() => Promise<any>>) {
  let idx = 0;
  const fn = vi.fn(async (...args: any[]) => {
    const responder = responses[idx++] ?? responses[responses.length - 1];
    return responder();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Transport reliability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("performance", { now: vi.fn(() => Date.now()) } as any);
  });

  it("retries 500 then succeeds without unhandled rejection", async () => {
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
    const unhandled: unknown[] = [];
    const handler = (r: unknown) => unhandled.push(r);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    expect(delok.info({ event: "evt" })).toBeUndefined();
    await flush();
    process.off("unhandledRejection", handler);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(unhandled).toEqual([]);
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
    delok.info({ event: "evt" });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries network error and succeeds", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const fetchMock = mockFetchSequence([
      async () => { throw new TypeError("Failed to fetch"); },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("limits retries to 3 total attempts even when always failing (timeout)", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const abortErr = new Error("abort"); abortErr.name = "AbortError";
    const fetchMock = mockFetchSequence([async () => { throw abortErr; }]);
    const unhandled: unknown[] = [];
    const handler = (r: unknown) => unhandled.push(r);
    process.on("unhandledRejection", handler);
    const consoleSpy = vi.spyOn(console, "error");
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    process.off("unhandledRejection", handler);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(unhandled).toEqual([]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("limits retries for 502/503/504 to 3 attempts", async () => {
    for (const code of [502, 503, 504]) {
      vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
      const fetchMock = mockFetchSequence([
        async () => ({
          ok: false, status: code, statusText: "err",
          json: async () => ({ success: false, error: { code: "E", message: "m" }, timestamp: "" }),
        }),
      ]);
      const unhandled: unknown[] = [];
      const handler = (r: unknown) => unhandled.push(r);
      process.on("unhandledRejection", handler);
      const delok = new Delok({ apiKey: "k", environment: "development" });
      delok.info({ event: "evt" });
      await flush();
      process.off("unhandledRejection", handler);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(unhandled).toEqual([]);
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
      const unhandled: unknown[] = [];
      const handler = (r: unknown) => unhandled.push(r);
      process.on("unhandledRejection", handler);
      const delok = new Delok({ apiKey: "k", environment: "development" });
      delok.info({ event: "evt" });
      await flush();
      process.off("unhandledRejection", handler);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
      vi.restoreAllMocks();
      vi.stubGlobal("performance", { now: vi.fn(() => Date.now()) } as any);
    }
  });

  it("handles invalid JSON error response without unhandled rejection", async () => {
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
    const unhandled: unknown[] = [];
    const handler = (r: unknown) => unhandled.push(r);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    process.off("unhandledRejection", handler);
    expect(unhandled).toEqual([]);
  });

  it("handles network error with retry exhaustion without console pollution", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as any);
    const consoleErrorSpy = vi.spyOn(console, "error");
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const unhandled: unknown[] = [];
    const handler = (r: unknown) => unhandled.push(r);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    process.off("unhandledRejection", handler);
    expect(unhandled).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("handles unknown throwables without unhandled rejection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw "string thrown"; }) as any);
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const unhandled: unknown[] = [];
    const handler = (r: unknown) => unhandled.push(r);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    process.off("unhandledRejection", handler);
    expect(unhandled).toEqual([]);
  });

  it("exponential backoff delays are 500 then 1000", async () => {
    const sleepSpy = vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const fetchMock = mockFetchSequence([
      async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; },
      async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 500);
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 1000);
  });

  it("does not log retry to console", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const consoleSpy = vi.spyOn(console, "info");
    const consoleErrorSpy = vi.spyOn(console, "error");
    const fetchMock = mockFetchSequence([
      async () => { throw new TypeError("net"); },
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
    ]);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fire-and-forget returns void even when transport fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("net"); }) as any);
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    const result = delok.info({ event: "evt" });
    expect(result).toBeUndefined();
    await flush();
  });

  it("no console pollution on HTTP 500 retry exhaustion", async () => {
    vi.spyOn(utils, "sleep").mockResolvedValue(undefined as any);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ success: false, error: { code: "INTERNAL", message: "err" }, timestamp: "" }),
      })) as any,
    );
    const consoleErrorSpy = vi.spyOn(console, "error");
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const consoleLogSpy = vi.spyOn(console, "log");
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flush();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
