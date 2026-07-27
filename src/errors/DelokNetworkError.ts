// /src/errors/DelokNetworkError.ts

import { DelokError } from "./DelokError";

/**
 * Thrown when a network failure prevents logs
 * from being sent to the Delok backend.
 */
export class DelokNetworkError extends DelokError {
  constructor(message: string) {
    super(message);

    this.name = "DelokNetworkError";
  }
}
