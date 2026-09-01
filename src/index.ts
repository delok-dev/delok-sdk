// /src/index.ts

/**
 * Delok SDK — lightweight TypeScript client for sending structured
 * application logs to the Delok observability platform.
 *
 * @packageDocumentation
 */

export { DelokHttpError } from "./errors/DelokHttpError";

export { Delok } from "./Delok";

export type { DelokConfig, TrackPayload, LogLevel, Environment } from "./types";
export type { DelokErrorMetadata, DelokHttpErrorMetadata, DelokApiError } from "./types";

export { DelokError } from "./errors/DelokError";
export { DelokConfigurationError } from "./errors/DelokConfigurationError";
export { DelokTimeoutError } from "./errors/DelokTimeoutError";
export { DelokNetworkError } from "./errors/DelokNetworkError";
