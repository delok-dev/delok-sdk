// /src/errors/DelokTimeoutError.ts

import { DelokErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when a log delivery request exceeds the SDK's built-in timeout.
 *
 * Each request attempt is bounded by an internal timeout. Timeouts are
 * retried with exponential backoff before this error is thrown.
 * Inspect `metadata.attempts` and `metadata.duration` for retry context.
 *
 * @example
 * ```ts
 * try {
 *   await delok.fatal({ event: "database_crash" });
 * } catch (error) {
 *   if (error instanceof DelokTimeoutError) {
 *     console.error(`Timed out after ${error.metadata?.duration}ms`);
 *   }
 * }
 * ```
 */
export class DelokTimeoutError extends DelokError {
  constructor(message: string, metadata?: DelokErrorMetadata) {
    super(message, metadata);

    this.name = "DelokTimeoutError";
  }
}
