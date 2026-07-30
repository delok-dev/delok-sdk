# Delok SDK

Delok SDK is a lightweight TypeScript logging client for sending structured application events to the Delok Observability Platform.

The SDK provides automatic retries, request timeouts, typed errors, and a simple developer-friendly API for integrating application logging.

---

# Installation

## From npm (Coming Soon)

```bash
npm install delok
```

## Local Development

```bash
npm pack
```

Install the generated package:

```bash
npm install ./delok-1.0.0.tgz
```

---

# Quick Start

```ts
import { Delok } from "delok";

const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "development",
});
```

---

# Sending Logs

## Info

```ts
await delok.info({
  event: "user_login",
  message: "User successfully logged in",
});
```

## Warning

```ts
await delok.warn({
  event: "payment_retry",
  message: "Payment gateway timeout",
});
```

## Error

```ts
await delok.error({
  event: "payment_failed",
  message: "Payment process failed",
  payload: {
    orderId: "123",
  },
});
```

## Fatal

```ts
await delok.fatal({
  event: "database_crash",
  message: "Primary database is unavailable",
});
```

---

# Configuration

```ts
type DelokConfig = {
  apiKey: string;
  environment: "development" | "staging" | "production";
};
```

Example:

```ts
const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "production",
});
```

---

# Log Payload

Each log contains structured application data.

```ts
{
  event: string;
  message?: string;
  payload?: Record<string, unknown>;
}
```

Example:

```ts
await delok.info({
  event: "user_created",
  message: "User registration completed",
  payload: {
    userId: "123",
    plan: "pro",
  },
});
```

The SDK automatically enriches the payload before sending it to the Delok backend.

```json
{
  "environment": "production",
  "level": "info",
  "event": "user_created",
  "message": "User registration completed",
  "occurredAt": "2026-07-30T12:00:00.000Z",
  "payload": {
    "userId": "123",
    "plan": "pro"
  }
}
```

---

# Retry Behavior

The SDK automatically retries transient failures.

Retry is performed for:

- Network failures
- Request timeouts
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504

The SDK does **not** retry permanent failures such as:

- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 404

Retries use exponential backoff.

Example:

```
Attempt 1
↓
500 ms

Attempt 2
↓
1000 ms

Attempt 3
```

---

# Error Handling

All SDK-specific errors extend `DelokError`.

```ts
try {
  await delok.info({
    event: "user_login",
  });
} catch (error) {
  if (error instanceof DelokError) {
    console.log(error.message);
    console.log(error.metadata);
  }
}
```

## Error Types

| Error                   | Description                          |
| ----------------------- | ------------------------------------ |
| DelokConfigurationError | Invalid SDK configuration            |
| DelokNetworkError       | Network connectivity failure         |
| DelokTimeoutError       | Request exceeded timeout             |
| DelokHttpError          | Delok backend returned an HTTP error |

---

# Error Metadata

Some errors include additional diagnostic information.

Example:

```ts
try {
    await delok.info(...);
}
catch (error) {
    if (error instanceof DelokHttpError) {
        console.log(error.metadata);
    }
}
```

Example metadata:

```ts
{
  status: 401,
  attempts: 1,
  duration: 87.4,
  error: {
    code: "INVALID_API_KEY",
    message: "Invalid API key"
  }
}
```
