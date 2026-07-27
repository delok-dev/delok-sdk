// /src/utils.ts

export const isValidString = (str: string) => {
  return typeof str === "string" && str.trim().length > 0;
};
