// /src/errors/DelokError.ts

/**
 * Base class for all errors thrown by the Delok SDK.
 *
 * Applications can catch DelokError to handle every SDK-specific
 * error in a single place.
 */
export class DelokError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "DelokError";
  }
}
