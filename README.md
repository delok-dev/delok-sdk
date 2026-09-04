# Delok SDK

Delok SDK is a lightweight TypeScript logging client for sending structured application events to the Delok Observability Platform.

---

# Installation

```bash
npm install delok
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
delok.info({
  event: "user_login",
  message: "User successfully logged in",
});
```

## Warning

```ts
delok.warn({
  event: "payment_retry",
  message: "Payment gateway timeout",
});
```

## Error

```ts
delok.error({
  event: "payment_failed",
  message: "Payment process failed",
  payload: {
    orderId: "123",
  },
});
```

## Fatal

```ts
delok.fatal({
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
delok.info({
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

# Error Handling

All SDK-specific errors extend `DelokError`.

Logging methods are fire-and-forget and do not throw or reject. Delivery failures are handled internally:

```ts
delok.info({
  event: "user_login",
});
```

The application does not need to `await` or `catch` logging calls. Constructor validation errors are thrown synchronously:

```ts
try {
  const delok = new Delok({ apiKey: "", environment: "production" });
} catch (error) {
  if (error instanceof DelokConfigurationError) {
    console.error("Invalid SDK config:", error.message);
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
