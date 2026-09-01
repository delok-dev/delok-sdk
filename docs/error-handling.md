# Delok SDK — Error Handling

> Sources: `src/errors/*`, `src/transport.ts:144`, `src/Delok.ts:46`, `src/types.ts:172`. Verified by `tests/transport.test.ts` and `tests/config.test.ts`.

## 1. Error Hierarchy

```
Error
 └─ DelokError<TMetadata>               src/errors/DelokError.ts:11 — base, { metadata?: TMetadata }
     ├─ DelokConfigurationError          src/errors/DelokConfigurationError.ts:9 — config (apiKey, environment)
     ├─ DelokTimeoutError                src/errors/DelokTimeoutError.ts:7
     ├─ DelokNetworkError                src/errors/DelokNetworkError.ts:7
     └─ DelokHttpError<DelokHttpErrorMetadata>  src/errors/DelokHttpError.ts:14
     └─ (base DelokError) for event validation and unknown fallback
```

All SDK errors are `instanceof DelokError`. Endpoint removal does not introduce a new error type.

## 2. Configuration Errors

**When:** `new Delok({apiKey, environment})` with invalid config — `src/Delok.ts:46`.

| Condition | Check | Error |
|---|---|---|
| `apiKey` empty / whitespace / non-string | `isValidString` `src/utils.ts:9` | `DelokConfigurationError("API Key cannot be empty.")` |
| `environment` not in `["development","staging","production"]` | `SUPPORTED_ENVIRONMENTS.includes` `src/Delok.ts:50` | `DelokConfigurationError("Invalid environment. Expected one of: development, staging, production.")` |

* No `endpoint` configuration error — endpoint is no longer part of `DelokConfig`, so no `Endpoint cannot be empty` path exists. Any extra `endpoint` property passed via `as any` is ignored, not validated.
* Thrown **synchronously**.

## 3. Payload Validation Error

**When:** `delok.info({event: ""})` — `src/Delok.ts` `track()`.

* `!isValidString(data.event)` → `DelokError("Event name cannot be empty.")` — base class, not retryable. Handled internally without unhandled rejection.

## 4. Request Errors (transport)

All other errors are asynchronous delivery failures — `delok.info()` returns `void` immediately and failures are handled internally after retries. Each error carries `metadata: {attempts, duration}` plus extra fields for HTTP. No Promise is returned to the caller and no console output is produced.

### 4.1 Timeout — `DelokTimeoutError`

* **Cause:** `fetch(DEFAULT_ENDPOINT)` exceeded `5000ms` and `AbortController` aborted — `src/transport.ts:93,157`.
* **Message:** `Request timeout after 5000ms` — fixed from `seconds`.

### 4.2 Network — `DelokNetworkError`

* **Cause:** `fetch` rejection not `AbortError` — `src/transport.ts:163`.

### 4.3 HTTP — `DelokHttpError`

* **Cause:** `response.ok === false` — `src/transport.ts:122`.
* **Parsing:** `try { response.json() } catch { UNKNOWN_ERROR fallback }` — status preserved.
* **Retry:** only if `status` in `[500,502,503,504]` `src/constants.ts:49`.

### 4.4 Retry Exhaustion

After 3 failures where each was retryable, last error with `attempts: 3` thrown. No endpoint-related exhaustion.

### 4.5 Unexpected Errors

In `sendLog` `src/transport.ts:48` and `performRequest` `src/transport.ts:170` — now always `DelokError` with metadata, including event validation failures which are not retried.

## 5. Metadata Reference

```ts
interface DelokErrorMetadata { attempts?: number; duration?: number; } // src/types.ts:172
interface DelokHttpErrorMetadata extends DelokErrorMetadata { status: number; error: DelokApiError; } // src/types.ts:191
```

* `attempts` — attempt number (1..3), per-attempt.
* `status` + `error.code/message` — only on `DelokHttpError`, `UNKNOWN_ERROR` when body not JSON.

## 6. Consumer Handling Pattern

Logging is fire-and-forget:

```ts
import { Delok } from "delok";
const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "production",
});

delok.info({ event: "user_login" });
```

Failures are handled internally and do not require `await` or `catch`. Constructor validation still throws synchronously and can be caught with `try/catch`.

### Endpoint removal note

Previously a `DelokConfigurationError("Endpoint cannot be empty.")` existed when `endpoint` was part of `DelokConfig`. That path is now removed. There is **no** endpoint-related configuration error. If `DEFAULT_ENDPOINT` is unreachable, it surfaces as `DelokNetworkError`/`DelokTimeoutError`/`DelokHttpError` like any other transport failure — not as a configuration error.

## 7. Hardened Fixes Summary

| Issue | Before | After | Test |
|---|---|---|---|
| Timeout unit | `5000 seconds` | `5000ms` | timeout message uses ms |
| JSON parse loses status | `await response.json()` unguarded → `DelokNetworkError` | `try/catch` → `UNKNOWN_ERROR` with status | preserves status |
| Unknown fallback not DelokError | `new Error("Unknown...")` | `new DelokError("Unknown...", {attempts,duration})` | unknown becomes DelokError |
| Event empty passes | no check | `isValidString(event)` → `DelokError` | event validation |
| Endpoint configurable | `endpoint?: string` in DelokConfig, validated, propagated | Removed — internal `DEFAULT_ENDPOINT` only | evil endpoint ignored, uses internal |
