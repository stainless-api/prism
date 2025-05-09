import pino from 'pino';

/**
 * Creates special instance of pino logger that prevent collecting or logging anything
 * Unfortunately disabled logger didn't work
 */
export function createTestLogger() {
  const logger = pino({
    enabled: false,
  });

  logger.success = logger.info;
  return logger;
}
