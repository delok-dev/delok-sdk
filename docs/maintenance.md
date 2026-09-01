# Delok SDK — Maintenance Guide

> For contributors and future maintainers. References are file:line.

## 1. Known Limitations (actual)

| Limitation | Evidence | Impact |
|---|---|---|
| No offline persistence / queue | No queue, no storage in `src/transport.ts:27` | Process exit or network outage drops logs |
| No batching | Each `info/warn/error/fatal` → one `fetch` to `DEFAULT_ENDPOINT` `src/transport.ts:107` | High-throughput apps send many requests |
| No background queue / fire-and-forget | No worker, no `queueMicrotask` | Caller `await` blocks on HTTP |
| No local storage / retry after restart | No `localStorage`/`indexedDB`/`fs` usage anywhere | No recovery |
| Limited retry (3 attempts, 500–1000ms backoff) | `src/constants.ts:31,37` | Sustained outage not covered |
| Limited error classification | Only 4 `DelokError` subclasses + base for event/unknown `src/errors/*` | Cannot distinguish DNS vs connection refused |
| No sampling / filtering / throttling | No logic in `src/Delok.ts:71` | All logs sent |
| Endpoint is internal `http://localhost:8000/api/ingestion` | `src/constants.ts:40` `DEFAULT_ENDPOINT`, used directly in `src/transport.ts:107` | Current value is local MVP placeholder; production should update constant internally — not via `DelokConfig` |
| Timeout fixed 5000ms, per-attempt | `src/constants.ts:23` + `src/transport.ts:93` | No per-call tuning |
| `response.json()` fallback uses UNKNOWN_ERROR | `src/transport.ts:127` `catch` → `UNKNOWN_ERROR` | Non-JSON error body status preserved but original parse error lost |
| No sourcemaps | `package.json:40` no `--sourcemap` | Stack traces map to `dist` |

Do not present this as a roadmap — these are observations for prioritization.

## 2. Invariants to Preserve

* **Construction validates synchronously** — never allow `new Delok` with invalid config to produce an instance that fails later `src/Delok.ts:46`. Validates only `apiKey`/`environment`; endpoint is not validated as config.
* **`track` stays private** — public surface is 4 methods only; level injection via `track` prevents custom levels `src/Delok.ts:71`. Also validates `event`.
* **Endpoint is SDK-controlled** — `DEFAULT_ENDPOINT` `src/constants.ts:40` is internal, not in `DelokConfig`, not stored on instance, imported directly in `transport.ts`. Do not re-add `endpoint`/`baseUrl`/`apiUrl` to `DelokConfig`.
* **HTTP details stay internal** — endpoint, headers, `occurredAt`, error mapping are transport-only `src/transport.ts:27`. Do not leak into public types.
* **Error hierarchy** — all SDK failures `instanceof DelokError` `src/errors/DelokError.ts:11`. Add new errors as subclasses.
* **`Promise<void>` contract** — public methods resolve to `void` on success, never return response body.

## 3. Common Change Scenarios

### Adding a tunable option (e.g., `timeout`)

1. Extend `DelokConfig` in `src/types.ts:53` with optional field.
2. Validate in `src/Delok.ts:46` (throw `DelokConfigurationError` on invalid).
3. Store on instance (`private field`) and pass via `SendLogPayload` or read directly in `transport.ts`.
4. Do not change the 4 method signatures unless necessary.
5. **Do not** add `endpoint`/`baseUrl`/`serverUrl`/`apiUrl` — endpoint is intentionally not configurable via public API.

### Adding a new log level

1. Add to `SUPPORTED_LOG_LEVELS` `src/constants.ts:17` and `LogLevel` type `src/types.ts:32`.
2. Add method on `Delok` class `src/Delok.ts`.
3. Consider backend support.

### Changing endpoint for production

1. Update `DEFAULT_ENDPOINT` in `src/constants.ts:40` directly — **not** `DelokConfig`.
2. Do not make it configurable via constructor.
3. The constant is internal; changing it requires SDK release.

### Changing retry policy

Tune `src/constants.ts:31,37,49` and `src/utils.ts:30`. Keep `shouldRetry` predicate `src/transport.ts:181` narrow — only transients.

## 4. Debugging Guide

| Symptom | Where to look |
|---|---|
| `DelokConfigurationError` at startup | `src/Delok.ts:46` — check `apiKey` emptiness / `environment` spelling |
| `DelokError: Event name cannot be empty` | `src/Delok.ts:71` — `event` is `""` or whitespace |
| `DelokNetworkError` every call | `src/transport.ts:107` internal `DEFAULT_ENDPOINT` unreachable; check constant `src/constants.ts:40` (currently `localhost:8000`) |
| `DelokTimeoutError` (5000ms) | `src/transport.ts:93` timeout 5s per attempt |
| `DelokHttpError 401` | `src/transport.ts:113` `x-api-key` header; verify `apiKey` |
| `DelokHttpError 400` | Backend validation of `event/payload`; check `TrackPayload` shape `src/types.ts:91` |
| Stack trace points to `dist/` | No sourcemaps (`package.json:40`); rebuild with `--sourcemap` |

## 5. Testing Status

Tests — `vitest run` (26 tests):

* `tests/config.test.ts` (6): valid configs, empty/whitespace `apiKey`, invalid `environment`, endpoint not exposed / ignored, instance has no `endpoint` field.
* `tests/public-api.test.ts` (7): public exports, level injection, `Promise<void>`, `event` validation, internal endpoint used, evil endpoint ignored, `DEFAULT_ENDPOINT` not exported.
* `tests/transport.test.ts` (13): retry then success, timeout retry, network retry, exhaustion, 502/503/504, 400/401 no retry, status preservation valid/invalid JSON, timeout `ms` unit, attempts/duration, unknown fallback, backoff 500/1000, no console.info.

## 6. Publish Checklist

1. `DEFAULT_ENDPOINT` in `src/constants.ts:40` is `http://localhost:8000/api/ingestion` — actual implementation (local MVP). For production, update the constant internally before publish — do not require consumer to pass endpoint.
2. `npm test` — 26 tests pass.
3. `npm run build` — verify `dist/index.{js,mjs,d.ts}` emitted.
4. `npm pack` — inspect tarball contains `dist`, `README.md`, `LICENSE`, not `src`; verify `dist/index.d.ts` has `DelokConfig` with only `apiKey`+`environment`.
5. Verify `package.json: version` bump and `exports` + `engines >=18`.
6. Tag git and push.

## 7. Open Questions (mark as unclear)

* **No `tsup.config.ts`** — unclear if bundling should stay CLI-only or grow a config. Left as CLI for now.
* **Backend contract evolution** — `DelokApiErrorResponse` shape `src/types.ts:228` mirrors current backend; no versioning noted.
* **Per-attempt vs cumulative duration** — currently per-attempt. Intentionally kept. Mark if change desired.

Fixed/retired questions: endpoint now intentionally internal (not configurable), `console.info` removed, timeout unit fixed, JSON parse hardened.

## 8. Source Reference Index

```
Delok class            src/Delok.ts:38
track (with event)     src/Delok.ts:71
info/warn/error/fatal  src/Delok.ts:87/124/162/200
types                  src/types.ts (Environment 23, LogLevel 32, DelokConfig 53 {apiKey, environment}, TrackPayload 91, SendLogPayload 160 {apiKey, environment, data}, DelokErrorMetadata 172)
constants              src/constants.ts (env 7, levels 17, timeout 23, retries 31, backoff 37, DEFAULT_ENDPOINT 40 internal, codes 49)
transport/sendLog      src/transport.ts:27 (normalizes to DelokError, no console)
performRequest         src/transport.ts:85 (uses DEFAULT_ENDPOINT, JSON try/catch, ms unit)
shouldRetry            src/transport.ts:181
utils                  src/utils.ts:9
errors                 src/errors/*.ts
entry/exports          src/index.ts:10 (does NOT export DEFAULT_ENDPOINT)
build                  package.json:40, tsconfig.json:1, vitest.config.ts:1
tests                  tests/*.test.ts (26)
```
