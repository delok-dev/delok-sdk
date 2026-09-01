# Delok SDK — Build & Packaging

> Sources: `package.json:1`, `tsconfig.json:1`, `src/index.ts:1`, `dist/` output.

## 1. Build System

### TypeScript — `tsconfig.json:1`

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### tsup — no `tsup.config.*`

Build command is inline in `package.json:40`:

```json
"scripts": { "build": "tsup src/index.ts --format esm,cjs --dts", "test": "vitest run", "test:watch": "vitest", "prepublishOnly": "npm run build" },
"engines": { "node": ">=18" }
```

* **Entry:** `src/index.ts` — single entry, all public symbols re-exported there.
* **Formats:** `esm` → `dist/index.mjs`, `cjs` → `dist/index.js`.
* **Declarations:** `--dts` → `dist/index.d.ts` + `dist/index.d.mts` (dual).
* **No config file** — no `tsup.config.ts`. All options are CLI flags.
* Endpoint removal does not affect build — `DEFAULT_ENDPOINT` remains internal, not exported via `src/index.ts`.

### Build Output

```
dist/
├── index.js       # CJS 14.19 KB
├── index.mjs      # ESM 12.98 KB
├── index.d.ts     # CJS types 18.59 KB
└── index.d.mts    # ESM types 18.59 KB
```

Tests: `npm test` → vitest run, 26 tests (config 6, public-api 7, transport 13), config via `vitest.config.ts`.

## 2. Package Metadata — `package.json:1`

```json
{
  "name": "delok",
  "version": "0.1.0",
  "engines": { "node": ">=18" },
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs", "require": "./dist/index.js" } }
}
```

* `DEFAULT_ENDPOINT` is **not** in `files` nor `exports` — internal constant, not public. `src/index.ts` does not re-export it (verified: `DEFAULT_ENDPOINT` not in `dist/index.d.ts` public surface).

## 3. How Source Becomes Package

```
npm run build
  └─ tsup src/index.ts --format esm,cjs --dts
       ├─ esbuild bundle src/index.ts + deps → dist/index.mjs (ESM)
       └─ dts plugin → dist/index.d.ts/.d.mts
```

## 4. Public Types in Distribution

`dist/index.d.ts` re-exports exactly what `src/index.ts` exports — no internal types leak:

```
Delok, DelokError, DelokConfigurationError, DelokHttpError, DelokNetworkError, DelokTimeoutError,
types: DelokConfig {apiKey, environment}, TrackPayload, LogLevel, Environment, DelokErrorMetadata, DelokHttpErrorMetadata, DelokApiError
```

Internal types `SendLogPayload {apiKey, environment, data}`, `RequestContext`, `RetryableStatus`, `DelokApiErrorResponse`, and constant `DEFAULT_ENDPOINT` are not re-exported — internal only. Verified: `DelokConfig` in `dist/index.d.ts` has only `apiKey` + `environment`.

## 5. Gaps and Maintenance Notes

* **No `tsup.config.ts`** — adding `external`, `splitting`, `onSuccess` would require one.
* **No sourcemaps** — debugging `dist` stack traces maps to bundled JS, not original TS. Consider `--sourcemap`.
* **`engines >=18`** for `fetch`/`AbortController`.
* **No CI** — no `.github/workflows`. Tests now exist (`npm test`) but not run on push.
* **Endpoint internal** — `DEFAULT_ENDPOINT` is `http://localhost:8000/api/ingestion` actual implementation (local MVP placeholder). Not configurable via `DelokConfig` by design. Production deployment should update the constant internally, not expose via config.

