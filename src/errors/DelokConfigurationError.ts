// /src/errors/DelokConfigurationError.ts

import { DelokErrorMetadata } from "../types";
import { DelokError } from "./DelokError";

/**
 * Thrown synchronously when the SDK is initialized with invalid configuration.
 *
 * This error is thrown by the {@link Delok} constructor when `apiKey`
 * is empty or whitespace-only, or when `environment` is not one of
 * the supported values (`development`, `staging`, `production`).
 * It is not retried and does not include request metadata.
 *
 * @example
 * ```ts
 * try {
 *   const delok = new Delok({ apiKey: "", environment: "production" });
 * } catch (error) {
 *   if (error instanceof DelokConfigurationError) {
 *     console.error("Invalid SDK config:", error.message);
 *   }
 * }
 * ```
 */
export class DelokConfigurationError extends DelokError {
  constructor(message: string, metadata?: DelokErrorMetadata) {
    super(message, metadata);

    this.name = "DelokConfigurationError";
  }
}
