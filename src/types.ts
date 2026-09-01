// /src/types.ts

import {
  RETRYABLE_STATUS_CODES,
  SUPPORTED_ENVIRONMENTS,
  SUPPORTED_LOG_LEVELS,
} from "./constants";

/**
 * Runtime environment associated with every log event.
 *
 * The value is supplied when creating the client and is included
 * with each request sent to the Delok ingestion API.
 *
 * Supported values:
 * - `"development"` - local development or debugging
 * - `"staging"` - pre-production / QA environment
 * - `"production"` - live production environment
 *
 * Any other value causes the {@link Delok} constructor to throw
 * a {@link DelokConfigurationError}.
 */
export type Environment = (typeof SUPPORTED_ENVIRONMENTS)[number];

/**
 * Severity level assigned to a log event.
 *
 * The SDK exposes four fixed levels. Custom levels are not supported.
 * Use the corresponding client method (`info`, `warn`, `error`, `fatal`)
 * instead of setting this field manually.
 */
export type LogLevel = (typeof SUPPORTED_LOG_LEVELS)[number];

/**
 * HTTP status codes that the SDK treats as transient failures.
 *
 * @internal - not part of the public API; used by the transport layer
 * to decide whether a failed request should be retried.
 */
export type RetryableStatus = (typeof RETRYABLE_STATUS_CODES)[number];

/**
 * Configuration required to create a {@link Delok} client.
 *
 * @example
 * ```ts
 * const delok = new Delok({
 *   apiKey: process.env.DELOK_API_KEY!,
 *   environment: "production",
 * });
 * ```
 */
export interface DelokConfig {
  /**
   * API key used to authenticate log ingestion requests with Delok.
   *
   * Required. Must be a non-empty string. Whitespace-only values are
   * rejected. Obtain this value from the Delok dashboard.
   *
   * @example "delok_sk_abc123"
   */
  apiKey: string;

  /**
   * Runtime environment associated with the logs.
   *
   * Required. Must be one of the supported values:
   * `"development"`, `"staging"`, or `"production"`.
   *
   * The value is validated during construction; an invalid value
   * throws a {@link DelokConfigurationError}.
   *
   * @example "production"
   */
  environment: Environment;
}

/**
 * Structured log payload sent to the Delok backend.
 *
 * This is the shape accepted by the public logging methods
 * (`info`, `warn`, `error`, `fatal`). The `level` field is set
 * automatically by the method you call, so callers omit it
 * (`Omit<TrackPayload, "level">`).
 *
 * Event normalization and additional validation are performed server-side.
 *
 * @example
 * ```ts
 * delok.info({
 *   event: "user_login",
 *   message: "User successfully logged in",
 *   payload: { userId: "123" },
 * });
 * ```
 */
export interface TrackPayload {
  /**
   * Stable name identifying the event being recorded.
   *
   * Required. Use a consistent, descriptive identifier such as
   * `user_login`, `payment_failed`, or `database_crash`.
   * The value is sent as-is to the Delok backend.
   *
   * @example "user_login"
   */
  event: string;

  /**
   * Severity level of the event.
   *
   * Automatically populated by the log-level method you call
   * (`info` sets `"info"`, `warn` sets `"warn"`, etc.).
   * You do not need to provide this field when calling the
   * public methods — they accept `Omit<TrackPayload, "level">`.
   */
  level: LogLevel;

  /**
   * Optional human-readable description of the event.
   *
   * Useful for providing context that is easier to read than
   * structured fields alone.
   *
   * @example "Payment gateway timed out after 3 seconds"
   */
  message?: string;

  /**
   * Optional structured data attached to the event.
   *
   * Use this field for arbitrary key-value context such as
   * user IDs, order IDs, or feature flags. Values must be
   * JSON-serializable.
   *
   * @example { orderId: "123", plan: "pro" }
   */
  payload?: Record<string, unknown>;
}

/**
 * Internal payload passed from the SDK entry point
 * to the transport layer.
 *
 * @internal
 */
export interface SendLogPayload {
  apiKey: string;
  environment: Environment;
  data: TrackPayload;
}

/**
 * Common diagnostic metadata attached to SDK errors.
 *
 * This information is available on {@link DelokError.metadata}
 * and its subclasses to help with debugging without exposing
 * internal implementation details.
 */
export interface DelokErrorMetadata {
  /**
   * Total number of request attempts performed, including the
   * initial request. Present when the failure occurred during
   * log delivery.
   *
   * @example 3 // 1 initial request + 2 retries
   */
  attempts?: number;
  /**
   * Total time spent (in milliseconds) before the SDK
   * ultimately failed. Measured from the start of the
   * failing attempt.
   */
  duration?: number;
}

/**
 * Additional metadata specific to HTTP errors.
 *
 * Available on {@link DelokHttpError.metadata} when the Delok
 * backend responds with an unsuccessful HTTP status code.
 */
export interface DelokHttpErrorMetadata extends DelokErrorMetadata {
  /**
   * HTTP status code returned by the Delok backend.
   *
   * @example 401
   */
  status: number;
  /**
   * Structured business error returned by the backend,
   * containing a machine-readable code and human-readable message.
   */
  error: DelokApiError;
}

/**
 * Business error returned by the Delok backend.
 *
 * The `code` field is intended for programmatic handling,
 * while `message` provides a human-readable description.
 */
export interface DelokApiError {
  /** Machine-readable error code, e.g. `"INVALID_API_KEY"`. */
  code: string;
  /** Human-readable error description. */
  message: string;
}

/**
 * Standard error response envelope returned by the Delok backend.
 *
 * @internal - mirrors the backend API contract and is used
 * internally by the transport layer to extract error information.
 */
export interface DelokApiErrorResponse {
  success: false;
  error: DelokApiError;
  timestamp: string;
}

/**
 * Request-scoped context used internally to track retry state.
 *
 * @internal
 */
export interface RequestContext {
  attempt: number;
  startedAt: number;
}
