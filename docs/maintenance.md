# Delok SDK — Maintenance Guide

> For contributors and future maintainers. References are file:line. Distinguish observed implementation from inferred rationale.

## 1. Known Limitations (actual)

| Limitation | Evidence | Impact |
|---|---|---|
| Nooffline persistence / queue | No queue, no storage in `src/transport.ts:27` | Process exit or network outage drops logs |
| No batching | Each `info/warn/error/fatal` → one `fetch` `src/transport.ts:112` | High-throughput apps send many requests |
| No background queue / fire-and-forget | No worker, no `queueMicrotask` | Caller `await` blocks on HTTP |
| No local storage / retry after restart | No `localStorage`/`indexedDB`/`fs` usage anywhere | No recovery |
| Limited retry (3 attempts, 500–1000ms backoff) | `src/constants.ts:31,37` | Sustained outage not covered |
| Limited error classification | Only 4 `DelokError` subclasses + base for event/unknown `src/errors/*` | Cannot distinguish DNS vs connection refused |
| No sampling / filtering / throttling | No logic in `src/Delok.ts:94` | All logs sent |
| Endpoint defaults to localhost | `src/constants.ts:48` `DEFAULT_ENDPOINT`, override via `config.endpoint` `src/Delok.ts:69` | Must override for production; default kept for MVP compat |
| Timeout fixed 5000ms, per-attempt | `src/constants.ts:23` + `src/transport.ts:98` | No per-call tuning |
| `response.json()` fallback uses UNKNOWN_ERROR | `src/transport.ts:128` `catch` → `UNKNOWN_ERROR` | Non-JSON error body status preserved but original parse error lost |
| No sourcemaps | `package.json:40` no `--sourcemap` | Stack traces map to `dist` |

Do not present this as a roadmap — these are observations for prioritization.

## 2. Invariants to Preserve

* **Construction validates synchronously** — never allow `new Delok` with invalid config to produce an instance that fails later `src/Delok.ts:62`. Now also validates `endpoint` and `event` (in `track`).
* **`track` stays private** — public surface is 4 methods only; level injection via `track` prevents custom levels `src/Delok.ts:94`. Now also does `event` validation.
* **HTTP details stay internal** — endpoint (now via `SendLogPayload.endpoint`), headers, `occurredAt`, error mapping are transport-only `src/transport.ts:27`. Do not leak into public types beyond `DelokConfig.endpoint?`.
* **Error hierarchy** — all SDK failures now `instanceof DelokError` `src/errors/DelokError.ts:11` — including event validation, unknown fallback, and JSON fallback (always `DelokHttpError`). Add new errors as subclasses.
* **`Promise<void>` contract** — public methods resolve to `void` on success, never return response body `src/Delok.ts:117`. No retry logging to `console`.

## 3. Common Change Scenarios

### Adding a tunable option (e.g., `timeout`)

1. Extend `DelokConfig` in `src/types.ts:53` with optional field.
2. Validate in `src/Delok.ts:62` (throw `DelokConfigurationError` on invalid).
3. Store on instance (`private field`) and pass via `SendLogPayload` or read directly in `transport.ts`.
4. Do not change the 4 method signatures unless necessary.

Reference: endpoint addition did exactly this — `endpoint?: string`, `isValidString` validation, `DEFAULT_ENDPOINT` fallback, `SendLogPayload.endpoint` — minimal.

### Adding a new log level

1. Add to `SUPPORTED_LOG_LEVELS` `src/constants.ts:17` and `LogLevel` type `src/types.ts:32`.
2. Add method on `Delok` class `src/Delok.ts`.
3. Consider backend support — ingestion API must accept the new `level`.

### Changing retry policy

Tune `src/constants.ts:31,37,57` and `src/utils.ts:30`. Keep `shouldRetry` predicate `src/transport.ts:179` narrow — only transients. No `console.info` — keep silent.

## 4. Debugging Guide

| Symptom | Where to look |
|---|---|
| `DelokConfigurationError` at startup | `src/Delok.ts:62` — check `apiKey` emptiness / `environment` spelling / `endpoint` emptiness |
| `DelokError: Event name cannot be empty` | `src/Delok.ts:94` — `event` is `""` or whitespace |
| `DelokNetworkError` every call | `src/transport.ts:112` endpoint unreachable; check `config.endpoint` or default `DEFAULT_ENDPOINT` `src/constants.ts:48` |
| `DelokTimeoutError` (5000ms) | `src/transport.ts:98` timeout 5s per attempt; increase `DEFAULT_REQUEST_TIMEOUT` or check backend latency |
| `DelokHttpError 401` | `src/transport.ts:117` `x-api-key` header; verify `apiKey` |
| `DelokHttpError 400` | Backend validation of `event/payload`; check `TrackPayload` shape `src/types.ts:97` — `event` now pre-validated |
| `DelokHttpError UNKNOWN_ERROR` | `src/transport.ts:128` response body not JSON; status preserved, parse error fallback |
| Stack trace points to `dist/` | No sourcemaps (`package.json:40`); rebuild with `--sourcemap` for mapping |

## 5. Testing Status

Tests now exist — `vitest run` (26 tests):

* `tests/config.test.ts` (8): valid configs, empty/whitespace `apiKey`, invalid `environment`, `endpoint` default/custom/validation.
* `tests/public-api.test.ts` (5): public exports, level injection, `Promise<void>`, `event` validation, endpoint propagation.
* `tests/transport.test.ts` (13): retry then success, timeout retry, network retry, exhaustion, 502/503/504, 400/401 no retry, status preservation valid/invalid JSON, timeout `ms` unit, attempts/duration, unknown fallback, backoff 500/1000, no console.info.

Run `npm test` (vitest run) and `npm run build` + `npx tsc --noEmit` in CI. `vitest.config.ts` is `node` environment, `include: tests/**/*.test.ts`.

## 6. Publish Checklist

1. Set `config.endpoint` to production URL or ensure consumer does; default `localhost` is MVP placeholder — do not publish with default for prod without note.
2. Timeout message already fixed to `ms` — no action.
3. `npm test` — 26 tests pass.
4. `npm run build` — verify `dist/index.{js,mjs,d.ts}` emitted (14.19 KB / 12.98 KB / 18.59 KB).
5. `npm pack` — inspect tarball contains `dist`, `README.md`, `LICENSE`, not `src`.
6. Verify `package.json: version` bump and `exports` + `engines >=18`.
7. Tag git and push.

## 7. Open Questions (mark as unclear)

* **No `tsup.config.ts`** — unclear if bundling should stay CLI-only or grow a config. Left as CLI for now.
* **Backend contract evolution** — `DelokApiErrorResponse` shape `src/types.ts:228` mirrors current backend; no versioning noted.
* **Per-attempt vs cumulative duration** — currently per-attempt `performance.now()-startedAt`. Intentionally kept per-attempt for diagnosability; cumulative would need outer timer. Documented as such; mark if change desired.

Fixed/retired questions: `console.info` removed (now silent), endpoint configurable (was hardcoded), timeout unit fixed, JSON parse hardened.

## 8. Source Reference Index

```
Delok class            src/Delok.ts:38
track (with event)     src/Delok.ts:94
info/warn/error/fatal  src/Delok.ts:117/154/192/231
types                  src/types.ts (Environment 23, LogLevel 32, DelokConfig 53, TrackPayload 97, SendLogPayload 155, DelokErrorMetadata 172)
constants              src/constants.ts (env 7, levels 17, timeout 23, retries 31, backoff 37, DEFAULT_ENDPOINT 48, codes 57)
transport/sendLog      src/transport.ts:27 (normalizes to DelokError, no console)
performRequest         src/transport.ts:90 (endpoint param, JSON try/catch, ms unit)
shouldRetry            src/transport.ts:179
utils                  src/utils.ts:9
errors                 src/errors/*.ts (now all rejections are DelokError)
entry/exports          src/index.ts:10
build                  package.json:40, tsconfig.json:1, vitest.config.ts:1
tests                  tests/*.test.ts (26)
```
