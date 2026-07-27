// /src/errors/DelokTimeoutError.ts

import { DelokError } from "./DelokError";

/**
 * Thrown when a request exceeds the configured timeout.
 */
export class DelokTimeoutError extends DelokError {
  constructor(message: string) {
    super(message);

    this.name = "DelokTimeoutError";
  }
}
