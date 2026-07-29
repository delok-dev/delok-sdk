// /src/errors/DelokError.ts

import { DelokErrorMetadata } from "../types";

/**
 * Base class for all errors thrown by the Delok SDK.
 *
 * Applications can catch DelokError to handle every SDK-specific
 * error in a single place.
 */
export class DelokError<TMetadata = DelokErrorMetadata> extends Error {
  constructor(
    message: string,

    /**
     * Additional context describing
     * the circumstances of the failure.
     */
    public metadata?: TMetadata,
  ) {
    super(message);

    this.name = "DelokError";
  }
}
