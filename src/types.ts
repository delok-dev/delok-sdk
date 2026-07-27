// /src/types.ts

export type LogLevel = "info" | "warn" | "error" | "fatal";
export type Environment = "development" | "staging" | "production " | "CI / CD";

export interface DelokConfig {
  apiKey: string;
  environment: Environment;
}

export interface TrackPayload {
  event: string;
  level: LogLevel;

  message?: string;
  payload?: Record<string, unknown>;
}
