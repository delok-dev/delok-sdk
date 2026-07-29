// /src/utils.ts

import { BASE_RETRY_DELAY } from "./constants";

/**
 * Returns true when the provided string contains
 * non-whitespace characters.
 */
export const isValidString = (str: string) => {
  return typeof str === "string" && str.trim().length > 0;
};

/**
 * Creates a delay before continuing execution.
 *
 * Primarily used between retry attempts.
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates the delay before the next retry attempt
 * using an exponential backoff strategy.
 *
 * Example:
 * Attempt 1 -> 500ms
 * Attempt 2 -> 1000ms
 * Attempt 3 -> 2000ms
 */
export const getRetryDelay = (attempt: number) => {
  return BASE_RETRY_DELAY * 2 ** (attempt - 1);
};
