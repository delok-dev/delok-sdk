// /src/errors/DelokConfigurationError.ts

import { DelokError } from "./DelokError";

/**
 * Thrown when the SDK is initialized with an invalid configuration.
 */
export class DelokConfigurationError extends DelokError {
  constructor(message: string) {
    super(message);

    this.name = "DelokConfigurationError";
  }
}
