// Simple logger wrapper. For production, this could be swapped with Winston or Pino.
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), ...meta }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date().toISOString(), ...meta }));
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    const errorDetails = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    console.error(JSON.stringify({ level: 'error', message, error: errorDetails, timestamp: new Date().toISOString(), ...meta }));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify({ level: 'debug', message, timestamp: new Date().toISOString(), ...meta }));
    }
  }
};

