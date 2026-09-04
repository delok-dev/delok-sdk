// /src/errors/DelokError.ts

import { DelokErrorMetadata } from "../types";

/**
 * Base class for all errors thrown by the Delok SDK.
 *
 * Every SDK-specific error extends this class. Configuration errors are
 * thrown synchronously when creating a client.
 *
 * @example
 * ```ts
 * try {
 *   const delok = new Delok({ apiKey: "", environment: "production" });
 * } catch (error) {
 *   if (error instanceof DelokError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class DelokError<TMetadata = DelokErrorMetadata> extends Error {
  constructor(
    message: string,

    /**
     * Additional diagnostic context describing the circumstances
     * of the failure, such as retry attempts and duration.
     * Not all errors include metadata (e.g. configuration errors
     * thrown synchronously before any request is made).
     */
    public metadata?: TMetadata,
  ) {
    super(message);

    this.name = "DelokError";
  }
}
