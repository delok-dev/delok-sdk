# Delok SDK — Internal Architecture

> **Source of truth:** `src/` — this document describes the implementation as of `v0.1.0` post-hardening (`src/Delok.ts:38`, `src/transport.ts:27`, `src/types.ts:53`). Verified by `tests/*.test.ts`.

## 1. SDK Architecture Audit

```
Entry point:        src/index.ts (re-exports)       — package entry is src/index.ts per package.json:39 `tsup src/index.ts`
Main class:         src/Delok.ts:38 `class Delok { apiKey, environment, endpoint }`
Public API:         constructor({apiKey, environment, endpoint?}) + info/warn/error/fatal  — src/Delok.ts:62,117+
Internal API:       private track() with event validation src/Delok.ts:94, sendLog src/transport.ts:27, performRequest src/transport.ts:90, shouldRetry src/transport.ts:179, utils src/utils.ts:9
HTTP layer:         native fetch POST endpoint (default DEFAULT_ENDPOINT localhost:8000/api/ingestion, override via DelokConfig.endpoint)  src/transport.ts:112 src/constants.ts:48
Configuration:      DelokConfig {apiKey, environment, endpoint?} src/types.ts:53 — validated synchronously in src/Delok.ts:62
Timeout:            AbortController + setTimeout(5000ms) per attempt, message 5000ms  src/transport.ts:98,162 and src/constants.ts:23
Retry:              sendLog loop, DEFAULT_MAX_RETRIES=2, exponential backoff 500*2^(n-1), no console.info  src/transport.ts:36 and src/constants.ts:31,37
Error handling:     DelokError hierarchy (now all rejections are DelokError, JSON fallback UNKNOWN_ERROR)  src/errors/DelokError.ts:11 src/transport.ts:126
Build:              tsup --format esm,cjs --dts  package.json:39, no tsup.config.* file, tsconfig ES2022 strict tsconfig.json:2, engines >=18, vitest tests
Package exports:    "." -> dist/index.js/.mjs/.d.ts  package.json:31
Tests:              tests/config.test.ts, tests/public-api.test.ts, tests/transport.test.ts (26 tests)
```

## 2. Project Structure (actual)

```
delok-sdk/
├── src/
│   ├── index.ts              # package entry, public re-exports only
│   ├── Delok.ts              # Delok class — sole public class (endpoint, event validation)
│   ├── types.ts              # public types + internal payload/context types (SendLogPayload now includes endpoint)
│   ├── constants.ts          # supported values, timeout, retry tuning, DEFAULT_ENDPOINT
│   ├── transport.ts          # HTTP + timeout + retry + error mapping (hardened)
│   ├── utils.ts              # isValidString, sleep, getRetryDelay
│   └── errors/
│       ├── DelokError.ts              # base
│       ├── DelokConfigurationError.ts
│       ├── DelokHttpError.ts
│       ├── DelokNetworkError.ts
│       └── DelokTimeoutError.ts
├── tests/
│   ├── config.test.ts        # 8 tests
│   ├── public-api.test.ts    # 5 tests
│   └── transport.test.ts     # 13 tests
├── dist/                     # build output (tsup) — not committed as source
├── vitest.config.ts          # test config (node, include tests/**/*.test.ts)
├── package.json              # build + test scripts, engines >=18
├── tsconfig.json             # rootDir src, strict, declaration
├── README.md                 # end-user docs (not internal)
└── .npmignore / .gitignore
```

`vitest.config.ts` added; `tests/` now exists with 26 tests. No `tsup.config.ts`, no `examples/`.

## 3. High-Level Architecture

```
Application code
      │
      ▼
  Delok (src/Delok.ts:38)  — validates config (apiKey, environment, endpoint, event), exposes 4 log methods
      │
      ├── info()  ──┐
      ├── warn()   ─┤
      ├── error()  ─┤──▶ private track(data: TrackPayload)  src/Delok.ts:94 (event validation)
      └── fatal()  ──┘         │
                               ▼
                      sendLog(payload: SendLogPayload {endpoint})  src/transport.ts:27
                               │  loop up to 3 attempts, exponential backoff, no console.info, all errors → DelokError
                               ▼
                      performRequest(payload, context)  src/transport.ts:90
                               │  AbortController timeout 5000ms (5000ms message), fetch POST endpoint
                               │  JSON parse try/catch → UNKNOWN_ERROR fallback
                               ▼
                      Delok Backend  POST endpoint (DEFAULT_ENDPOINT or config.endpoint)
                               │
                               ▼
                      response.ok ? return void : throw DelokHttpError
```

**Key boundary:** `Delok` is the only stateful object (stores `apiKey`, `environment`, `endpoint`). Everything below `track()` is stateless per-request.

## 4. Public / Internal Boundary

### PUBLIC — visible to consumers via `src/index.ts:10`

| Symbol | Source | Notes |
|---|---|---|
| `Delok` | `src/Delok.ts:38` | sole class |
| `constructor(config)` | `src/Delok.ts:62` | validates, throws `DelokConfigurationError` |
| `info/warn/error/fatal` | `src/Delok.ts:117,154,192,231` | `Promise<void>`, accept `Omit<TrackPayload,"level">` |
| `DelokConfig` | `src/types.ts:53` | `{apiKey, environment, endpoint?}` |
| `TrackPayload` | `src/types.ts:97` | `{event, level, message?, payload?}` — callers omit `level`, `event` now validated via `isValidString` in track() |
| `Environment` | `src/types.ts:23` | `"development"\|"staging"\|"production"` |
| `LogLevel` | `src/types.ts:32` | `"info"\|"warn"\|"error"\|"fatal"` |
| `DelokError` | `src/errors/DelokError.ts:11` | base, `metadata?: DelokErrorMetadata` |
| `DelokConfigurationError` | `src/errors/DelokConfigurationError.ts:9` | sync, no retry metadata |
| `DelokHttpError` | `src/errors/DelokHttpError.ts:17` | `metadata: DelokHttpErrorMetadata {status, error:{code,message}}` |
| `DelokNetworkError` | `src/errors/DelokNetworkError.ts:18` | network unreachable |
| `DelokTimeoutError` | `src/errors/DelokTimeoutError.ts:18` | AbortError → timeout |
| `DelokErrorMetadata` | `src/types.ts:160` | `{attempts?, duration?}` |
| `DelokHttpErrorMetadata` | `src/types.ts:183` | extends above + `status, error` |
| `DelokApiError` | `src/types.ts:203` | `{code, message}` |

### INTERNAL — not re-exported from `src/index.ts`

| Symbol | Source | Role |
|---|---|---|
| `private track()` | `src/Delok.ts:94` | validates `event`, delegates to `sendLog`, injects `apiKey/environment/endpoint` |
| `sendLog` | `src/transport.ts:27` | retry loop, normalizes unknown → DelokError, no console.info |
| `performRequest` | `src/transport.ts:90` | single fetch to `endpoint` + timeout (5000ms) + JSON fallback + error mapping |
| `shouldRetry` | `src/transport.ts:179` | predicate for retry |
| `SendLogPayload` | `src/types.ts:155` | `{apiKey, environment, endpoint, data}` |
| `RequestContext` | `src/types.ts:239` | `{attempt, startedAt}` per-attempt |
| `RetryableStatus` | `src/types.ts:40` | `500|502|503|504` |
| `DelokApiErrorResponse` | `src/types.ts:228` | backend envelope `{success:false, error, timestamp}` |
| `SUPPORTED_ENVIRONMENTS/LOG_LEVELS` | `src/constants.ts:7,17` | validation sources |
| `DEFAULT_ENDPOINT` | `src/constants.ts:48` | `http://localhost:8000/api/ingestion` default |
| `DEFAULT_REQUEST_TIMEOUT` | `src/constants.ts:23` | `5000` |
| `DEFAULT_MAX_RETRIES` | `src/constants.ts:31` | `2` |
| `BASE_RETRY_DELAY` | `src/constants.ts:37` | `500` |
| `RETRYABLE_STATUS_CODES` | `src/constants.ts:57` | `[500,502,503,504]` |
| `isValidString/sleep/getRetryDelay` | `src/utils.ts:9` | validation, delay, backoff |

**Enforcement:** `track` is `private`; `sendLog` is `export` from `transport.ts` but **not** re-exported from `src/index.ts`, so it is invisible to consumers through the package entry.

## 5. Module Dependency Graph

```
index.ts ──▶ Delok.ts ──▶ constants.ts (SUPPORTED_ENVIRONMENTS)
         │            ──▶ errors/DelokConfigurationError
         │            ──▶ transport.ts ──▶ constants.ts (RETRYABLE..., timeout, retries)
         │            │                ──▶ errors/* (4 types)
         │            │                ──▶ types.ts (SendLogPayload, RequestContext, RetryableStatus)
         │            │                ──▶ utils.ts (sleep, getRetryDelay)
         │            ──▶ types.ts (DelokConfig, TrackPayload, Environment)
         │            ──▶ utils.ts (isValidString)
         ──▶ errors/* (re-export)
         ──▶ types.ts (re-export public types)
```

No circular dependencies. `constants.ts` and `utils.ts` are leaves.

## 6. Observed Design Decisions

| Decision | Observed implementation | Documented rationale vs likely rationale |
|---|---|---|
| `track` private, 4 fixed methods | `src/Delok.ts:94` private; `info/warn/error/fatal` set `level` internally | No ADR in repo. **Likely:** enforce type-safe levels, prevent custom levels. Marked as inference. |
| Backend owns business rules, minimal client validation | `src/types.ts:86` + `src/Delok.ts:94` now validates `event` via `isValidString` only — lightweight structural check, rest server-side | **Hardened:** minimal event validation added; still no business rules in client. |
| Lightweight, no queue/batching | No queue, no storage, no batch API in `transport.ts` | No explicit doc. **Likely:** keep SDK minimal, avoid persistence complexity. Inference. |
| `fetch` over `axios` | `src/transport.ts:112` native `fetch` | No doc. **Likely:** zero-dependency, works in Node 18+ and browsers. Inference. |
| Endpoint configurable | `src/constants.ts:48` `DEFAULT_ENDPOINT` + `src/types.ts:53` `endpoint?` + `src/Delok.ts:77` fallback | **Hardened:** optional `endpoint` with validation; default keeps MVP compat but allows production override. |
| Timeout via `AbortController` | `src/transport.ts:98` per-attempt controller, message fixed to `5000ms` | **Hardened:** unit bug fixed. |

Do not treat "likely" rows as authoritative.
