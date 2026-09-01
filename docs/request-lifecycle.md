# Delok SDK — Request Lifecycle

> Traces the real execution path of a log from `delok.info()` to HTTP response. References are file:line. Verified by `tests/public-api.test.ts` and `tests/transport.test.ts`.

## 1. Entry: Public Logging Method

Developer call (example):

```ts
await delok.info({ event: "user_login", message: "ok", payload: { userId: "1" } });
```

Implementation — `src/Delok.ts:117` (`info`), `154` (`warn`), `192` (`error`), `231` (`fatal`):

```ts
async info(data: Omit<TrackPayload, "level">): Promise<void> {
  return this.track({ level: "info", ...data });
}
```

* The method injects the fixed `level` and spreads caller `data`.
* `level` is never caller-supplied; the `Omit` enforces this at the type level.
* Minimal payload validation now in `track()` — empty `event` fails before network.

## 2. Internal Delegation: `private track()`

`src/Delok.ts:94`:

```ts
private async track(data: TrackPayload) {
  if (!isValidString(data.event)) throw new DelokError("Event name cannot be empty.");
  return sendLog({ apiKey: this.apiKey, environment: this.environment, endpoint: this.endpoint, data });
}
```

* Validates `event` via `isValidString` `src/utils.ts:9` — whitespace/empty fails fast with `DelokError`.
* Combines stored config (`this.apiKey`, `this.environment`, `this.endpoint` — set in `constructor` `src/Delok.ts:62`) with the `TrackPayload`.
* Produces `SendLogPayload` (`src/types.ts:155`) — internal type, never exposed via `src/index.ts`.
* Tested: `tests/public-api.test.ts` validates event and endpoint propagation.

## 3. Transport Entry: `sendLog`

`src/transport.ts:27` — `@internal`, retry loop:

```ts
export const sendLog = async (payload: SendLogPayload) => {
  const totalAttempts = DEFAULT_MAX_RETRIES + 1; // 3  src/constants.ts:31
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const context: RequestContext = { attempt, startedAt: performance.now() };
    const hasNextAttempt = attempt < totalAttempts;
    try { await performRequest(payload, context); return; }
    catch (error) {
      if (!shouldRetry(error, hasNextAttempt)) {
        if (error instanceof DelokError) throw error;
        if (error instanceof Error) throw new DelokError(error.message, {attempts: context.attempt, duration: ...});
        throw new DelokError("Unknown transport error", {attempts: context.attempt, duration: ...});
      }
      await sleep(getRetryDelay(attempt)); // exponential backoff, no console.info
    }
  }
}
```

* `RequestContext` (`src/types.ts:239`) captures `attempt` and `startedAt` for error metadata (per-attempt).
* `totalAttempts = 3` (1 initial + 2 retries). Not consumer-configurable.
* **No `console.info`** — retry logging removed (see reliability.md). Previously `console.info` at old `src/transport.ts:64` deleted.
* Unknown `Error` now normalized to `DelokError` (was `new Error("Unknown transport error")`); non-`Error` throwables now wrapped as `DelokError(String(error))` — see error-handling.md.
* Return is `void` — success is silent. All failures propagate as `DelokError` subclass or base.

## 4. Single Attempt: `performRequest`

`src/transport.ts:90` — per-attempt HTTP:

### 4.1 Timeout setup

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT); // 5000ms src/constants.ts:23
```

* New `AbortController` per attempt — timeout does not leak across retries.
* Timer cleared in `finally` `src/transport.ts:173` to avoid dangling timers.

### 4.2 Request construction

```ts
await fetch(endpoint, { // from SendLogPayload, defaults to DEFAULT_ENDPOINT src/constants.ts:48
  signal,
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  body: JSON.stringify({ environment, occurredAt: new Date(), ...data })
});
```

* **Endpoint:** `endpoint` from `SendLogPayload` (`src/Delok.ts:95`), which is `config.endpoint ?? DEFAULT_ENDPOINT`. No longer hardcoded literal in `fetch` call. Tested in `tests/public-api.test.ts`.
* **Auth:** `x-api-key` header, value is raw `apiKey` string (`src/transport.ts:117`).
* **Body:** spreads `data` (`event`, `level`, `message?`, `payload?`) plus `environment` from config and `occurredAt: new Date()` generated at request time.
* **Serialization:** `Date` becomes ISO string via `JSON.stringify`. No custom serializer.

### 4.3 Response handling

```ts
if (!response.ok) {
  let apiError;
  try {
    const result: DelokApiErrorResponse = await response.json(); // src/types.ts:228
    apiError = { code: result.error.code, message: result.error.message };
  } catch {
    apiError = { code: "UNKNOWN_ERROR", message: response.statusText || `HTTP ${response.status}` };
  }
  throw new DelokHttpError(`The Delok server responded with HTTP ${response.status}.`, {
    status: response.status, attempts: context.attempt, duration: performance.now() - context.startedAt, error: apiError
  });
}
```

* `fetch` only rejects on network failure; HTTP 4xx/5xx inspected manually.
* **Hardened:** `response.json()` now wrapped in `try/catch` to preserve HTTP status when body is not valid JSON (e.g., HTML 502 page). Previously a SyntaxError was caught as generic `Error` and mapped to `DelokNetworkError`, losing status. Now status is preserved with `UNKNOWN_ERROR` fallback. Verified by `tests/transport.test.ts` ("preserves status on invalid JSON error response").
* `attempts` and `duration` stamped from `RequestContext` (per-attempt).

### 4.4 Error mapping (catch block)

`src/transport.ts:144`:

```ts
if (error instanceof DelokError) throw error;                 // already mapped
if (error.name === "AbortError") throw new DelokTimeoutError( // timeout
  `Request timeout after ${DEFAULT_REQUEST_TIMEOUT}ms`,  // fixed unit
  { attempts: context.attempt, duration: performance.now() - context.startedAt });
else throw new DelokNetworkError("Network error when sending log", { attempts, duration });
// final fallback now DelokError(String(error), {attempts, duration}) instead of raw throw
```

* `DelokError` instances pass through unchanged.
* `AbortError` from `AbortController` → `DelokTimeoutError` with correct `ms` unit.
* Any other native `Error` (TypeError from fetch, etc.) → `DelokNetworkError`.
* Non-`Error` throwables → `DelokError(String(error))` — now normalized, was raw `throw error`.

### 4.5 Cleanup

```ts
finally { clearTimeout(requestTimeout); }
```

Ensures timer does not fire after success/failure.

## 5. Retry Decision: `shouldRetry`

`src/transport.ts:179`:

```ts
const shouldRetry = (error, hasNextAttempt) =>
  hasNextAttempt && (
    error instanceof DelokTimeoutError ||
    error instanceof DelokNetworkError ||
    (error instanceof DelokHttpError && RETRYABLE_STATUS_CODES.includes(status))
  );
```

* `RETRYABLE_STATUS_CODES = [500,502,503,504]` `src/constants.ts:57`.
* Permanent `DelokHttpError` (400,401,403,404, etc.) → never retried.
* `DelokError` from event validation → not retryable (not in predicate) → fails fast.
* `DelokConfigurationError` never reaches here (thrown before transport).
* If `hasNextAttempt === false`, always `false` — exhaustion propagates.

## 6. Completion

* **Success:** `performRequest` returns `void`, `sendLog` returns `void`, `info/warn/error/fatal` resolves `Promise<void>`. No response body is returned to caller.
* **Failure:** `sendLog` re-throws the last `DelokError` (now always a `DelokError`); caller receives rejected `Promise`. No swallowing.

## 7. Sequence Diagram

```
delok.info({event}) 
  │ track({level:"info",...}) + event validation src/Delok.ts:94
  │ → if empty event: throw DelokError (no fetch)
  ▼
sendLog loop attempt=1..3 src/transport.ts:38
  │ context={attempt, startedAt}
  ▼
performRequest src/transport.ts:90
  ├─ AbortController + setTimeout 5000ms
  ├─ fetch POST endpoint (config or DEFAULT_ENDPOINT) + headers + body
  ├─ if !ok → try parse JSON else UNKNOWN_ERROR fallback → DelokHttpError
  ├─ catch AbortError → DelokTimeoutError (5000ms)
  ├─ catch other Error → DelokNetworkError
  ├─ catch non-Error → DelokError
  └─ finally clearTimeout
  │
  ├─ success → return void (resolves)
  └─ failure → shouldRetry? ──yes──▶ sleep(backoff 500/1000) → next attempt
                     └──no───▶ throw Delok*Error (rejects, now always DelokError)
```
