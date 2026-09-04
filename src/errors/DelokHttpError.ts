// /src/errors/DelokHttpError.ts

import { DelokHttpErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when the Delok backend responds with an unsuccessful HTTP status code.
 *
 * Inspect {@link DelokHttpErrorMetadata.status} and {@link DelokHttpErrorMetadata.error}
 * for the HTTP status and the structured business error returned by the backend.
 *
 * @example
 * ```ts
 * // DelokHttpError is part of the SDK error hierarchy.
 * // Logging methods handle delivery failures internally.
 * ```
 */
export class DelokHttpError extends DelokError<DelokHttpErrorMetadata> {
  constructor(message: string, metadata?: DelokHttpErrorMetadata) {
    super(message, metadata);

    this.name = "DelokHttpError";
  }
}
