/**
 * Side-effect-only entry point used with `node --require`.
 *
 * Add the following to a service's container env to bootstrap OTel before
 * the application module loads:
 *
 *     NODE_OPTIONS=--require @games-platform/observability/dist/tracing.js
 *
 * It must execute before any instrumented library (express, mongoose, ioredis,
 * pg, http, axios) is imported.
 */
import { initTelemetry } from './index';

initTelemetry();
