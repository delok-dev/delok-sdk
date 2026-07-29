// /src/utils.ts

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
