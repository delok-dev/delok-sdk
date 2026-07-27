// /src/types.ts

import { SUPPORTED_ENVIRONMENTS, SUPPORTED_LOG_LEVELS } from "./constants";

export type Environment = (typeof SUPPORTED_ENVIRONMENTS)[number];

export type LogLevel = (typeof SUPPORTED_LOG_LEVELS)[number];

/**
 * Configuration required to initialize the Delok SDK.
 */
export interface DelokConfig {
  apiKey: string;
  environment: Environment;
}

/**
 * Structured log payload sent to the Delok backend.
 *
 * Event normalization and validation are performed server-side.
 */
export interface TrackPayload {
  event: string;
  level: LogLevel;

  message?: string;
  payload?: Record<string, unknown>;
}
