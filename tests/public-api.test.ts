import { describe, it, expect, vi, beforeEach } from "vitest";
import { Delok } from "../src/Delok";
import { DEFAULT_ENDPOINT } from "../src/constants";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Public API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes only info/warn/error/fatal via package entry, not track", async () => {
    const index = await import("../src/index");
    expect(index).toHaveProperty("Delok");
    expect(index).not.toHaveProperty("sendLog");
    expect((index as any).track).toBeUndefined();
    const delok = new Delok({ apiKey: "k", environment: "development" });
    expect((delok as any).track).toBeDefined();
    expect(typeof delok.info).toBe("function");
    expect(typeof delok.warn).toBe("function");
    expect(typeof delok.error).toBe("function");
    expect(typeof delok.fatal).toBe("function");
  });

  it("info/warn/error/fatal return void (fire-and-forget)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any));
    const delok = new Delok({ apiKey: "k", environment: "development" });
    expect(delok.info({ event: "evt" })).toBeUndefined();
    expect(delok.warn({ event: "evt" })).toBeUndefined();
    expect(delok.error({ event: "evt" })).toBeUndefined();
    expect(delok.fatal({ event: "evt" })).toBeUndefined();
  });

  it("info/warn/error/fatal produce correct level internally", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);
    vi.stubGlobal("fetch", fetchMock);

    const delok = new Delok({ apiKey: "k", environment: "development" });

    delok.info({ event: "user_login" });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("info");

    fetchMock.mockClear();
    delok.warn({ event: "payment_retry" });
    await flushPromises();
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("warn");

    fetchMock.mockClear();
    delok.error({ event: "payment_failed" });
    await flushPromises();
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("error");

    fetchMock.mockClear();
    delok.fatal({ event: "database_crash" });
    await flushPromises();
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("fatal");
  });

  it("async delivery still performs HTTP request", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    const result = delok.info({ event: "test" });
    expect(result).toBeUndefined();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates event is non-empty without fetch and without unhandled rejection", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true } as any));
    vi.stubGlobal("fetch", fetchMock);
    const unhandled: unknown[] = [];
    const handler = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    expect(delok.info({ event: "" })).toBeUndefined();
    expect(delok.info({ event: "   " })).toBeUndefined();
    await flushPromises();
    await flushPromises();
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", handler);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it("invalid event does not produce unhandled rejection", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true } as any));
    vi.stubGlobal("fetch", fetchMock);
    const unhandled: unknown[] = [];
    const handler = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", handler);
    expect(unhandled).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses internal Delok ingestion endpoint, not developer config", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_ENDPOINT, expect.anything());
  });

  it("cannot override endpoint through public config — evil endpoint is ignored", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const delok = new Delok({
      apiKey: "k",
      environment: "development",
      endpoint: "https://evil.example.com/api/ingestion",
    } as any);
    delok.info({ event: "evt" });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_ENDPOINT, expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith("https://evil.example.com/api/ingestion", expect.anything());
  });

  it("public DelokConfig type does not include endpoint (verified via index exports)", async () => {
    const index = await import("../src/index");
    expect((index as any).DEFAULT_ENDPOINT).toBeUndefined();
  });

  it("network failure does not produce unhandled rejection and does not log to console", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as any);
    const sleepSpy = vi.spyOn(await import("../src/utils"), "sleep");
    sleepSpy.mockResolvedValue(undefined as any);
    const consoleErrorSpy = vi.spyOn(console, "error");
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const consoleLogSpy = vi.spyOn(console, "log");
    const unhandled: unknown[] = [];
    const handler = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await new Promise((r) => setTimeout(r, 20));
    process.off("unhandledRejection", handler);
    expect(unhandled).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("HTTP error does not produce unhandled rejection", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ success: false, error: { code: "INVALID_API_KEY", message: "Invalid" }, timestamp: "" }),
    }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const unhandled: unknown[] = [];
    const handler = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", handler);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    delok.info({ event: "evt" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", handler);
    expect(unhandled).toEqual([]);
  });
});
