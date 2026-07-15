import { sendLog } from "./transport";

import { DelokConfig, TrackPayload } from "./types";

export class Delok {
  private apiKey: string;

  private environment: string;

  constructor(config: DelokConfig) {
    this.apiKey = config.apiKey;
    this.environment = config.environment;
  }

  async track(data: TrackPayload) {
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
