# Observability — Logs, Metrics, Traces

A lightweight, fully containerized **MELT** stack for the games platform,
layered on top of the existing Docker Compose setup as an additive overlay.

## Stack at a glance

| Concern  | Component | Image |
| -------- | --------- | ----- |
| Ingest   | OpenTelemetry Collector (contrib) | `otel/opentelemetry-collector-contrib` |
| Metrics  | Prometheus + cAdvisor + node-exporter | `prom/prometheus`, `gcr.io/cadvisor/cadvisor`, `prom/node-exporter` |
| Logs     | Loki + Promtail | `grafana/loki`, `grafana/promtail` |
| Traces   | Tempo | `grafana/tempo` |
| UI       | Grafana | `grafana/grafana` |

```
                     ┌──────────────────────────────────────────────┐
 apps (OTLP gRPC) ──▶│             OpenTelemetry Collector           │
                     │  receivers: otlp                              │
                     │  processors: memory_limiter, resource, batch  │
                     └─┬───────────────┬───────────────┬─────────────┘
                       │ traces        │ metrics       │ logs
                       ▼               ▼               ▼
                    ┌──────┐      ┌────────────┐    ┌──────┐
                    │Tempo │      │Prometheus  │    │Loki  │◀── Promtail
                    └──┬───┘      │(scrapes    │    └──┬───┘   (Docker logs)
                       │          │ collector, │       │
                       │          │ cAdvisor,  │       │
                       │          │ node-exp.) │       │
                       │          └─────┬──────┘       │
                       └──────────────► Grafana ◀──────┘
                                  (datasources + dashboards provisioned)
```

## Quick start

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.observability.yml \
  up -d --build
```

Generate some traffic:

```bash
curl -s http://localhost:3000/api/auth/health
curl -s -X POST http://localhost:3000/api/hangman/games \
  -H 'content-type: application/json' \
  -d '{"difficulty":"medium"}'
```

## Access URLs

| Service     | URL                       | Notes |
| ----------- | ------------------------- | ----- |
| Grafana     | http://localhost:3030     | login `admin` / `admin` (override with `GRAFANA_USER`/`GRAFANA_PASSWORD`) |
| Prometheus  | http://localhost:9090     | scrape targets at `Status → Targets` |
| Loki        | http://localhost:3100     | API only — query via Grafana |
| Tempo       | http://localhost:3200     | API only — query via Grafana |
| OTLP gRPC   | localhost:4317            | apps push here |
| OTLP HTTP   | localhost:4318            | apps push here |

Three dashboards are provisioned automatically (in the **Games Platform** folder):

| Dashboard | What it shows |
| --------- | ------------- |
| **Games Platform — Overview** | Per-service request rate, error rate, p50/p95/p99 latency, container CPU & memory, and a unified error/warn log feed. |
| **Games Platform — Auth Service** | Active sessions gauge, registrations & logins by result, login-failure rate, per-route request rate / latency, auth warnings & errors. |
| **Games Platform — Games** | Games started/finished by game, win-rate per game and per Hangman difficulty, score-distribution heatmap, Hangman guess split (letter vs word, correct vs wrong), score submissions to leaderboard, leaderboard reads by scope, game-service warnings & errors. |

## How telemetry flows

### Traces

`app SDK` → `OTLP/gRPC :4317` → `otel-collector` → `tempo:4317` (OTLP)
→ Grafana **Explore → Tempo** (TraceQL or Search).

Tempo's **metrics generator** also emits `traces_spanmetrics_*` series
(request rate, error rate, latency histograms) via remote-write to
Prometheus, which is what powers the RED panels in the dashboard.

### Metrics

Two paths:

1. **App OTLP metrics** (custom counters, runtime stats) → collector →
   `prometheus` exporter on `:8889/metrics` → Prometheus scrapes it.
2. **Infra metrics** — Prometheus scrapes **cAdvisor** (per-container CPU /
   memory / net / fs) and **node-exporter** (host CPU / memory / disk) directly.

### Logs

Two paths:

1. **App OTLP logs** (structured logs from the OTel SDK) → collector →
   `loki` exporter → Loki HTTP push API.
2. **Container stdout/stderr** → **Promtail** (tails
   `/var/lib/docker/containers/*.log`) → Loki. This means every
   container's logs are in Loki even if the app isn't OTel-instrumented.

Promtail tries to parse JSON log lines and promotes `level`, `trace_id`,
and `span_id` to label/field promotion stages so log → trace navigation
works in Grafana.

## Trace ↔ logs correlation

Datasources are pre-wired:

- **Loki → Tempo**: any log line containing `"trace_id":"<hex>"` shows a
  *TraceID* link that opens the trace in Tempo (configured via
  `derivedFields` in `observability/grafana/provisioning/datasources/datasources.yaml`).
- **Tempo → Loki**: any span has a *Logs for this span* button that
  queries Loki for log lines tagged with the same `service.name` in a
  ±5 minute window.

All five Node services already do this:

1. The OTel SDK is loaded via `node --require @games-platform/observability/tracing`
   in each Dockerfile's `CMD`. No code change needed in app entry points.
2. Each service's `utils/logger.ts` runs every JSON line through `withTrace()`, which
   pulls `trace_id`/`span_id` from the active span when one exists.

Example log line emitted during a request:

```json
{
  "timestamp": "2026-05-10T13:07:11.421Z",
  "service":   "auth-service",
  "level":     "info",
  "message":   "User registered",
  "userId":    "9c7…",
  "username":  "alice",
  "trace_id":  "8b1c…",
  "span_id":   "f23a…"
}
```

In Grafana, click the `trace_id` field on a log line and Grafana opens the matching
trace in Tempo in a side panel.

## Custom metrics reference

Defined once in `packages/observability/src/index.ts` (`gamesMetrics`), recorded
by individual services. After Prometheus name-mangling (dots → underscores),
they appear as:

| Metric (Prometheus name) | Type | Labels | Recorded by |
| ------------------------ | ---- | ------ | ----------- |
| `auth_registrations_total` | counter | `result` (`success`\|`conflict`) | auth-service |
| `auth_logins_total` | counter | `result` (`success`\|`invalid_credentials`) | auth-service |
| `auth_active_sessions` | gauge | – | auth-service (observable, queries refresh tokens every 15 s) |
| `games_started_total` | counter | `game`, `difficulty` | hangman, guess-number, tic-tac-toe |
| `games_finished_total` | counter | `game`, `outcome` (`won`\|`lost`\|`draw`), `difficulty` | hangman, guess-number, tic-tac-toe |
| `games_score` *(histogram)* | histogram | `game`, `outcome`, `difficulty` | hangman, guess-number, tic-tac-toe |
| `games_duration` *(histogram, seconds)* | histogram | `game`, `outcome` | hangman, guess-number, tic-tac-toe |
| `hangman_guesses_total` | counter | `kind` (`letter`\|`word`), `correct` (`true`\|`false`), `difficulty` | hangman |
| `leaderboard_score_submitted_total` | counter | `game` | leaderboard |
| `leaderboard_lookups_total` | counter | `scope` (`per_game`\|`global`\|`me`), `game` | leaderboard |

Histograms expose `_bucket`, `_count`, and `_sum` series in Prometheus, queried
with `histogram_quantile()` (see the dashboards for examples).

Every metric also carries `service_name`, `service_version`, and
`deployment_environment` labels because the collector's
`resource_to_telemetry_conversion` is enabled.

## Adding a new metric in 30 seconds

1. Add it to the `gamesMetrics` block in `packages/observability/src/index.ts`:
   ```ts
   myThingTotal: meter.createCounter('my.thing', { description: '…' }),
   ```
2. `cd packages/observability && npm run build`
3. Use it from any service:
   ```ts
   import { gamesMetrics } from '@games-platform/observability';
   gamesMetrics.myThingTotal.add(1, { reason: 'something' });
   ```
4. Rebuild that service image. The series appears in Prometheus within ~30 s.

## Configuration files

| File | Purpose |
| ---- | ------- |
| `observability/otel-collector-config.yaml` | Collector pipelines (OTLP → Tempo / Prometheus / Loki) |
| `observability/prometheus.yml`              | Scrape config (collector, cAdvisor, node-exporter) |
| `observability/loki-config.yaml`            | Single-binary Loki, filesystem storage |
| `observability/promtail-config.yaml`        | Docker-SD log scraping + JSON parsing |
| `observability/tempo-config.yaml`           | OTLP receivers, span-metrics generator |
| `observability/grafana/provisioning/`       | Datasources + dashboard provider |
| `observability/grafana/dashboards/`         | Provisioned JSON dashboards |

## Environment variables

Set in `.env` at the repo root (all are optional):

```bash
DEPLOY_ENV=development        # value of deployment.environment resource attr
OTEL_LOG_LEVEL=warn           # collector + SDK log verbosity
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

App services receive these OTLP variables automatically from the overlay:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_EXPORTER_OTLP_INSECURE=true
OTEL_LOGS_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_SERVICE_NAME=<service>
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=${DEPLOY_ENV}
```

Services that don't load the OTel SDK simply ignore them.

## Enabling SDK instrumentation in a service

The shared `@games-platform/observability` package is already in the
repo (`packages/observability`). To wire it into a service:

1. Add it to the service's `package.json` dependencies (`workspace:*` or
   relative path).
2. Either:
   - **Zero-code option** — add `NODE_OPTIONS=--require @games-platform/observability/tracing`
     to the service's environment in the overlay, or
   - **Explicit option** — `import '@games-platform/observability/tracing';`
     as the very first line of the service entry.

Auto-instrumentation covers Express, HTTP, ioredis, mongoose, pg, axios,
and a dozen more — no per-route changes needed.

## Troubleshooting

**No data in Grafana**

```bash
docker logs otel-collector --tail=50
curl -fsS http://localhost:13133 || echo "collector unhealthy"
curl -fsS http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job:.labels.job, health}'
```

**No traces appearing in Tempo**

- Check the collector pipeline: `docker logs otel-collector | grep -i tempo`.
- Confirm an app is actually pushing OTLP — `OTEL_LOG_LEVEL=debug` on the app
  for one boot, look for `Exported N spans`.

**No container logs in Loki**

- Promtail uses Docker SD; verify its target list:
  `docker logs promtail --tail=50` and look for "tail routine".
- LogQL test in Grafana Explore: `{project="games_sk"}` should return lines.

**cAdvisor / node-exporter missing**

Both are scraped on the internal Docker network only. Confirm
`Status → Targets` in Prometheus shows them as `UP`.

## Production hardening

| Area | Default | Production change |
| ---- | ------- | ----------------- |
| Storage | Loki/Tempo on local volumes | Object store (S3, GCS, Azure) for both |
| Retention | 7 d logs, 7 d traces, 15 d Prometheus | tune per signal cost/value |
| Auth   | Grafana basic auth | OAuth/OIDC via reverse proxy |
| TLS    | OTLP plaintext on `:4317` | Mutual TLS at the collector edge |
| HA     | Single-binary Loki/Tempo | scalable mode (read/write split, ingester replicas) |
| Alerts | None pre-shipped | Alertmanager + Prometheus rules in `observability/prometheus/alerts/` |
| Backups | Volume snapshots | Object-store lifecycle + Grafana DB backup |

## See also

- [`packages/observability/README.md`](packages/observability/README.md) — shared SDK helpers
- [OpenTelemetry Collector Contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib)
- [Grafana Tempo docs](https://grafana.com/docs/tempo/latest/)
- [Grafana Loki docs](https://grafana.com/docs/loki/latest/)
