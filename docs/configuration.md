# Delok SDK — Configuration

> Source: `src/types.ts:53`, `src/Delok.ts:46`, `src/constants.ts:7`, `src/utils.ts:9`.

## 1. Configuration Object

```ts
// src/types.ts:53
interface DelokConfig {
  apiKey: string;        // required, non-empty
  environment: Environment; // required, one of 3
}
type Environment = "development" | "staging" | "production"; // src/constants.ts:7
```

`DelokConfig` intentionally contains **only developer-controlled** fields. The ingestion endpoint is **not** part of `DelokConfig` — it is SDK-controlled infrastructure (`DEFAULT_ENDPOINT`).

**Why endpoint is not configurable:**

* Endpoint belongs to Delok infrastructure — the SDK should know where Delok's ingestion API is located.
* Allowing arbitrary `endpoint: "..."` would let a developer accidentally configure `http://some-other-server` or a stale `localhost` URL in production.
* Keeping endpoint internal reduces public API surface and keeps responsibilities clear: developer provides `apiKey`/`environment` (project identity), SDK controls transport destination.
* Tested: passing `endpoint` via `as any` is ignored — SDK still uses `DEFAULT_ENDPOINT` (`tests/config.test.ts`, `tests/public-api.test.ts`).

## 2. Validation

`src/Delok.ts:46`:

```ts
constructor(config: DelokConfig) {
  if (!isValidString(config.apiKey))               // src/utils.ts:9
    throw new DelokConfigurationError("API Key cannot be empty.");
  if (!SUPPORTED_ENVIRONMENTS.includes(config.environment))
    throw new DelokConfigurationError("Invalid environment. Expected one of: development, staging, production.");
  this.apiKey = config.apiKey;
  this.environment = config.environment;
}
```

* `isValidString` — `src/utils.ts:9`: `typeof str === "string" && str.trim().length > 0`. Rejects `""`, `"   "`, non-strings (if JS caller bypasses TS).
* `SUPPORTED_ENVIRONMENTS = ["development","staging","production"] as const` — `src/constants.ts:7`. Case-sensitive, no aliases.
* No `endpoint` validation — not user-provided, so not validated in constructor. The constant `DEFAULT_ENDPOINT` is internal.
* Throws **synchronously** — caller can `try/catch` construction. No async init, no lazy validation.
* `event` validation is **not** in constructor — it is in `private track()` `src/Delok.ts:71`: `if (!isValidString(data.event)) throw new DelokError("Event name cannot be empty.");` — payload validation, not config.

## 3. Internal Representation

Private fields on `Delok` instance — `src/Delok.ts:42`:

```ts
private apiKey: string;
private environment: Environment;
```

* No `endpoint` field — endpoint is not stored on the instance. `DEFAULT_ENDPOINT` is read directly in `transport.ts:107`.
* Stored verbatim, no cloning or freezing.
* Consumed only in `private track()` → `sendLog({apiKey, environment, data})` `src/Delok.ts:77`. Not otherwise read or mutated.
* Effectively immutable after construction.

## 4. Where Configuration Flows

```
Constructor validates & stores  src/Delok.ts:46
        │
        ▼
Delok instance fields apiKey/environment
        │
        ▼
track() bundles into SendLogPayload  src/Delok.ts:74  (+ validates event)
        │
        ▼
sendLog({apiKey, environment, data})  src/transport.ts:27
        │
        ▼
performRequest reads apiKey/environment from payload + DEFAULT_ENDPOINT constant  src/transport.ts:105
        ├── header: "x-api-key": apiKey  src/transport.ts:113
        ├── body: { environment, ... }   src/transport.ts:118
        └── url: DEFAULT_ENDPOINT        src/transport.ts:107  (internal, not from config)
```

* `environment` appears in body (log metadata); `apiKey` only in header; `DEFAULT_ENDPOINT` only as fetch URL (internal).
* `occurredAt` and `level` are not config — generated per request.

```
DelokConfig (developer)        SDK infrastructure (internal)
  apiKey  ──────────────┐        DEFAULT_ENDPOINT  ──┐
  environment ──────────┼────▶   timeout 5000ms     ─┤
                        │        retry policy        ─┼──▶ performRequest → fetch
  event/message/payload ┘        transport behavior ──┘
```

## 5. What Is Not Configurable

| Concern | Current value | Location | Developer-configurable? |
|---|---|---|---|
| Endpoint URL | `DEFAULT_ENDPOINT = http://localhost:8000/api/ingestion` **internal** | `src/constants.ts:40` + `src/transport.ts:107` | **No** — intentionally SDK-controlled (see §1). No `endpoint`/`baseUrl`/`apiUrl` in `DelokConfig`. |
| Request timeout | `5000` ms | `src/constants.ts:23` | No |
| Max retries | `2` | `src/constants.ts:31` | No |
| Retry delay | `500 * 2^(n-1)` | `src/constants.ts:37` + `src/utils.ts:30` | No |
| Retryable codes | `[500,502,503,504]` | `src/constants.ts:49` | No |
| Log levels | `["info","warn","error","fatal"]` | `src/constants.ts:17` | No |
| Batching/sampling | none | — | No — feature gap |

All tuning constants are `export` from `constants.ts` but not re-exported from `src/index.ts` — internal by convention. `DEFAULT_ENDPOINT` is also internal — not exposed via public package API.

## 6. Relationship to Request Behavior

* Invalid config → construction throws `DelokConfigurationError` before any network activity; no retry, no metadata.
* Valid config → every `info/warn/error/fatal` call reuses the same two values for its HTTP request plus the internal `DEFAULT_ENDPOINT`. No per-call override.
* Changing env/apiKey requires constructing a new `Delok` instance — no `updateConfig()` method exists. Endpoint cannot be changed via `DelokConfig` by design.
* Empty `event` → `track()` throws `DelokError("Event name cannot be empty.")` before any fetch; no retry.

## 7. Implementation Notes

* **Endpoint internalization** — previously `DelokConfig.endpoint?` and `SendLogPayload.endpoint` propagated the URL from config to transport. Now removed: `DEFAULT_ENDPOINT` is imported directly in `transport.ts`. This was the smallest change to enforce the boundary `Developer config ↓ SDK ↓ Delok infrastructure`.
* **Current endpoint value** — `http://localhost:8000/api/ingestion` `src/constants.ts:40` is the **actual current implementation** (local MVP placeholder). Documented as such; not silently changed to a guessed production URL. Flagged as implementation/deployment concern — production deployment should update the constant, not `DelokConfig`.
* **No config for timeout/retry** — intentionally unchanged; adding those would be larger public API. Documented as non-blocking.
