import { LoggerService } from '../../src/services/logger';
import { ConfigService } from '../../src/config/index';

describe('LoggerService', () => {
  beforeAll(async () => {
    // Ensure ConfigService is initialized
    await ConfigService.getInstance().initialize();
  });

  it('should be an instance of pino', () => {
    // Initialize first
    LoggerService.initialize();
    const logger = LoggerService.getLogger();
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('should have the correct log level from config', () => {
    const logger = LoggerService.getLogger();
    // This is indirectly tested by the config tests, 
    // but we can check the level property.
    // Default is 'info'
    expect(logger.level).toBe('info');
  });
});
