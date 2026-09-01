# Delok SDK — Error Handling

> Sources: `src/errors/*`, `src/transport.ts:144`, `src/Delok.ts:62`, `src/types.ts:172`. Verified by `tests/transport.test.ts` and `tests/config.test.ts`.

## 1. Error Hierarchy

```
Error
 └─ DelokError<TMetadata>               src/errors/DelokError.ts:11 — base, { metadata?: TMetadata }
     ├─ DelokConfigurationError          src/errors/DelokConfigurationError.ts:9
     ├─ DelokTimeoutError                src/errors/DelokTimeoutError.ts:7
     ├─ DelokNetworkError                src/errors/DelokNetworkError.ts:7
     └─ DelokHttpError<DelokHttpErrorMetadata>  src/errors/DelokHttpError.ts:14
     └─ (base DelokError) for event validation and unknown fallback
```

All SDK errors are now `instanceof DelokError` — including the hardened fallbacks. Previously `Unknown transport error` was plain `Error` and non-`Error` throwables escaped as-is. Now every rejection from public methods is `DelokError`.

## 2. Configuration Errors

**When:** `new Delok({apiKey, environment, endpoint?})` with invalid config — `src/Delok.ts:62`.

| Condition | Check | Error |
|---|---|---|
| `apiKey` empty / whitespace / non-string | `isValidString` `src/utils.ts:9` | `DelokConfigurationError("API Key cannot be empty.")` `src/Delok.ts:28` |
| `environment` not in `["development","staging","production"]` | `SUPPORTED_ENVIRONMENTS.includes` `src/Delok.ts:31` | `DelokConfigurationError("Invalid environment. Expected one of: development, staging, production.")` |
| `endpoint` provided but empty/whitespace | `isValidString` `src/Delok.ts:69` | `DelokConfigurationError("Endpoint cannot be empty.")` |

* Thrown **synchronously** — no `Promise`, no `metadata`. Catch with `try/catch` around construction.
* Never retried — occurs before any HTTP. Tested in `tests/config.test.ts`.

## 3. Payload Validation Error

**When:** `await delok.info({event: ""})` etc. — `src/Delok.ts:94`.

* Check: `!isValidString(data.event)` — rejects `""` and `"   "`.
* Error: `DelokError("Event name cannot be empty.")` — base class, not `DelokConfigurationError`, with no `metadata` (validation before request). Not retryable (`shouldRetry` does not include base `DelokError`).
* Thrown inside `async track()` → becomes rejected `Promise`. Tested in `tests/public-api.test.ts`.

## 4. Request Errors (transport)

All other errors are thrown **asynchronously** — `await delok.info()` rejects. Each carries `metadata: {attempts, duration}` plus extra fields for HTTP.

### 4.1 Timeout — `DelokTimeoutError`

* **Cause:** `fetch` exceeded `DEFAULT_REQUEST_TIMEOUT 5000ms` and `AbortController` aborted — `src/transport.ts:98,158`.
* **Mapping:** `error.name === "AbortError"` → `DelokTimeoutError` `src/transport.ts:158`.
* **Message:** `` `Request timeout after ${DEFAULT_REQUEST_TIMEOUT}ms` `` — fixed from `seconds`. Verified.
* **Metadata:** `{ attempts: context.attempt, duration: performance.now()-startedAt }` — per-attempt, not cumulative. Intentionally per-attempt (see reliability.md).
* **Retry:** yes — `shouldRetry` includes it `src/transport.ts:184`. After 3 timeouts, the third `DelokTimeoutError` is thrown with `attempts: 3`.

### 4.2 Network — `DelokNetworkError`

* **Cause:** native `fetch` rejection not due to `AbortError` — DNS failure, connection refused, offline — `src/transport.ts:167`.
* **Mapping:** `else` branch for any other `Error` → `DelokNetworkError("Network error when sending log", metadata)` `src/transport.ts:167`.
* **Retry:** yes.

### 4.3 HTTP — `DelokHttpError`

* **Cause:** `response.ok === false` (status outside 200-299) — `src/transport.ts:126`.
* **Parsing (hardened):**

```ts
let apiError;
try { const result = await response.json(); apiError = {code: result.error.code, message: result.error.message}; }
catch { apiError = {code: "UNKNOWN_ERROR", message: response.statusText || `HTTP ${status}`}; }
```

Previously `await response.json()` without `try/catch` — SyntaxError was caught lower as generic `Error` and mapped to `DelokNetworkError`, losing status. Now status is preserved with fallback `UNKNOWN_ERROR`. Tested in `tests/transport.test.ts` for both valid and invalid JSON.

* **Throw:** `DelokHttpError("The Delok server responded with HTTP ${status}.", {status, attempts, duration, error: apiError})` `src/transport.ts:135`.
* **Metadata:** `DelokHttpErrorMetadata` `src/types.ts:191` — `{status, error:{code,message}, attempts, duration}`.
* **Retry:** only if `status` in `RETRYABLE_STATUS_CODES [500,502,503,504]` `src/constants.ts:57`. Others (400,401,403,404) thrown immediately.

### 4.4 Retry Exhaustion

* **What happens:** after `totalAttempts = 3` failures where each was retryable, `shouldRetry` returns `false` for the last attempt (`hasNextAttempt === false` `src/transport.ts:181`), so the error is re-thrown.
* **Result:** caller sees a single `DelokTimeoutError` / `DelokNetworkError` / `DelokHttpError` with `metadata.attempts === 3`. Tested.

### 4.5 Unexpected Errors (hardened)

* **In `sendLog`** `src/transport.ts:48`:

```ts
if (!shouldRetry(error, hasNextAttempt)) {
  if (error instanceof DelokError) throw error;
  if (error instanceof Error) throw new DelokError(error.message, {attempts, duration});
  throw new DelokError("Unknown transport error", {attempts, duration});
}
```

Previously last branch was `throw new Error("Unknown transport error")` — not `instanceof DelokError`. And non-`Error` throwables were not wrapped.

* **In `performRequest`** `src/transport.ts:171`:

```ts
throw new DelokError(String(error), {attempts, duration});
```

Previously `throw error` re-threw raw non-`Error`. Now normalized.

* **Result:** every rejection from public methods is `instanceof DelokError`. Tested in `tests/transport.test.ts` ("unknown transport error becomes DelokError").

## 5. Metadata Reference

```ts
interface DelokErrorMetadata { attempts?: number; duration?: number; } // src/types.ts:172
interface DelokHttpErrorMetadata extends DelokErrorMetadata { status: number; error: DelokApiError; } // src/types.ts:191
interface DelokApiError { code: string; message: string; } // src/types.ts:215
```

* `attempts` — attempt number that produced the final error (1..3). Present on all transport errors, absent on config/payload validation before request.
* `duration` — ms spent on that attempt (`performance.now() - startedAt`). Browser `performance.now` has sub-ms precision; Not cumulative per design — per-attempt diagnosability. Documented as such; cumulative would require outer `startedAt`.
* `status` + `error.code/message` — only on `DelokHttpError`. `UNKNOWN_ERROR` when body not JSON.

## 6. Consumer Handling Pattern

```ts
import { Delok, DelokError, DelokHttpError } from "delok";
try {
  await delok.info({ event: "user_login" });
} catch (e) {
  if (e instanceof DelokHttpError) {
    // permanent (401) vs retryable (500) — check e.metadata?.status
  } else if (e instanceof DelokError) {
    // network/timeout/event validation/unknown — e.metadata?.attempts / duration, e.message
  } else {
    // should no longer happen — all SDK errors are DelokError
  }
}
```

## 7. Hardened Fixes Summary

| Issue | Before | After | Test |
|---|---|---|---|
| Timeout message unit | `5000 seconds` | `5000ms` (derived from constant) | timeout message uses ms unit |
| JSON parse failure loses status | `await response.json()` unguarded → `DelokNetworkError` | `try/catch` → `UNKNOWN_ERROR` with status preserved | preserves status on invalid JSON |
| Unknown fallback not DelokError | `new Error("Unknown...")` | `new DelokError("Unknown...", {attempts,duration})` | unknown becomes DelokError |
| Non-Error throwable escapes | `throw error` raw | `throw new DelokError(String(error))` | unknown becomes DelokError |
| Event empty passes through | no check | `isValidString(event)` in `track()` → `DelokError` | event validation fails fast |
