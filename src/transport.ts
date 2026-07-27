// /src/transport.ts

import { DEFAULT_REQUEST_TIMEOUT } from "./constants";
import { DelokError } from "./errors/DelokError";
import { DelokNetworkError } from "./errors/DelokNetworkError";
import { DelokTimeoutError } from "./errors/DelokTimeoutError";
import { TrackPayload } from "./types";

/**
 * Transport layer responsible for communicating with the Delok backend.
 *
 * Responsibilities:
 * - Send HTTP requests
 * - Apply request timeout
 * - Convert low-level network errors into SDK-specific errors
 *
 * Business validation is intentionally handled by the backend.
 */
export const sendLog = async (
  apiKey: string,
  environment: string,
  data: TrackPayload,
) => {
  // AbortController is used to prevent requests from waiting forever.
  // If the timeout is reached, the request is cancelled and converted
  // into a DelokTimeoutError.
  const controller = new AbortController();
  const signal = controller.signal;

  // Start the timeout before sending the request so the entire
  // network operation is protected.
  const requestTimeout = setTimeout(() => {
    controller.abort();
  }, DEFAULT_REQUEST_TIMEOUT);

  try {
    await fetch("http://localhost:8000/api/ingestion", {
      signal,
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },

      body: JSON.stringify({
        environment,
        occurredAt: new Date(),

        ...data,
      }),
    });
  } catch (error) {
    // Hide fetch implementation details by converting native errors
    // into Delok SDK errors.
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new DelokTimeoutError(
          `Request timeout after ${DEFAULT_REQUEST_TIMEOUT} seconds`,
        );
      } else {
        throw new DelokNetworkError("Network error when sending log");
      }
    }
  } finally {
    // Always clean up the timer regardless of success or failure
    // to avoid unnecessary timers remaining in memory.
    clearTimeout(requestTimeout);
  }
};
