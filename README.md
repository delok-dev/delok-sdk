# Delok SDK

Delok SDK is a lightweight logging client for sending application events to the Delok Observability Platform.

It allows developers to track application activities, errors, warnings, and custom events with a simple API.

---

## Installation

### From NPM (Coming Soon)

```bash
npm install delok
```

### Local Development

```bash
npm pack
```

Then install the generated package:

```bash
npm install ./delok-1.0.0.tgz
```

---

## Quick Start

```ts
import { Delok } from "delok";

const delok = new Delok({
  apiKey: "dlok_xxxxxxxxxxxxxxxxx",
  environment: "development",
});
```

---

## Sending Logs

### Info

```ts
await delok.info({
  event: "user_login",
  message: "User successfully logged in",
});
```

### Warning

```ts
await delok.warn({
  event: "payment_retry",
  message: "Payment gateway timeout",
});
```

### Error

```ts
await delok.error({
  event: "payment_failed",
  message: "Payment process failed",
  payload: {
    orderId: "123",
  },
});
```

### Fatal

```ts
await delok.fatal({
  event: "database_crash",
  message: "Primary database is unavailable",
});
```

---

## Custom Events

For advanced use cases, logs can be sent directly using `track()`.

```ts
await delok.track({
  level: "info",
  event: "custom_event",
  message: "Custom application event",
  payload: {
    feature: "dashboard",
  },
});
```

---

## Log Structure

Every log sent through the SDK is transformed into the following structure:

```json
{
  "environment": "production",
  "level": "error",
  "event": "payment_failed",
  "message": "Payment process failed",
  "occurredAt": "2026-07-15T12:00:00.000Z",
  "payload": {
    "orderId": "123"
  }
}
```

---

## Configuration

### DelokConfig

```ts
type DelokConfig = {
  apiKey: string;
  environment: string;
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

## API Reference

### track()

Low-level method used internally by the SDK.

```ts
delok.track({
  level: "info",
  event: "custom_event",
});
```

### info()

```ts
delok.info({
  event: "user_login",
});
```

### warn()

```ts
delok.warn({
  event: "rate_limit_warning",
});
```

### error()

```ts
delok.error({
  event: "payment_failed",
});
```

### fatal()

```ts
delok.fatal({
  event: "database_crash",
});
```

---

## Current Features

* Send logs to Delok backend
* API key authentication
* Environment tagging
* Structured payload support
* TypeScript support
* ESM and CommonJS builds

---

## Roadmap

### SDK

* Retry mechanism
* Batch log delivery
* Offline queue support
* Browser unload handling
* Node.js runtime support
* React integration utilities

### Platform

* Real-time log viewer
* Search and filtering
* Error analytics
* Alerting system
* AI-powered anomaly detection

---

## License

MIT License
