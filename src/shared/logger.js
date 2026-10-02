import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Structured logger. In development it prints pretty, colorized lines;
 * in production it emits one JSON object per line, which log platforms
 * (Datadog, CloudWatch, Loki…) can index and search.
 */
export const logger = pino({
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    transport: config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
});
