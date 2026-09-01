// /src/errors/DelokHttpError.ts

import { DelokHttpErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when the Delok backend responds with an unsuccessful HTTP status code.
 *
 * Inspect {@link DelokHttpErrorMetadata.status} and {@link DelokHttpErrorMetadata.error}
 * for the HTTP status and the structured business error returned by the backend.
 * Transient status codes (500, 502, 503, 504) are automatically retried before this
 * error is thrown; permanent failures (e.g. 400, 401) are thrown immediately.
 *
 * @example
 * ```ts
 * try {
 *   await delok.info({ event: "user_login" });
 * } catch (error) {
 *   if (error instanceof DelokHttpError) {
 *     console.error(error.metadata?.status); // e.g. 401
 *     console.error(error.metadata?.error.code); // e.g. "INVALID_API_KEY"
 *   }
 * }
 * ```
 */
export class DelokHttpError extends DelokError<DelokHttpErrorMetadata> {
  constructor(message: string, metadata?: DelokHttpErrorMetadata) {
    super(message, metadata);

    this.name = "DelokHttpError";
  }
}
