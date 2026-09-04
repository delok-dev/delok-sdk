# Delok SDK — Request Lifecycle

## 1. Create a Client

```ts
import { Delok } from "delok";

const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "production",
});
```

## 2. Send a Log

```ts
delok.info({ event: "user_login", message: "User logged in", payload: { userId: "123" } });
delok.warn({ event: "payment_retry", message: "Retrying payment" });
delok.error({ event: "payment_failed", payload: { orderId: "123" } });
delok.fatal({ event: "database_crash", message: "Database unavailable" });
```

Each method sets its log level automatically. Callers provide `event`, `message`, and `payload`.

## 3. Delivery

Delok sends your logs to your project and handles delivery internally.

```ts
delok.info({
  event: "user_created",
  payload: { userId: "123", plan: "pro" },
});
```

No additional configuration is required.
