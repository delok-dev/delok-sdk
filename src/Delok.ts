// /src/Delok.ts

import { SUPPORTED_ENVIRONMENTS } from "./constants";
import { DelokConfigurationError } from "./errors/DelokConfigurationError";
import { DelokError } from "./errors/DelokError";
import { sendLog } from "./transport";

import { DelokConfig, Environment, TrackPayload } from "./types";
import { isValidString } from "./utils";

/**
 * Client for sending structured application logs to the Delok observability platform.
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
 * delok.info({
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
   * @param config - Configuration for the client.
   * @param config.apiKey - API key used to authenticate with the Delok ingestion API. Must be a non-empty string.
   * @param config.environment - Runtime environment for all logs. Must be one of `"development"`, `"staging"`, or `"production"`.
   * @throws {DelokConfigurationError} When `apiKey` is empty/whitespace-only or `environment` is not one of the supported values.
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
    if (!isValidString(data.event)) {
      throw new DelokError("Event name cannot be empty.");
    }

    return sendLog({
      apiKey: this.apiKey,
      environment: this.environment,
      data,
    });
  }

  /**
   * Records an informational event.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"user_login"` or `"order_created"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns `void`
   *
   * @example
   * ```ts
   * delok.info({
   *   event: "user_login",
   *   message: "User successfully logged in",
   *   payload: { userId: "123" }
   * });
   * ```
   */
  info(data: Omit<TrackPayload, "level">): void {
    void this.track({
      level: "info",
      ...data,
    }).catch(() => {});
  }

  /**
   * Records a warning event.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"payment_retry"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns `void`
   *
   * @example
   * ```ts
   * delok.warn({
   *   event: "payment_retry",
   *   message: "Payment gateway timeout, retrying",
   *   payload: { orderId: "123", attempt: 2 }
   * });
   * ```
   */
  warn(data: Omit<TrackPayload, "level">): void {
    void this.track({
      level: "warn",
      ...data,
    }).catch(() => {});
  }

  /**
   * Records an error event.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"payment_failed"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns `void`
   *
   * @example
   * ```ts
   * delok.error({
   *   event: "payment_failed",
   *   message: "Payment process failed",
   *   payload: { orderId: "123", reason: "insufficient_funds" }
   * });
   * ```
   */
  error(data: Omit<TrackPayload, "level">): void {
    void this.track({
      level: "error",
      ...data,
    }).catch(() => {});
  }

  /**
   * Records a fatal event.
   *
   * @param data - Structured information describing the event.
   * @param data.event - Stable, descriptive event name (e.g. `"database_crash"`). Required.
   * @param data.message - Optional human-readable description of the event.
   * @param data.payload - Optional structured context as key-value pairs. Must be JSON-serializable.
   * @returns `void`
   *
   * @example
   * ```ts
   * delok.fatal({
   *   event: "database_crash",
   *   message: "Primary database is unavailable",
   *   payload: { host: "db-primary" }
   * });
   * ```
   */
  fatal(data: Omit<TrackPayload, "level">): void {
    void this.track({
      level: "fatal",
      ...data,
    }).catch(() => {});
  }
}
