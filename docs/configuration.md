# Delok SDK — Configuration

> Source: `src/types.ts:53`, `src/Delok.ts:62`, `src/constants.ts:7`, `src/utils.ts:9`.

## 1. Configuration Object

```ts
// src/types.ts:53
interface DelokConfig {
  apiKey: string;        // required, non-empty
  environment: Environment; // required, one of 3
  endpoint?: string;     // optional, defaults to DEFAULT_ENDPOINT
}
type Environment = "development" | "staging" | "production"; // src/constants.ts:7
```

`endpoint` is the hardened addition (previously hardcoded). Both `apiKey` and `environment` remain required — TypeScript enforces at compile time, runtime validates in constructor. `endpoint` has a default.

## 2. Validation

`src/Delok.ts:62`:

```ts
constructor(config: DelokConfig) {
  if (!isValidString(config.apiKey))               // src/utils.ts:9
    throw new DelokConfigurationError("API Key cannot be empty.");
  if (!SUPPORTED_ENVIRONMENTS.includes(config.environment))
    throw new DelokConfigurationError("Invalid environment. Expected one of: development, staging, production.");
  if (config.endpoint !== undefined && !isValidString(config.endpoint))
    throw new DelokConfigurationError("Endpoint cannot be empty.");
  this.apiKey = config.apiKey;
  this.environment = config.environment;
  this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
}
```

* `isValidString` — `src/utils.ts:9`: `typeof str === "string" && str.trim().length > 0`. Rejects `""`, `"   "`, non-strings (if JS caller bypasses TS).
* `SUPPORTED_ENVIRONMENTS = ["development","staging","production"] as const` — `src/constants.ts:7`. Case-sensitive, no aliases.
* `endpoint` validation only when provided — empty/whitespace rejected; `undefined` ⇒ `DEFAULT_ENDPOINT = "http://localhost:8000/api/ingestion"` `src/constants.ts:48`.
* Throws **synchronously** — caller can `try/catch` construction. No async init, no lazy validation.
* `event` validation is **not** in constructor — it is in `private track()` `src/Delok.ts:94`: `if (!isValidString(data.event)) throw new DelokError("Event name cannot be empty.");` — see §7. This is payload validation, not config.

## 3. Internal Representation

Private fields on `Delok` instance — `src/Delok.ts:39`:

```ts
private apiKey: string;
private environment: Environment;
private endpoint: string;
```

* Stored verbatim, no cloning or freezing.
* Consumed only in `private track()` → `sendLog({apiKey, environment, endpoint, data})` `src/Delok.ts:95`. Not otherwise read or mutated.
* Effectively immutable after construction; no mutator.

## 4. Where Configuration Flows

```
Constructor validates & stores  src/Delok.ts:62
        │
        ▼
Delok instance fields apiKey/environment/endpoint
        │
        ▼
track() bundles into SendLogPayload  src/Delok.ts:95
        │
        ▼
performRequest reads apiKey/environment/endpoint  src/transport.ts:110
        ├── url: endpoint                          src/transport.ts:112
        ├── header: "x-api-key": apiKey            src/transport.ts:117
        └── body: { environment, ... }             src/transport.ts:120
```

* `environment` appears in body (log metadata); `apiKey` only in header; `endpoint` only as fetch URL.
* `occurredAt` and `level` are not config — generated per request.

## 5. What Is Not Configurable

| Concern | Current value | Location | Consumer-configurable? |
|---|---|---|---|
| Endpoint URL | `DEFAULT_ENDPOINT = http://localhost:8000/api/ingestion` default, override via `config.endpoint` | `src/constants.ts:48` + `src/Delok.ts:77` | **Yes** (optional) — minimal fix for MVP |
| Request timeout | `5000` ms | `src/constants.ts:23` | No |
| Max retries | `2` | `src/constants.ts:31` | No |
| Retry delay | `500 * 2^(n-1)` | `src/constants.ts:37` + `src/utils.ts:30` | No |
| Retryable codes | `[500,502,503,504]` | `src/constants.ts:57` | No |
| Log levels | `["info","warn","error","fatal"]` | `src/constants.ts:17` | No |
| Batching/sampling | none | — | No — feature gap |

All tuning constants are `export const` but not part of `DelokConfig` and not re-exported from `src/index.ts` — internal by convention.

## 6. Relationship to Request Behavior

* Invalid config → construction throws `DelokConfigurationError` before any network activity; no retry, no metadata.
* Valid config → every `info/warn/error/fatal` call reuses the same three values for its HTTP request. No per-call override.
* Changing env/apiKey/endpoint requires constructing a new `Delok` instance — no `updateConfig()` method exists.
* Empty `event` → `track()` throws `DelokError("Event name cannot be empty.")` before any fetch; no retry.

## 7. Hardened Behaviors (audit fixes)

* **Endpoint configurability** — added optional `endpoint?: string` with `isValidString` validation and `DEFAULT_ENDPOINT` fallback. Keeps MVP `localhost` default for backward compat but allows production override without redesign. Tested in `tests/config.test.ts` and `tests/public-api.test.ts`.
* **Event validation** — `isValidString(data.event)` in `track()` `src/Delok.ts:94` fails fast with `DelokError`, not a network round-trip. Minimal structural check, no backend duplication. Tested in `tests/public-api.test.ts`.
* **Timeout message** — fixed from `seconds` to `ms` (`5000ms`) using constant derivation — `src/transport.ts:162`.
* **No config for timeout/retry** — intentionally unchanged; adding those would be larger public API. Documented as non-blocking.
