import pino, { Logger } from 'pino';
import { ConfigService } from '../config/index.js';

/**
 * Centralized, configurable logger service implemented as a singleton.
 * Must be initialized before use.
 */
class LoggerServiceSingleton {
  private static instance: LoggerServiceSingleton;
  private logger!: Logger;

  private constructor() {}

  public static getInstance(): LoggerServiceSingleton {
    if (!LoggerServiceSingleton.instance) {
      LoggerServiceSingleton.instance = new LoggerServiceSingleton();
    }
    return LoggerServiceSingleton.instance;
  }

  /**
   * Initializes the logger with configuration from the ConfigService.
   * This must be called after the ConfigService has been initialized.
   */
  public initialize(): Logger {
    if (this.logger) {
      return this.logger;
    }

    const config = ConfigService.getInstance().getConfig();

    const transport =
      process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined;

    this.logger = pino(
      {
        level: config.server.logLevel,
        transport,
      },
      process.stderr,
    );

    return this.logger;
  }

  /**
   * Returns the initialized logger instance.
   * Throws an error if the logger has not been initialized.
   */
  public getLogger(): Logger {
    if (!this.logger) {
      throw new Error('LoggerService not initialized. Call initialize() first.');
    }
    return this.logger;
  }
}

export const LoggerService = LoggerServiceSingleton.getInstance();
