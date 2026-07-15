export type LogLevel = "info" | "warn" | "error" | "fatal";

export interface DelokConfig {
  apiKey: string;
  environment: string;
}

export interface TrackPayload {
  event: string;
  level: LogLevel;

  message?: string;
  payload?: Record<string, unknown>;
}
