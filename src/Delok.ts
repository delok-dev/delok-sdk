// /src/Delok.ts

import { SUPPORTED_ENVIRONMENTS } from "./constants";
import { DelokConfigurationError } from "./errors/DelokConfigurationError";
import { sendLog } from "./transport";

import { DelokConfig, Environment, TrackPayload } from "./types";
import { isValidString } from "./utils";

/**
 * Client for sending structured application logs to the Delok observability platform.
 *
 * This is the main entry point of the SDK. Create a single instance with
 * your API key and environment, then use the fixed log-level methods
 * (`info`, `warn`, `error`, `fatal`) to report events. Each call sends
 * a structured payload to the Delok ingestion API (`POST /api/ingestion`)
 * using the SDK's built-in request timeout and limited retry behavior
 * for transient failures.
 *
 * The client validates its configuration synchronously during construction
 * and does not perform any automatic exception capture or process termination.
 *
 * @example
 * ```ts
 * import { Delok } from "delok";
 *
 * const delok = new Delok({
 *   apiKey: process.env.DELOK_API_KEY!,
 *   environment: "production",
 * });
 *
 * await delok.info({
 *   event: "user_login",
 *   message: "User successfully logged in",
 * });
 * ```
 */
export class Delok {
  private apiKey: string;

  private environment: Environment;

  /**
   * Creates a new Delok client.
   *
   * Validates the provided configuration synchronously. If validation
   * fails, the constructor throws and no client is created.
   *
   * @param config - Configuration for the client.
   * @param config.apiKey - API key used to authenticate with the Delok ingestion API. Must be a non-empty string.
   * @param config.environment - Runtime environment for all logs. Must be one of `"development"`, `"staging"`, or `"production"`.
   * @throws {DelokConfigurationError} When `apiKey` is empty/whitespace-only or `environment` is not one of the supported values.
   *
   * @example
   * ```ts
   * const delok = new Delok({
   *   apiKey: process.env.DELOK_API_KEY!,
   *   environment: "development",
   * });
   * ```
   */
  constructor(config: DelokConfig) {
    if (!isValidString(config.apiKey)) {
      throw new DelokConfigurationError("API Key cannot be empty.");
    }

    if (!SUPPORTED_ENVIRONMENTS.includes(config.environment)) {
      throw new DelokConfigurationError(
        "Invalid environment. Expected one of: development, staging, production.",
      );
    }

    this.apiKey = config.apiKey;

    this.environment = config.environment;
  }

  private async track(data: TrackPayload) {
    return sendLog({
      apiKey: this.apiKey,
      environment: this.environment,
      data,
    });
  }

  /**
   * Records an informational event.
   *
   * Use this level for normal application activity that is useful for
   * understanding what the application is doing, such as user actions,
   * successful operations, or lifecycle events. This is the lowest
   * severity level.
   *
   * Sends the log to the Delok ingestion API with `level: "info"`.
   * The request uses the SDK's built-in timeout and limited retry
   * behavior for transient failures (network errors, timeouts, and
   * retryable HTTP status codes).
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"user_login"` or `"order_created"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs (e.g. `{ userId: "123" }`). Must be JSON-serializable.
   * @returns A promise that resolves to `void` when the log has been accepted by the backend. The promise rejects with a {@link DelokError} subclass on failure.
   * @throws {DelokNetworkError} When a network failure prevents delivery (after retries are exhausted).
   * @throws {DelokTimeoutError} When the request exceeds the built-in timeout.
   * @throws {DelokHttpError} When the backend responds with an unsuccessful HTTP status code.
   *
   * @example
   * ```ts
   * await delok.info({
   *   event: "user_login",
   *   message: "User successfully logged in",
   *   payload: { userId: "123" }
   * });
   * ```
   */
  async info(data: Omit<TrackPayload, "level">): Promise<void> {
    return this.track({
      level: "info",
      ...data,
    });
  }

  /**
   * Records a warning event.
   *
   * Use this level for unexpected situations that do not prevent the
   * application from continuing but may require attention, such as
   * degraded performance, retryable failures, or deprecated usage.
   * More severe than `info`, less severe than `error`.
   *
   * Sends the log to the Delok ingestion API with `level: "warn"`.
   * The request uses the SDK's built-in timeout and limited retry
   * behavior for transient failures.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"payment_retry"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns A promise that resolves to `void` when the log has been accepted. Rejects with a {@link DelokError} subclass on failure.
   * @throws {DelokNetworkError} When a network failure prevents delivery (after retries are exhausted).
   * @throws {DelokTimeoutError} When the request exceeds the built-in timeout.
   * @throws {DelokHttpError} When the backend responds with an unsuccessful HTTP status code.
   *
   * @example
   * ```ts
   * await delok.warn({
   *   event: "payment_retry",
   *   message: "Payment gateway timeout, retrying",
   *   payload: { orderId: "123", attempt: 2 }
   * });
   * ```
   */
  async warn(data: Omit<TrackPayload, "level">): Promise<void> {
    return this.track({
      level: "warn",
      ...data,
    });
  }

  /**
   * Records an error event.
   *
   * Use this level for failures that affect a specific operation but
   * do not necessarily terminate the application, such as a failed
   * payment or a validation error. This method does not automatically
   * capture or forward `Error` objects — include relevant details
   * in `message` or `payload` as needed.
   *
   * Sends the log to the Delok ingestion API with `level: "error"`.
   * The request uses the SDK's built-in timeout and limited retry
   * behavior for transient failures.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"payment_failed"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns A promise that resolves to `void` when the log has been accepted. Rejects with a {@link DelokError} subclass on failure.
   * @throws {DelokNetworkError} When a network failure prevents delivery (after retries are exhausted).
   * @throws {DelokTimeoutError} When the request exceeds the built-in timeout.
   * @throws {DelokHttpError} When the backend responds with an unsuccessful HTTP status code.
   *
   * @example
   * ```ts
   * await delok.error({
   *   event: "payment_failed",
   *   message: "Payment process failed",
   *   payload: { orderId: "123", reason: "insufficient_funds" }
   * });
   * ```
   */
  async error(data: Omit<TrackPayload, "level">): Promise<void> {
    return this.track({
      level: "error",
      ...data,
    });
  }

  /**
   * Records a fatal event.
   *
   * Use this level for unrecoverable failures that may cause the
   * application or process to terminate, such as a database crash
   * or missing critical dependency. More severe than `error`.
   * This method does not automatically terminate the application
   * or capture uncaught exceptions — it only sends a log with
   * `level: "fatal"`.
   *
   * Sends the log to the Delok ingestion API with `level: "fatal"`.
   * The request uses the SDK's built-in timeout and limited retry
   * behavior for transient failures.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"database_crash"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns A promise that resolves to `void` when the log has been accepted. Rejects with a {@link DelokError} subclass on failure.
   * @throws {DelokNetworkError} When a network failure prevents delivery (after retries are exhausted).
   * @throws {DelokTimeoutError} When the request exceeds the built-in timeout.
   * @throws {DelokHttpError} When the backend responds with an unsuccessful HTTP status code.
   *
   * @example
   * ```ts
   * await delok.fatal({
   *   event: "database_crash",
   *   message: "Primary database is unavailable",
   *   payload: { host: "db-primary" }
   * });
   * ```
   */
  async fatal(data: Omit<TrackPayload, "level">): Promise<void> {
    return this.track({
      level: "fatal",
      ...data,
    });
  }
}
