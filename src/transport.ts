// /src/transport.ts

import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_REQUEST_TIMEOUT,
  RETRYABLE_STATUS_CODES,
} from "./constants";
import { DelokError } from "./errors/DelokError";
import { DelokHttpError } from "./errors/DelokHttpError";
import { DelokNetworkError } from "./errors/DelokNetworkError";
import { DelokTimeoutError } from "./errors/DelokTimeoutError";
import {
  RetryableStatus,
  SendLogPayload,
  DelokApiErrorResponse,
  RequestContext,
} from "./types";
import { getRetryDelay, sleep } from "./utils";

/**
 * @internal
 * Sends a log event to the Delok backend with built-in timeout
 * and limited retry for transient failures.
 *
 * Permanent failures (e.g. HTTP 400, invalid API keys) are not retried.
 */
export const sendLog = async (payload: SendLogPayload) => {
  // Total attempts include the initial request plus any configured retries.
  //
  // Example:
  // DEFAULT_MAX_RETRIES = 2
  //
  // Attempt 1
  // Attempt 2
  // Attempt 3
  const totalAttempts = DEFAULT_MAX_RETRIES + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    // Store request-scoped information so it can be
    // attached to any error produced during this attempt.
    const context: RequestContext = {
      attempt,
      startedAt: performance.now(),
    };
    // Determine whether another retry attempt is still available.
    const hasNextAttempt = attempt < totalAttempts;

    try {
      await performRequest(payload, context);
      return;
    } catch (error) {
      // Only retry transient failures.
      // Permanent errors are immediately propagated to the SDK consumer.
      if (!shouldRetry(error, hasNextAttempt)) {
        if (error instanceof Error) {
          throw error;
        }

        throw new Error("Unknown transport error");
      }

      const delay = getRetryDelay(attempt);

      console.info(
        `Retrying request (${attempt + 1}/${totalAttempts}) in ${delay}ms...`,
      );

      await sleep(delay);
    }
  }
};

/**
 * @internal
 * Performs a single HTTP request to the ingestion endpoint.
 * Applies request timeout and converts fetch errors into SDK errors.
 * Retry is handled by the caller.
 */
const performRequest = async (
  payload: SendLogPayload,
  context: RequestContext,
) => {
  // Each request gets its own AbortController so that timeouts
  // only affect the current attempt.
  const controller = new AbortController();
  const signal = controller.signal;

  // Automatically cancel the request if it exceeds the configured timeout.
  // This prevents the SDK from waiting indefinitely for a response.
  const requestTimeout = setTimeout(() => {
    controller.abort();
  }, DEFAULT_REQUEST_TIMEOUT);

  // Extract request data needed by the transport layer.
  const { apiKey, environment, data } = payload;
  try {
    const response = await fetch("http://localhost:8000/api/ingestion", {
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

    // Fetch only rejects on network failures.
    // HTTP error responses (4xx/5xx) must be checked manually.
    if (!response.ok) {
      const result: DelokApiErrorResponse = await response.json();
      const { code, message } = result.error;
      throw new DelokHttpError(
        `The Delok server responded with HTTP ${response.status}.`,
        {
          status: response.status,
          attempts: context.attempt,
          duration: performance.now() - context.startedAt,
          error: {
            code,
            message,
          },
        },
      );
    }
  } catch (error) {
    // Errors already converted into Delok SDK errors should be
    // propagated without additional wrapping.
    if (error instanceof DelokError) {
      throw error;
    }

    if (error instanceof Error) {
      // Convert the native AbortError into a Delok-specific timeout error.
      if (error.name === "AbortError") {
        throw new DelokTimeoutError(
          `Request timeout after ${DEFAULT_REQUEST_TIMEOUT} seconds`,
          {
            attempts: context.attempt,
            duration: performance.now() - context.startedAt,
          },
        );
      } else {
        // Any remaining native fetch errors are treated as network failures.
        throw new DelokNetworkError("Network error when sending log", {
          attempts: context.attempt,
          duration: performance.now() - context.startedAt,
        });
      }
    }

    throw error;
  } finally {
    // Always clear the timeout to prevent unnecessary timers
    // from remaining active after the request completes.
    clearTimeout(requestTimeout);
  }
};

/** @internal - decides whether a failed attempt should be retried. */
const shouldRetry = (error: unknown, hasNextAttempt: boolean) => {
  // Stop retrying once all configured attempts have been exhausted.
  if (!hasNextAttempt) return false;

  return (
    error instanceof DelokTimeoutError ||
    error instanceof DelokNetworkError ||
    (error instanceof DelokHttpError &&
      RETRYABLE_STATUS_CODES.includes(
        error.metadata?.status as RetryableStatus,
      ))
  );
};
