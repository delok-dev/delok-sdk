import { describe, it, expect, vi, beforeEach } from "vitest";
import { Delok } from "../src/Delok";
import { DelokError } from "../src/errors/DelokError";
import { DEFAULT_ENDPOINT } from "../src/constants";

describe("Public API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes only info/warn/error/fatal via package entry, not track", async () => {
    // Dynamic import of index to verify re-exports
    const index = await import("../src/index");
    expect(index).toHaveProperty("Delok");
    expect(index).not.toHaveProperty("sendLog");
    expect((index as any).track).toBeUndefined();
    // Delok instance should not expose track as public
    const delok = new Delok({ apiKey: "k", environment: "development" });
    expect((delok as any).track).toBeDefined(); // private exists as function but not intended public
    // but prototype should not document track as public; check that public methods exist
    expect(typeof delok.info).toBe("function");
    expect(typeof delok.warn).toBe("function");
    expect(typeof delok.error).toBe("function");
    expect(typeof delok.fatal).toBe("function");
  });

  it("info/warn/error/fatal produce correct level internally", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);
    vi.stubGlobal("fetch", fetchMock);

    const delok = new Delok({ apiKey: "k", environment: "development" });

    await delok.info({ event: "user_login" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("info");

    fetchMock.mockClear();
    await delok.warn({ event: "payment_retry" });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("warn");

    fetchMock.mockClear();
    await delok.error({ event: "payment_failed" });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("error");

    fetchMock.mockClear();
    await delok.fatal({ event: "database_crash" });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).level).toBe("fatal");
  });

  it("returns Promise<void> that resolves to undefined on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any));
    const delok = new Delok({ apiKey: "k", environment: "development" });
    const result = await delok.info({ event: "evt" });
    expect(result).toBeUndefined();
  });

  it("validates event is non-empty (fails fast, no fetch)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true } as any));
    vi.stubGlobal("fetch", fetchMock);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await expect(delok.info({ event: "" })).rejects.toThrow(DelokError);
    await expect(delok.info({ event: "   " })).rejects.toThrow(DelokError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses internal Delok ingestion endpoint, not developer config", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const delok = new Delok({ apiKey: "k", environment: "development" });
    await delok.info({ event: "evt" });
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
    await delok.info({ event: "evt" });
    // Should still use internal endpoint, not evil
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_ENDPOINT, expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith("https://evil.example.com/api/ingestion", expect.anything());
  });

  it("public DelokConfig type does not include endpoint (verified via index exports)", async () => {
    const index = await import("../src/index");
    // DEFAULT_ENDPOINT is internal and not exported via public index
    expect((index as any).DEFAULT_ENDPOINT).toBeUndefined();
  });
});
