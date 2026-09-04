# Delok SDK

A lightweight TypeScript SDK for sending structured application logs to the Delok Platform.

## Installation

```bash
npm install @delok/sdk
```

## Quick Start

```ts
import { Delok } from "@delok/sdk";

const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "development",
});
```

Once initialized, the SDK can be used to send application logs.

## Sending Logs

### Info

Use `info()` for normal application events.

```ts
delok.info({
  event: "user_login",
  message: "User successfully logged in",
});
```

### Warning

Use `warn()` for conditions that may require attention but do not necessarily indicate a failure.

```ts
delok.warn({
  event: "payment_retry",
  message: "Payment gateway timeout",
});
```

### Error

Use `error()` for application errors and failed operations.

```ts
delok.error({
  event: "payment_failed",
  message: "Payment process failed",
  payload: {
    orderId: "123",
  },
});
```

### Fatal

Use `fatal()` for critical failures that may indicate a severe application or infrastructure issue.

```ts
delok.fatal({
  event: "database_crash",
  message: "Primary database is unavailable",
});
```

## Configuration

The SDK is initialized with a `DelokConfig` object.

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

The SDK uses its configured API key and environment to associate logs with the appropriate Delok project.

## Log Payload

Each logging method accepts a structured log object.

```ts
type LogPayload = {
  event: string;
  message?: string;
  payload?: Record<string, unknown>;
};
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

The SDK enriches the submitted data with additional metadata before sending it to the Delok backend.

A resulting event may contain fields such as:

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

## Error Handling

Logging methods are designed to be fire-and-forget.

They do not throw or reject when log delivery fails. Network failures, timeouts, and HTTP errors are handled internally by the SDK so logging failures do not interrupt the host application.

```ts
delok.info({
  event: "user_login",
});
```

No `await` or `try/catch` is required for logging calls.

### Configuration Errors

Invalid SDK configuration is validated when the client is created and throws synchronously.

```ts
import { Delok, DelokConfigurationError } from "@delok/sdk";

try {
  const delok = new Delok({
    apiKey: "",
    environment: "production",
  });
} catch (error) {
  if (error instanceof DelokConfigurationError) {
    console.error("Invalid SDK configuration:", error.message);
  }
}
```

### Error Types

| Error                     | Description                              |
| ------------------------- | ---------------------------------------- |
| `DelokError`              | Base class for SDK-specific errors       |
| `DelokConfigurationError` | Invalid SDK configuration                |
| `DelokNetworkError`       | Network connectivity failure             |
| `DelokTimeoutError`       | Request exceeded the configured timeout  |
| `DelokHttpError`          | The Delok backend returned an HTTP error |

## Error Metadata

Some SDK errors expose additional metadata to help diagnose delivery failures.

Example:

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

The available metadata depends on the error type and the stage at which the failure occurred.

## License

Licensed under the MIT License.
