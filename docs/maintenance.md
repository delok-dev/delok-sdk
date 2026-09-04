# Delok SDK — Maintenance Guide

## Invariants to Preserve

- Construction validates synchronously — invalid `apiKey` or `environment` throws `DelokConfigurationError`.
- Public surface is `Delok` with `info/warn/error/fatal` — level is set by the method.
- Error hierarchy — all SDK errors extend `DelokError`.

## Common Change Scenarios

### Adding a new log level

1. Add to supported log levels and `LogLevel` type.
2. Add method on `Delok` class.
3. Ensure backend support.

## Debugging Guide

| Symptom | Where to look |
|---|---|
| `DelokConfigurationError` at startup | Check `apiKey` and `environment` |
| `DelokError: Event name cannot be empty` | `event` is `""` or whitespace |
| `DelokHttpError 401` | Verify `apiKey` |
| `DelokHttpError 400` | Check `event` and `payload` shape |

## Testing

```bash
npm test
npm run build
```

## Source Reference

```
Delok class            src/Delok.ts
types                  src/types.ts
errors                 src/errors/*.ts
entry                  src/index.ts
```
