import { describe, it, expect } from "vitest";
import { Delok } from "../src/Delok";
import { DelokConfigurationError } from "../src/errors/DelokConfigurationError";
import { DEFAULT_ENDPOINT } from "../src/constants";

describe("Delok configuration", () => {
  it("creates instance with valid config", () => {
    expect(() => new Delok({ apiKey: "key_123", environment: "development" })).not.toThrow();
    expect(() => new Delok({ apiKey: "key_123", environment: "staging" })).not.toThrow();
    expect(() => new Delok({ apiKey: "key_123", environment: "production" })).not.toThrow();
  });

  it("throws when apiKey is empty", () => {
    expect(() => new Delok({ apiKey: "", environment: "production" })).toThrow(DelokConfigurationError);
  });

  it("throws when apiKey is whitespace-only", () => {
    expect(() => new Delok({ apiKey: "   ", environment: "production" })).toThrow(DelokConfigurationError);
  });

  it("throws when environment is unsupported", () => {
    // bypass TS via any
    expect(() => new Delok({ apiKey: "k", environment: "invalid" as any })).toThrow(DelokConfigurationError);
  });

  it("defaults endpoint to DEFAULT_ENDPOINT when not provided", async () => {
    const delok = new Delok({ apiKey: "k", environment: "development" });
    // access private field via any for test
    expect((delok as any).endpoint).toBe(DEFAULT_ENDPOINT);
  });

  it("uses custom endpoint when provided", () => {
    const custom = "https://ingest.example.com/api/ingestion";
    const delok = new Delok({ apiKey: "k", environment: "production", endpoint: custom });
    expect((delok as any).endpoint).toBe(custom);
  });

  it("throws when endpoint is empty string", () => {
    expect(() => new Delok({ apiKey: "k", environment: "production", endpoint: "" })).toThrow(DelokConfigurationError);
  });

  it("throws when endpoint is whitespace-only", () => {
    expect(() => new Delok({ apiKey: "k", environment: "production", endpoint: "   " })).toThrow(DelokConfigurationError);
  });
});
