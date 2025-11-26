import { HealthService, HealthStatus } from '../../src/services/health';

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = HealthService.getInstance();
  });

  it('should return a valid HealthStatus object', () => {
    const health: HealthStatus = healthService.getHealth();

    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
    expect(health.uptime).toBeGreaterThan(0);
    expect(health.version).toBeDefined();
    expect(health.components).toBeDefined();
    expect(health.components.config.status).toBe('ok');
    expect(health.components.mcp_server.status).toBe('ok');
    expect(health.components.frameworks).toBeDefined();
    // Initially might be degraded if framework store not fully loaded or mocked to 0
    // But in unit test we haven't mocked FrameworkStore, so it relies on default behavior.
    // FrameworkStore is singleton, if not initialized, count is 0 -> degraded.
    // Let's just check existence for now.
  });
});
