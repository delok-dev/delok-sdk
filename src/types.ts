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

/**
 * Common metadata attached to all Delok SDK errors.
 *
 * These values provide additional debugging context
 * without exposing internal implementation details.
 */
export interface DelokErrorMetadata {
  /**
   * Total number of request attempts performed,
   * including the initial request.
   */
  attempts?: number;
  /**
   * Total time spent (in milliseconds) before
   * the SDK ultimately failed.
   */
  duration?: number;
}

/**
 * Additional metadata specific to HTTP errors.
 */
export interface DelokHttpErrorMetadata extends DelokErrorMetadata {
  /**
   * HTTP status code returned by the Delok backend.
   */
  status: number;
  error: DelokApiError;
}

/**
 * Business error returned by the Delok backend.
 *
 * The error code is intended for programmatic handling,
 * while the message provides a human-readable description.
 */
export interface DelokApiError {
  code: string;
  message: string;
}

/**
 * Standard error response returned by the Delok backend.
 *
 * This mirrors the backend API contract and is used
 * internally by the SDK to extract error information.
 */
export interface DelokApiErrorResponse {
  success: false;
  error: DelokApiError;
  timestamp: string;
}

export interface RequestContext {
  attempt: number;
  startedAt: number;
}
