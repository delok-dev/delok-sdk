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

/**
 * Number of retry attempts after the initial request.
 *
 * Example:
 * 2 = 1 initial request + 2 retries.
 */
export const DEFAULT_MAX_RETRIES = 2;

/**
 * Base delay (in milliseconds) used for
 * calculating exponential backoff between retries.
 */
export const BASE_RETRY_DELAY = 500;

/**
 * Internal ingestion endpoint for the Delok backend.
 *
 * This is an infrastructure concern controlled by the SDK implementation.
 * It is not part of the public `DelokConfig` and should not be
 * configurable by SDK consumers through normal public API.
 *
 * Current value is the local MVP placeholder (`http://localhost:8000/api/ingestion`).
 * The value is intentionally kept as an internal constant — do not
 * expose it through `DelokConfig` or public exports.
 */
export const DEFAULT_ENDPOINT = "http://localhost:8000/api/ingestion" as const;

/**
 * HTTP status codes considered temporary failures.
 *
 * Requests returning these responses may succeed
 * if attempted again after a short delay.
 */
export const RETRYABLE_STATUS_CODES = [500, 502, 503, 504] as const;
