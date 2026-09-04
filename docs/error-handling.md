# Delok SDK — Error Handling

## Error Hierarchy

```
Error
 └─ DelokError
     ├─ DelokConfigurationError
     ├─ DelokTimeoutError
     ├─ DelokNetworkError
     └─ DelokHttpError
```

All SDK errors are `instanceof DelokError`.

## Configuration Errors

Thrown synchronously when creating a client with invalid config:

```ts
try {
  const delok = new Delok({ apiKey: "", environment: "production" });
} catch (error) {
  if (error instanceof DelokConfigurationError) {
    console.error("Invalid SDK config:", error.message);
  }
}
```

| Condition | Error |
|---|---|
| `apiKey` empty or whitespace | `DelokConfigurationError("API Key cannot be empty.")` |
| `environment` not `development`/`staging`/`production` | `DelokConfigurationError("Invalid environment. Expected one of: development, staging, production.")` |

## Logging Errors

Logging methods are fire-and-forget:

```ts
delok.info({ event: "user_login" });
delok.error({ event: "payment_failed", payload: { orderId: "123" } });
```

Delivery failures are handled internally. The application does not need to `await` or wrap logging calls in `try/catch`.

## Metadata Reference

```ts
interface DelokErrorMetadata { attempts?: number; duration?: number; }
interface DelokHttpErrorMetadata extends DelokErrorMetadata { status: number; error: DelokApiError; }
```

## Consumer Example

```ts
import { Delok } from "delok";

const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "production",
});

delok.info({ event: "user_login" });
```
