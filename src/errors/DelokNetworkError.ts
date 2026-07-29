// /src/errors/DelokNetworkError.ts

import { DelokErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when a network failure prevents logs
 * from being sent to the Delok backend.
 */
export class DelokNetworkError extends DelokError {
  constructor(message: string, metadata?: DelokErrorMetadata) {
    super(message, metadata);

    this.name = "DelokNetworkError";
  }
}
