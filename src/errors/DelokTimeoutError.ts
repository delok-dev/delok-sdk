// /src/errors/DelokTimeoutError.ts

import { DelokErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when a request exceeds the configured timeout.
 */
export class DelokTimeoutError extends DelokError {
  constructor(message: string, metadata?: DelokErrorMetadata) {
    super(message, metadata);

    this.name = "DelokTimeoutError";
  }
}
