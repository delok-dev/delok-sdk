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

* `strict: true` — SDK code is fully strict.
* `declaration: true` — `.d.ts` emitted, but actual declaration emission is handled by `tsup` (uses `dts` plugin wrapping `tsc`).
* `target ES2022` — matches modern Node 18+ and browsers; no downleveling for older runtimes.

### tsup — no `tsup.config.*`

Build command is inline in `package.json:40`:

```json
"scripts": { "build": "tsup src/index.ts --format esm,cjs --dts", "test": "vitest run", "test:watch": "vitest", "prepublishOnly": "npm run build" },
"engines": { "node": ">=18" }
```

* **Entry:** `src/index.ts` — single entry, all public symbols re-exported there.
* **Formats:** `esm` → `dist/index.mjs`, `cjs` → `dist/index.js`.
* **Declarations:** `--dts` → `dist/index.d.ts` + `dist/index.d.mts` (dual).
* **No config file** — no `tsup.config.ts`. All options are CLI flags. Adding shims, external, or splitting would require a config file.

### Build Output (verified via `npm run build`)

```
dist/
├── index.js       # CJS 14.19 KB (post-hardening, +endpoint)
├── index.mjs      # ESM 12.98 KB
├── index.d.ts     # CJS types 18.59 KB
└── index.d.mts    # ESM types 18.59 KB
```

No sourcemaps (`--sourcemap` not passed). No minification (default `tsup` keeps readable output).
Tests: `npm test` → vitest run, 26 tests (config 8, public-api 5, transport 13), config via `vitest.config.ts`.

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

* `exports` field enables dual `import`/`require` resolution — `import {Delok} from "delok"` resolves to `.mjs`, `require` to `.js`.
* `files` whitelist ensures only `dist` + docs ship — `src` not published.
* `prepublishOnly` guarantees `dist` is fresh on `npm publish` / `npm pack`.

## 3. How Source Becomes Package

```
npm run build
  └─ tsup src/index.ts --format esm,cjs --dts
       ├─ esbuild bundle src/index.ts + deps → dist/index.mjs (ESM)
       ├─ esbuild bundle src/index.ts + deps → dist/index.js (CJS)
       └─ dts plugin (tsc + rollup) → dist/index.d.ts/.d.mts

npm pack / npm publish
  └─ prepublishOnly → rebuild
  └─ files ["dist","README.md","LICENSE"] + package.json → tarball `delok-0.1.0.tgz`
```

Install verification: `npm pack` produces `delok-0.1.0.tgz` (also `delok.tgz` in repo root — artifact, not source). Consumer install via `npm install delok` or `npm install ./delok-0.1.0.tgz` (README:23).

## 4. Public Types in Distribution

`dist/index.d.ts` re-exports exactly what `src/index.ts` exports — no internal types leak:

```
Delok, DelokError, DelokConfigurationError, DelokHttpError, DelokNetworkError, DelokTimeoutError,
types: DelokConfig, TrackPayload, LogLevel, Environment, DelokErrorMetadata, DelokHttpErrorMetadata, DelokApiError
```

Internal types `SendLogPayload`, `RequestContext`, `RetryableStatus`, `DelokApiErrorResponse` are present in emit but not re-exported — visible only if consumer inspects deep imports (should not).

## 5. Gaps and Maintenance Notes

* **No `tsup.config.ts`** — adding `external`, `splitting`, `onSuccess` would require one.
* **No sourcemaps** — debugging `dist` stack traces maps to bundled JS, not original TS. Consider `--sourcemap`.
* **`engines` added** — now `>=18` for `fetch`/`AbortController`. CI still none.
* **No CI** — no `.github/workflows`. Tests now exist (`npm test`) but not run on push; add workflow to run `npm test && npm run build`.
* **Endpoint now configurable** — `config.endpoint` optional; default still `localhost` for MVP compat; production should override.
