# Delok SDK — Reliability

> Covers timeout, retry, and the combined reliability model. Sources: `src/transport.ts:27`, `src/constants.ts:23`, `src/utils.ts:18`, `src/types.ts:172`. Verified by `tests/transport.test.ts`.

## 1. Why Reliability Mechanisms Exist

Logging must not break the host application. Without protection, a slow or unreachable backend would hang event loops or fail permanently on transient blips. The SDK adds two lightweight guards:

* **Timeout** — bounds each HTTP attempt so the caller regains control.
* **Retry** — masks transient network/server hiccups.

Both are intentionally minimal — no queue, no persistence — to keep the SDK lightweight (see architecture.md).

## 2. Timeout Mechanism

### 2.1 Problem

`fetch` has no built-in timeout. Without one, a hung ingestion endpoint (`DEFAULT_ENDPOINT` internal) would leave `await delok.info()` pending indefinitely.

### 2.2 Implementation

`src/transport.ts:93` — per attempt, inside `performRequest`:

```ts
const controller = new AbortController();
const requestTimeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT);
const response = await fetch(DEFAULT_ENDPOINT, { signal: controller.signal, ... });
// ... finally { clearTimeout(requestTimeout); }
```

* **Mechanism:** `AbortController` + `setTimeout` targeting `DEFAULT_ENDPOINT` internal constant.
* **Scope:** one controller + one timer per attempt. Retries get a fresh controller — timeout does not accumulate.
* **Default:** `DEFAULT_REQUEST_TIMEOUT = 5000` (`src/constants.ts:23`) — 5 seconds per attempt.
* **Configurable?** No — not in `DelokConfig`, not via env var.
* **Endpoint:** timeout applies to internal `DEFAULT_ENDPOINT`; since endpoint is SDK-controlled, timeout behavior is uniform and not affected by developer config.
* **Cleanup:** `clearTimeout` in `finally` `src/transport.ts:175` prevents leaks.
* **Product of timeout:** caught in `src/transport.ts:157` and converted:

```ts
if (error.name === "AbortError")
  throw new DelokTimeoutError(`Request timeout after ${DEFAULT_REQUEST_TIMEOUT}ms`, {
    attempts: context.attempt, duration: performance.now() - context.startedAt
  });
```

> **Fixed:** message correctly says `5000ms` (was `5000 seconds`).

### 2.3 Interaction with Retry

Timeout is **retryable**:

```
Attempt 1 (5s timeout) ──AbortError──▶ DelokTimeoutError ──shouldRetry?──yes──▶ sleep(backoff) ──▶ Attempt 2
```

`shouldRetry` explicitly includes `DelokTimeoutError` `src/transport.ts:183`. Each retry attempt again gets its own 5s timeout. Removing endpoint configurability does **not** affect this — retry still targets internal `DEFAULT_ENDPOINT`.

### 2.4 Tradeoffs (observed)

* **Pro:** Simple, no extra dependency, works in all `fetch` environments supporting `AbortSignal`.
* **Con:** Single fixed timeout — no per-level or per-call tuning; no `AbortSignal` passthrough.

## 3. Retry Mechanism

### 3.1 Why Retry Exists

Transient failures (network blip, gateway 502, backend restart 500) often self-heal if retried quickly.

### 3.2 Implementation

**Location:** `sendLog` `src/transport.ts:27` — outer loop, not inside `performRequest`. Now fetches to internal `DEFAULT_ENDPOINT`.

### 3.3 What Triggers Retry

`shouldRetry` `src/transport.ts:181`:

```ts
hasNextAttempt && (
  e instanceof DelokTimeoutError ||
  e instanceof DelokNetworkError ||
  (e instanceof DelokHttpError && RETRYABLE_STATUS_CODES.includes(e.metadata.status))
)
```

| Error | Retried? | Source | Test |
|---|---|---|---|
| `DelokTimeoutError` | Yes | `src/transport.ts:183` | retries timeout and succeeds |
| `DelokNetworkError` | Yes | `src/transport.ts:184` | retries network and succeeds |
| `DelokHttpError` with `500,502,503,504` | Yes | `src/transport.ts:185` + `src/constants.ts:49` | 502/503/504 limited retries |
| `DelokHttpError` with `400,401,403,404` etc. | **No** | not in list | does not retry non-retryable |
| `DelokError` from event validation | No (not retryable) | not in predicate | fails fast |

Removing endpoint configuration does **not** change retryable set.

### 3.4 Attempts and Delay

* **Attempts:** `DEFAULT_MAX_RETRIES = 2` `src/constants.ts:31` ⇒ `totalAttempts = 3`.
* **Delay strategy:** exponential backoff `src/utils.ts:30`: `BASE_RETRY_DELAY * 2 ** (attempt - 1)` with `BASE_RETRY_DELAY = 500` `src/constants.ts:37` ⇒ `500, 1000`.
* **No console.info** — retry is silent.
* Verified by `tests/transport.test.ts` backoff assertions.

### 3.5 After Exhaustion

The last error (with `attempts: 3`) is thrown unchanged. Caller receives single rejected `Promise`; no aggregated cause chain. Endpoint non-configurability does not affect exhaustion.

## 4. Combined Reliability Model

```
Validation (src/Delok.ts:46 + track event 71) ──▶ fail fast, DelokError/DelokConfigurationError
        │ pass
        ▼
Timeout per attempt (src/transport.ts:93)  ──▶ DelokTimeoutError (retryable, 5000ms, targets internal endpoint)
        │
        ▼
Retry loop (src/transport.ts:38)       ──▶ transient → backoff → retry (always to same internal DEFAULT_ENDPOINT)
        │                              ──▶ permanent → throw immediately
        ▼
Error propagation (src/errors/*)       ──▶ Delok*Error with {attempts, duration, [status, error.code]}
```

Endpoint being internal is orthogonal to reliability — removing `endpoint` from `DelokConfig` does not change timeout duration, retry count, retryable errors, backoff, or error propagation. All verified by `tests/transport.test.ts` still passing after endpoint removal.

## 5. Worst-Case Timing

* All 3 attempts timeout: `3 * 5000 + 500 + 1000 = 16500ms`.
* `duration` per attempt only, not cumulative.

## 6. Tests Proving This Section

`tests/transport.test.ts` covers: retry then success, timeout retry, network retry, exhaustion, 502/503/504 retry, 400/401 no retry, status preservation valid/invalid JSON, message unit, attempts/duration, unknown fallback, backoff values, no console.info — all still pass after endpoint removal.
