// /src/Delok.ts

import { sendLog } from "./transport";

import { DelokConfig, Environment, TrackPayload } from "./types";
import { isValidString } from "./utils";

export class Delok {
  private apiKey: string;

  private environment: Environment;

  constructor(config: DelokConfig) {
    if (!isValidString(config.apiKey)) {
      throw new Error("API Key cannot be empty");
    }

    this.apiKey = config.apiKey;

    this.environment = config.environment;
  }

  private async track(data: TrackPayload) {
    return sendLog(this.apiKey, this.environment, data);
  }

  async info(data: Omit<TrackPayload, "level">) {
    return this.track({
      level: "info",
      ...data,
    });
  }

  async warn(data: Omit<TrackPayload, "level">) {
    return this.track({
      level: "warn",
      ...data,
    });
  }

  async error(data: Omit<TrackPayload, "level">) {
    return this.track({
      level: "error",
      ...data,
    });
  }

  async fatal(data: Omit<TrackPayload, "level">) {
    return this.track({
      level: "fatal",
      ...data,
    });
  }
}
