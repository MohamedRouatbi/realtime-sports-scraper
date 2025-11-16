import pino from 'pino';

/**
 * Logger utility using Pino for high-performance logging
 * Optimized for minimal overhead
 */
const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,
  formatters: {
    level: label => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Performance logger
 */
export const perfLogger = {
  start: name => {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        logger.debug(`⚡ ${name} completed in ${duration}ms`);
        return duration;
      },
    };
  },
};

export default logger;
