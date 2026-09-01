# Delok SDK — Reliability

> Covers timeout, retry, and the combined reliability model. Sources: `src/transport.ts:27`, `src/constants.ts:23`, `src/utils.ts:18`, `src/types.ts:160`. Verified by `tests/transport.test.ts`.

## 1. Why Reliability Mechanisms Exist

Logging must not break the host application. Without protection, a slow or unreachable backend would hang event loops or fail permanently on transient blips. The SDK adds two lightweight guards:

* **Timeout** — bounds each HTTP attempt so the caller regains control.
* **Retry** — masks transient network/server hiccups.

Both are intentionally minimal — no queue, no persistence — to keep the SDK lightweight (see architecture.md).

## 2. Timeout Mechanism

### 2.1 Problem

`fetch` has no built-in timeout. Without one, a hung ingestion endpoint would leave `await delok.info()` pending indefinitely.

### 2.2 Implementation

`src/transport.ts:98` — per attempt, inside `performRequest`:

```ts
const controller = new AbortController();
const requestTimeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT);
const response = await fetch(endpoint, { signal: controller.signal, ... });
// ... finally { clearTimeout(requestTimeout); }
```

* **Mechanism:** `AbortController` + `setTimeout`. `controller.abort()` causes `fetch` to reject with `DOMException name="AbortError"`.
* **Scope:** one controller + one timer per attempt. Retries get a fresh controller — timeout does not accumulate.
* **Default:** `DEFAULT_REQUEST_TIMEOUT = 5000` (`src/constants.ts:23`) — 5 seconds per attempt.
* **Configurable?** No — not in `DelokConfig`, not via env var.
* **Cleanup:** `clearTimeout` in `finally` `src/transport.ts:173` prevents leaks on both success and error.
* **Product of timeout:** caught in `src/transport.ts:158` and converted:

```ts
if (error.name === "AbortError")
  throw new DelokTimeoutError(`Request timeout after ${DEFAULT_REQUEST_TIMEOUT}ms`, {
    attempts: context.attempt, duration: performance.now() - context.startedAt
  });
```

> **Fixed:** message now correctly says `5000ms` (was `5000 seconds`). Verified by `tests/transport.test.ts` ("timeout error message uses ms unit").

### 2.3 Interaction with Retry

Timeout is **retryable**:

```
Attempt 1 (5s timeout) ──AbortError──▶ DelokTimeoutError ──shouldRetry?──yes──▶ sleep(backoff) ──▶ Attempt 2
```

`shouldRetry` explicitly includes `DelokTimeoutError` `src/transport.ts:184`. Each retry attempt again gets its own 5s timeout. Worst-case wall time ≈ `3 * 5000 + backoff(500+1000)` ≈ 16.5s.

### 2.4 Tradeoffs (observed)

* **Pro:** Simple, no extra dependency, works in all `fetch` environments supporting `AbortSignal`.
* **Con:** Single fixed timeout — no per-level or per-call tuning; slow networks in `fatal` vs `info` treated identically. No `AbortSignal` passthrough from caller (no cancellation).

## 3. Retry Mechanism

### 3.1 Why Retry Exists

Transient failures (network blip, gateway 502, backend restart 500) often self-heal if retried quickly.

### 3.2 Implementation

**Location:** `sendLog` `src/transport.ts:27` — outer loop, not inside `performRequest`.

```ts
const totalAttempts = DEFAULT_MAX_RETRIES + 1; // 3
for (let attempt = 1; attempt <= totalAttempts; attempt++) {
  const context = { attempt, startedAt: performance.now() };
  const hasNextAttempt = attempt < totalAttempts;
  try { await performRequest(payload, context); return; }
  catch (e) { if (!shouldRetry(e, hasNextAttempt)) throw e; await sleep(getRetryDelay(attempt)); }
}
```

### 3.3 What Triggers Retry

`shouldRetry` `src/transport.ts:179`:

```ts
hasNextAttempt && (
  e instanceof DelokTimeoutError ||
  e instanceof DelokNetworkError ||
  (e instanceof DelokHttpError && RETRYABLE_STATUS_CODES.includes(e.metadata.status))
)
```

| Error | Retried? | Source | Test |
|---|---|---|---|
| `DelokTimeoutError` | Yes | `src/transport.ts:184` | retries timeout and succeeds |
| `DelokNetworkError` (fetch TypeError) | Yes | `src/transport.ts:185` | retries network and succeeds |
| `DelokHttpError` with `500,502,503,504` | Yes | `src/transport.ts:186` + `src/constants.ts:57` | 502/503/504 limited retries |
| `DelokHttpError` with `400,401,403,404` etc. | **No** | not in list | does not retry non-retryable |
| `DelokConfigurationError` | Never reaches transport | thrown in constructor | — |
| `DelokError` from event validation | No (not retryable) | not in predicate | fails fast |
| Non-`DelokError` throwable | Wrapped to `DelokError` then not retried | `src/transport.ts:50` | becomes DelokError |

### 3.4 What Does Not Trigger Retry

Permanent HTTP failures (`400 Bad Request`, `401 Unauthorized`, `403`, `404`), validation errors, and exhaustion (no attempts left). These are thrown immediately to the caller — fail-fast for actionable errors. Verified by `tests/transport.test.ts`.

### 3.5 Attempts and Delay

* **Attempts:** `DEFAULT_MAX_RETRIES = 2` `src/constants.ts:31` ⇒ `totalAttempts = 3`.
* **Delay strategy:** exponential backoff `src/utils.ts:30`:

```ts
export const getRetryDelay = (attempt: number) => BASE_RETRY_DELAY * 2 ** (attempt - 1);
```

`BASE_RETRY_DELAY = 500` `src/constants.ts:37` ⇒

```
Attempt 1 fail → sleep  500ms → Attempt 2
Attempt 2 fail → sleep 1000ms → Attempt 3
Attempt 3 fail → throw (no more sleep)
```

Verified by `tests/transport.test.ts` ("exponential backoff delays are 500 then 1000") via `vi.spyOn(utils, "sleep")`.

* **Delay impl:** `sleep(ms)` `src/utils.ts:18` = `new Promise(r => setTimeout(r, ms))`.
* No jitter. Delay is fixed per attempt number, not randomized.
* **Retry logging removed:** previously `console.info("Retrying request...")` `src/transport.ts:64` was deleted. SDK no longer writes to `console` on retry. Verified by `tests/transport.test.ts` ("does not log retry to console.info").

### 3.6 After Exhaustion

The last error (with `attempts: 3`) is thrown unchanged. Caller receives a single rejected `Promise`; no aggregated error list. Tested for timeout/network/HTTP.

### 3.7 Retry Diagram (actual behavior)

```
        Request attempt N (N=1..3)
                │
                ▼
           success? ──yes──▶ return void (resolve)
                │no
                ▼
           shouldRetry(error, hasNextAttempt)?
              ┌──┴──┐
              No   Yes
              │     │
              ▼     ▼
          throw   sleep(500*2^(N-1)) ──▶ next attempt
          Delok*Error
```

## 4. Combined Reliability Model

```
Validation (src/Delok.ts:62 + track event check 94) ──▶ fail fast, DelokError/DelokConfigurationError
        │ pass
        ▼
Timeout per attempt (src/transport.ts:98)  ──▶ DelokTimeoutError (retryable, 5000ms)
        │
        ▼
Retry loop (src/transport.ts:38)       ──▶ transient → backoff → retry
        │                              ──▶ permanent → throw immediately
        ▼
Error propagation (src/errors/*)       ──▶ Delok*Error with {attempts, duration, [status, error.code]}
```

**Mental model for maintainers:**

1. **Validate once** — bad config or empty `event` never hits the network.
2. **Bound each attempt** — 5s `AbortController` prevents hangs (per-attempt, not total).
3. **Retry only transients** — timeout/network/5xx with backoff, up to 3 tries.
4. **Surface everything** — no swallowing; caller decides via `instanceof DelokError`.

**What the model does NOT provide:**

* No offline queue or persistence — process exit discards in-flight logs.
* No batching — each `info/warn/error/fatal` is one HTTP request.
* No deduplication or idempotency key.
* No circuit breaker — bursts will retry independently.

## 5. Worst-Case Timing

* All 3 attempts timeout: `3 * 5000 + 500 + 1000 = 16500ms` plus `performance.now` overhead.
* Metadata `duration` on the final error reflects **last attempt only** (`performance.now() - context.startedAt` per `src/transport.ts:164`), not cumulative. Intentionally per-attempt — documented as such. Cumulative total would require `startedAt` outside loop; intentionally not done to keep per-attempt diagnosability. See error-handling.md.

## 6. Tests Proving This Section

`tests/transport.test.ts` covers: retry then success, timeout retry, network retry, exhaustion (3 attempts), 502/503/504 retry, 400/401 no retry, status preservation valid/invalid JSON, message unit, attempts/duration, unknown fallback, backoff values, no console.info.
