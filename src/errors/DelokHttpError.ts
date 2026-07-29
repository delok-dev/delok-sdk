// /src/errors/DelokHttpError.ts

import { DelokError } from "./DelokError";

export class DelokHttpError extends DelokError {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);

    this.name = "DelokHttpError";
  }
}
