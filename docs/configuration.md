# Delok SDK — Configuration

## Configuration Object

```ts
interface DelokConfig {
  apiKey: string;
  environment: Environment;
}
type Environment = "development" | "staging" | "production";
```

## Example

```ts
import { Delok } from "delok";

const delok = new Delok({
  apiKey: process.env.DELOK_API_KEY!,
  environment: "production",
});
```

## Validation

```ts
try {
  const delok = new Delok({ apiKey: "", environment: "production" });
} catch (error) {
  if (error instanceof DelokConfigurationError) {
    console.error("Invalid SDK config:", error.message);
  }
}
```

- `apiKey` must be a non-empty string.
- `environment` must be one of `"development"`, `"staging"`, `"production"`.
- Validation is synchronous — invalid config throws `DelokConfigurationError` immediately.
