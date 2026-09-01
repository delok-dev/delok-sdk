// /src/errors/DelokNetworkError.ts

import { DelokErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when a network failure prevents the log from being delivered.
 *
 * This indicates that the SDK could not reach the Delok backend (e.g.
 * DNS failure, connection refused). The SDK retries transient network
 * failures with exponential backoff before throwing. Inspect
 * `metadata.attempts` and `metadata.duration` for retry context.
 *
 * @example
 * ```ts
 * try {
 *   await delok.error({ event: "payment_failed" });
 * } catch (error) {
 *   if (error instanceof DelokNetworkError) {
 *     console.error(`Failed after ${error.metadata?.attempts} attempts`);
 *   }
 * }
 * ```
 */
export class DelokNetworkError extends DelokError {
  constructor(message: string, metadata?: DelokErrorMetadata) {
    super(message, metadata);

    this.name = "DelokNetworkError";
  }
}
