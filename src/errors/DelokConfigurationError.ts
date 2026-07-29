// /src/errors/DelokConfigurationError.ts

import { DelokErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown when the SDK is initialized with an invalid configuration.
 */
export class DelokConfigurationError extends DelokError {
  constructor(message: string, metadata?: DelokErrorMetadata) {
    super(message, metadata);

    this.name = "DelokConfigurationError";
  }
}
