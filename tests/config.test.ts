import { describe, it, expect } from "vitest";
import { Delok } from "../src/Delok";
import { DelokConfigurationError } from "../src/errors/DelokConfigurationError";

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

  it("does not expose endpoint in DelokConfig — extra endpoint property is ignored", () => {
    // Developer should not be able to configure endpoint through public API.
    // Passing endpoint via any should not create a private endpoint field nor affect construction.
    const delok = new Delok({ apiKey: "k", environment: "development", endpoint: "https://evil.com" } as any);
    expect((delok as any).endpoint).toBeUndefined();
    // Still constructs successfully — endpoint is not validated as config
    expect(delok).toBeInstanceOf(Delok);
  });

  it("Delok instance does not store endpoint as developer-controlled state", () => {
    const delok = new Delok({ apiKey: "k", environment: "development" });
    // endpoint is internal infrastructure, not developer config
    expect((delok as any).apiKey).toBe("k");
    expect((delok as any).environment).toBe("development");
    // No endpoint field should exist on instance
    expect("endpoint" in delok).toBe(false);
  });
});
