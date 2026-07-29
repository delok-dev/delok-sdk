// /src/types.ts

import {
  RETRYABLE_STATUS_CODES,
  SUPPORTED_ENVIRONMENTS,
  SUPPORTED_LOG_LEVELS,
} from "./constants";

/**
 * Allowed runtime environments supported by the SDK.
 */
export type Environment = (typeof SUPPORTED_ENVIRONMENTS)[number];

/**
 * Fixed log levels exposed by the SDK.
 */
export type LogLevel = (typeof SUPPORTED_LOG_LEVELS)[number];

/**
 * HTTP status codes eligible for automatic retry.
 */
export type RetryableStatus = (typeof RETRYABLE_STATUS_CODES)[number];

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

/**
 * Internal payload passed from the SDK entry point
 * to the transport layer.
 */
export interface SendLogPayload {
  apiKey: string;
  environment: Environment;
  data: TrackPayload;
}
