// /src/utils.ts

/**
 * Returns true when the provided string contains
 * non-whitespace characters.
 */
export const isValidString = (str: string) => {
  return typeof str === "string" && str.trim().length > 0;
};
