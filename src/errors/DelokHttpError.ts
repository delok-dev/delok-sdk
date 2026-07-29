// /src/errors/DelokHttpError.ts

import { DelokHttpErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when the Delok backend responds
 * with an unsuccessful HTTP status code.
 *
 * HTTP-specific details such as the response
 * status code are available through the
 * attached metadata.
 */
export class DelokHttpError extends DelokError<DelokHttpErrorMetadata> {
  constructor(message: string, metadata?: DelokHttpErrorMetadata) {
    super(message, metadata);

    this.name = "DelokHttpError";
  }
}
