import { HealthService, HealthStatus } from '../../src/services/health';

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = HealthService.getInstance();
  });

  it('should return a valid HealthStatus object', () => {
    const health: HealthStatus = healthService.getHealth();

    expect(health).toBeDefined();
    // status can be 'healthy' or 'degraded' depending on framework initialization
    expect(['healthy', 'degraded']).toContain(health.status);
    expect(health.uptime).toBeGreaterThan(0);
    expect(health.version).toBeDefined();
    expect(health.components).toBeDefined();
    expect(health.components.config.status).toBe('ok');
    expect(health.components.mcp_server.status).toBe('ok');
    expect(health.components.frameworks).toBeDefined();
    // frameworks may be 'ok' or 'degraded' depending on initialization state
    expect(['ok', 'degraded']).toContain(health.components.frameworks.status);
  });
});
