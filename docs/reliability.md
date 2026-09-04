# Delok SDK — Reliability

Logging is designed to not break the host application.

```ts
delok.error({
  event: "payment_failed",
  payload: { orderId: "123" },
});
```

The SDK handles delivery internally. Logging calls return `void` immediately and do not require `await`.

Delok sends your logs to your project and reports logging failures through internal handling.
