// /src/constants.ts

/**
 * Supported runtime environments accepted by the SDK.
 * These values are validated during SDK initialization.
 */
export const SUPPORTED_ENVIRONMENTS = [
  "development",
  "staging",
  "production",
] as const;

/**
 * Fixed log levels exposed by the SDK.
 * Developers cannot define custom log levels.
 */
export const SUPPORTED_LOG_LEVELS = ["info", "warn", "error", "fatal"] as const;

/**
 * Maximum amount of time (in milliseconds) the SDK will wait
 * for the ingestion request before aborting it.
 */
export const DEFAULT_REQUEST_TIMEOUT = 5000;
