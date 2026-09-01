// /src/errors/DelokError.ts

import { DelokErrorMetadata } from "../types";

/**
 * Base class for all errors thrown by the Delok SDK.
 *
 * Every SDK-specific error extends this class, so you can handle all
 * Delok failures in a single catch block. Each instance may carry
 * optional {@link DelokErrorMetadata} with diagnostic context such as
 * the number of attempts and total duration.
 *
 * @example
 * ```ts
 * try {
 *   await delok.info({ event: "user_login" });
 * } catch (error) {
 *   if (error instanceof DelokError) {
 *     console.error(error.message);
 *     console.error(error.metadata?.attempts);
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
