# Delok SDK — Architecture

## Overview

Delok SDK provides a minimal public API for sending structured logs to the Delok Observability Platform.

## Public API

| Symbol | Description |
|---|---|
| `Delok` | Main client class |
| `constructor(config)` | Creates client with `apiKey` and `environment` |
| `info / warn / error / fatal` | Log methods — `void`, accept `{event, message?, payload?}` |
| `DelokConfig` | `{apiKey, environment}` |
| `TrackPayload` | `{event, level, message?, payload?}` — callers omit `level` |
| `Environment` | `"development" | "staging" | "production"` |
| `LogLevel` | `"info" | "warn" | "error" | "fatal"` |
| `DelokError` | Base error class |
| `DelokConfigurationError` | Invalid client configuration |
| `DelokHttpError` | Backend returned an error |
| `DelokNetworkError` | Network failure |
| `DelokTimeoutError` | Request timeout |

## Project Structure

```
delok-sdk/
├── src/
│   ├── index.ts              # public exports
│   ├── Delok.ts              # Delok class
│   ├── types.ts              # public types
│   └── errors/
├── tests/
├── package.json
└── README.md
```

## Usage Flow

```
Application code
      │
      ▼
  Delok client
      ├── info()  ──┐
      ├── warn()   ─┤──▶ Delok platform
      ├── error()  ─┤
      └── fatal()  ──┘
```

Delok sends your logs to your project and handles delivery internally.
