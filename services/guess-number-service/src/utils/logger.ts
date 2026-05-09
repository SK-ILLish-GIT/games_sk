// Structured JSON logger for guess-number-service.
// Outputs machine-parseable JSON to stdout/stderr for log aggregation.
// In production, swap this with Winston or Pino for richer features.
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), service: 'guess-number-service', ...meta }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date().toISOString(), service: 'guess-number-service', ...meta }));
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(JSON.stringify({ level: 'error', message, error: errorDetails, timestamp: new Date().toISOString(), service: 'guess-number-service', ...meta }));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify({ level: 'debug', message, timestamp: new Date().toISOString(), service: 'guess-number-service', ...meta }));
    }
  },
};
