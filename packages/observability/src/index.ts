/**
 * Shared OpenTelemetry bootstrap and helpers for every Node service.
 *
 * Public API:
 *   - `initTelemetry()`                 — start the SDK (idempotent)
 *   - `gamesMetrics`                    — typed counters/histograms/gauges
 *   - `withTrace(fields)`               — attach trace_id/span_id to a log object
 *   - `meter`, `tracer`, `logsApi`      — raw OTel APIs for power use
 *   - `shutdownTelemetry()`             — flush + stop the SDK (called on SIGTERM)
 */

import {
  diag, DiagConsoleLogger, DiagLogLevel, metrics, trace, context,
  Counter, Histogram, ObservableGauge,
} from '@opentelemetry/api';
import { logs as logsApi } from '@opentelemetry/api-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import {
  SemanticResourceAttributes,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | undefined;
let started = false;

/**
 * Initialise the OpenTelemetry Node SDK once per process.
 *
 * Honors standard OTEL_* env vars (OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME,
 * OTEL_RESOURCE_ATTRIBUTES …). Auto-instruments Node core, express, mongoose,
 * ioredis, pg, axios, http, and a dozen others.
 */
export function initTelemetry(): void {
  if (started) return;
  started = true;

  if (process.env.OTEL_LOG_LEVEL?.toLowerCase() === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  } else {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'unknown-service';
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]:    serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15_000,
    }),
    logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter()),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => req.url === '/health',
        },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    void shutdownTelemetry().finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch {
    // Ignore — we're shutting down anyway.
  } finally {
    sdk = undefined;
  }
}

// ── Raw OTel APIs ──────────────────────────────────────────────────────
// Use getters so each access resolves the *current* global provider.
// (Without this, instruments created before initTelemetry() bind to the
// no-op default provider and become silent forever.)
export function getMeter() { return metrics.getMeter('games-platform'); }
export function getTracer() { return trace.getTracer('games-platform'); }
export const tracer = getTracer();

// ── Trace-aware logging helper ─────────────────────────────────────────
// Mix this into your structured log object so trace_id / span_id are emitted
// on every line. Loki's derived field links log lines back to traces.
export function withTrace<T extends object>(fields: T): T & {
  trace_id?: string;
  span_id?:  string;
} {
  const span = trace.getSpan(context.active());
  if (!span) return fields as T & { trace_id?: string; span_id?: string };
  const ctx = span.spanContext();
  return {
    ...fields,
    trace_id: ctx.traceId,
    span_id:  ctx.spanId,
  };
}

// Backwards-compat alias for existing callers.
export const withTraceContext = withTrace;

// ── Custom domain metrics ──────────────────────────────────────────────
//
// One canonical instrument per metric, defined here so every service uses
// identical names and attributes. Prometheus translates `.` to `_` in series
// names (e.g. games.started → games_started_total).
//
// IMPORTANT: instruments are built **lazily** on first access. If we built
// them at module-load time they would bind to the default no-op MeterProvider
// (because initTelemetry() hasn't run yet) and silently swallow every record.

interface GamesMetrics {
  authRegistrationsTotal: Counter;
  authLoginsTotal: Counter;
  authActiveSessions: ObservableGauge;
  gameStartedTotal: Counter;
  gameFinishedTotal: Counter;
  gameDurationSeconds: Histogram;
  gameScore: Histogram;
  hangmanGuessesTotal: Counter;
  leaderboardScoreSubmittedTotal: Counter;
  leaderboardLookupsTotal: Counter;
}

// Resolve instruments fresh against the *current* global meter on every access.
// OTel deduplicates instruments by name within a meter, so calling
// `createCounter('foo')` repeatedly returns the same underlying instrument; we
// avoid the gotcha where the first call resolves before the SDK has installed
// its real meter provider and silently binds to the no-op default.
function build(): GamesMetrics {
  const m = getMeter();
  return {
    authRegistrationsTotal: m.createCounter('auth.registrations', {
      description: 'Total user registration attempts, partitioned by result',
      unit: '1',
    }),
    authLoginsTotal: m.createCounter('auth.logins', {
      description: 'Total user login attempts, partitioned by result',
      unit: '1',
    }),
    authActiveSessions: m.createObservableGauge('auth.active_sessions', {
      description: 'Current number of valid (non-revoked, unexpired) refresh tokens',
      // No `unit` — the OTel Prometheus exporter would otherwise append `_ratio`
      // to gauges that declare unit `1`.
    }),
    gameStartedTotal: m.createCounter('games.started', {
      description: 'New game sessions created, partitioned by game and difficulty',
      unit: '1',
    }),
    gameFinishedTotal: m.createCounter('games.finished', {
      description: 'Game sessions that reached a terminal state (won/lost/draw)',
      unit: '1',
    }),
    gameDurationSeconds: m.createHistogram('games.duration', {
      description: 'Wall-clock duration of completed games',
      unit: 's',
    }),
    gameScore: m.createHistogram('games.score', {
      description: 'Final score recorded for a completed game',
      unit: '1',
    }),
    hangmanGuessesTotal: m.createCounter('hangman.guesses', {
      description: 'Hangman guesses, partitioned by kind (letter|word) and correctness',
      unit: '1',
    }),
    leaderboardScoreSubmittedTotal: m.createCounter('leaderboard.score_submitted', {
      description: 'Score submissions received by the leaderboard service',
      unit: '1',
    }),
    leaderboardLookupsTotal: m.createCounter('leaderboard.lookups', {
      description: 'Leaderboard read requests, partitioned by scope (per-game|global|me)',
      unit: '1',
    }),
  };
}

export const gamesMetrics: GamesMetrics = new Proxy({} as GamesMetrics, {
  get(_t, prop: keyof GamesMetrics) {
    return build()[prop];
  },
});

// ── Standardised structured logger ─────────────────────────────────────
// All services use this. Same JSON shape, automatic trace_id/span_id
// injection, single source of truth.

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(service: string): Logger {
  function emit(stream: 'log' | 'warn' | 'error' | 'debug', payload: Record<string, unknown>): void {
    const line = JSON.stringify(withTrace({
      timestamp: new Date().toISOString(),
      service,
      ...payload,
    }));
    // eslint-disable-next-line no-console
    console[stream](line);
  }
  return {
    info: (message, meta) => emit('log',   { level: 'info',  message, ...meta }),
    warn: (message, meta) => emit('warn',  { level: 'warn',  message, ...meta }),
    error: (message, error, meta) => {
      const errorDetails = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
      emit('error', { level: 'error', message, error: errorDetails, ...meta });
    },
    debug: (message, meta) => {
      if (process.env.NODE_ENV !== 'production') {
        emit('debug', { level: 'debug', message, ...meta });
      }
    },
  };
}

// Re-export OTel APIs so callers don't need to add @opentelemetry/api directly.
export { trace, metrics, context };
export { logsApi as logs };
