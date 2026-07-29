// /src/Delok.ts

import { SUPPORTED_ENVIRONMENTS } from "./constants";
import { DelokConfigurationError } from "./errors/DelokConfigurationError";
import { sendLog } from "./transport";

import { DelokConfig, Environment, TrackPayload } from "./types";
import { isValidString } from "./utils";

/**
 * Delok SDK entry point.
 *
 * This class provides the public API exposed to application developers.
 * It validates the SDK configuration during initialization and delegates
 * all log delivery responsibilities to the transport layer.
 *
 * Business logic intentionally does not live here.
 */
export class Delok {
  private apiKey: string;

  private environment: Environment;

  // Validate configuration immediately so invalid SDK instances
  // cannot be created. This prevents runtime failures later when
  // sending logs.
  constructor(config: DelokConfig) {
    if (!isValidString(config.apiKey)) {
      throw new DelokConfigurationError("API Key cannot be empty.");
    }

    if (!SUPPORTED_ENVIRONMENTS.includes(config.environment)) {
      throw new DelokConfigurationError(
        "Invalid environment. Expected one of: development, staging, production.",
      );
    }

    this.apiKey = config.apiKey;

    this.environment = config.environment;
  }

  // Internal method used by the public logging APIs.
  // Keeping this private ensures developers can only use
  // supported log levels (info, warn, error, fatal).
  private async track(data: TrackPayload) {
    return sendLog({
      apiKey: this.apiKey,
      environment: this.environment,
      data,
    });
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
