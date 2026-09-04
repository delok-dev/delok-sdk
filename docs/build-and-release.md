# Delok SDK — Build & Packaging

## Build System

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true
  }
}
```

Build command:

```json
"scripts": {
  "build": "tsup src/index.ts --format esm,cjs --dts",
  "test": "vitest run"
}
```

## Build Output

```
dist/
├── index.js
├── index.mjs
├── index.d.ts
└── index.d.mts
```

## Package Metadata

```json
{
  "name": "delok",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts"
}
```

## Public Types

```
Delok, DelokError, DelokConfigurationError, DelokHttpError, DelokNetworkError, DelokTimeoutError
DelokConfig, TrackPayload, LogLevel, Environment
```
