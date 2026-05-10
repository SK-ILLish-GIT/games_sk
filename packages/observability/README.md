# `@games-platform/observability`

Shared OpenTelemetry bootstrap, custom metrics, and structured logger for
every Node service in the games platform.

## What you get

- `initTelemetry()` — boots the OTel Node SDK with auto-instrumentations
  for Express, HTTP, ioredis, mongoose, pg, axios, and a dozen more.
  Idempotent; honors all standard `OTEL_*` env vars.
- `gamesMetrics` — typed namespace of counters / histograms / observable
  gauges shared across services. Single source of truth for metric names
  and label keys.
- `createLogger(serviceName)` — JSON logger with automatic
  `trace_id` / `span_id` injection from the active span. All five services
  use this; do not roll your own.
- `withTrace(fields)` — low-level helper underlying `createLogger`. Useful
  if you have an existing logger you'd rather keep.
- Re-exports of `tracer`, `metrics`, `context`, `logsApi` from
  `@opentelemetry/api` so callers don't need a direct dependency.

## Installation in a service

The package is consumed via a local `file:` dependency so each service
image bundles it without an npm registry. The pattern is mirrored across
all five services:

1. Add to the service's `package.json`:

   ```json
   "dependencies": {
     "@games-platform/observability": "file:./obs"
   }
   ```

2. The service's Dockerfile copies `packages/observability/` into the
   build context as `./obs`:

   ```dockerfile
   COPY packages/observability/package.json ./obs/package.json
   COPY packages/observability/dist        ./obs/dist
   ```

3. Bootstrap before the app loads via `--require`:

   ```dockerfile
   CMD ["node", "--require", "@games-platform/observability/tracing", "dist/app.js"]
   ```

   This must run before any instrumented library is imported.

A repo-root `.dockerignore` keeps build contexts small while still
shipping `packages/observability/dist` (the only path Docker actually
needs).

## Local editor / type-checker

Each service also keeps a sibling `obs/` directory containing the built
`dist/` and the package's `package.json`, so `npm install` in the service
folder resolves `@games-platform/observability` locally too. After any
change to the shared package:

```bash
cd packages/observability && npm run build
for s in services/*/; do
  cp -R packages/observability/dist        "$s/obs/dist"
  cp    packages/observability/package.json "$s/obs/package.json"
done
```

The `obs/` directories are listed in the repo `.gitignore` — they're
build artifacts, not source.

## Usage

### Logs

```ts
// services/<svc>/src/utils/logger.ts
import { createLogger } from '@games-platform/observability';
export const logger = createLogger('hangman-service');
```

```ts
// anywhere
logger.info('Game finished', { gameId, score, outcome });
// emits a single JSON line on stdout, with trace_id/span_id injected
// when a span is active (Express request, axios call, mongoose query, …).
```

### Metrics

```ts
import { gamesMetrics } from '@games-platform/observability';

gamesMetrics.gameStartedTotal.add(1, {
  game: 'hangman',
  difficulty: 'easy',
});

gamesMetrics.gameScore.record(score, {
  game: 'hangman',
  outcome: 'won',
  difficulty: 'easy',
});
```

The instruments are created lazily on first read against the **current**
global meter provider, so they survive being imported before
`initTelemetry()` finishes registering the SDK.

See [`OBSERVABILITY.md`](../../OBSERVABILITY.md#custom-metrics-reference)
for the full list of metrics, labels, and Prometheus names.

### Manual spans

```ts
import { tracer } from '@games-platform/observability';

const span = tracer.startSpan('lua-update-leaderboard');
try {
  await redis.evalsha(...);
} finally {
  span.end();
}
```

## Adding a new instrument

Edit `src/index.ts`:

1. Add the typed field to the `GamesMetrics` interface.
2. Add it inside the `build()` function:

   ```ts
   myThingTotal: m.createCounter('my.thing', { description: 'why' }),
   ```

3. Rebuild (`npm run build`), sync `dist/` into each service's `obs/`,
   rebuild the service image. Done.

Naming conventions: lower-case, dot-separated; the OTel→Prometheus
exporter rewrites dots to underscores and appends `_total` (counters),
`_bucket/_count/_sum` (histograms), or the unit (e.g. `_seconds`).

## Files

| File | Purpose |
| ---- | ------- |
| `src/index.ts`        | Public API: SDK bootstrap, `gamesMetrics`, `createLogger`, `withTrace` |
| `src/tracing.ts`      | Side-effect entry point used with `node --require` |
| `dist/`               | Compiled JS + `.d.ts` (only thing shipped into service images) |
| `package.json`        | `exports` map: `.` → `index.js`, `./tracing` → `tracing.js` |
| `tsconfig.json`       | `target: ES2020`, `module: commonjs`, `strict: true` |

## Versioning

Internal package, not published. Bumped with the rest of the platform.
