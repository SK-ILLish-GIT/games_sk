// Standardised JSON logger — defined once in @games-platform/observability.
// All services should use this; do not re-implement the JSON formatting.
import { createLogger } from '@games-platform/observability';

export const logger = createLogger('tic-tac-toe-service');
