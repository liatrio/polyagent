import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FrameworkStore } from './framework-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
);
const VERSION = packageJson.version;

/**
 * Defines the structure for a component's health status.
 */
export interface ComponentHealth {
  status: 'ok' | 'degraded' | 'error';
  details?: string;
}

/**
 * Defines the overall system health status structure.
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // in seconds
  version: string;
  components: {
    [key: string]: ComponentHealth;
  };
}

/**
 * Service for checking the health of the system and its components.
 */
export class HealthService {
  private static instance: HealthService;

  private constructor() {}

  public static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
  }

  /**
   * Gathers the current health status of the system.
   * @returns {HealthStatus} The current health status.
   */
  public getHealth(): HealthStatus {
    const frameworkStore = FrameworkStore.getInstance();
    const frameworkCount = frameworkStore.getFrameworksCount();
    
    // AC-5: Status "ok" if all 3 core frameworks loaded (at least 3)
    // "degraded" if any missing (less than 3)
    const frameworksStatus = frameworkCount >= 3 ? 'ok' : 'degraded';
    
    const components: Record<string, ComponentHealth> = {
      config: { status: 'ok' },
      mcp_server: { status: 'ok' },
      frameworks: {
        status: frameworksStatus,
        details: `${frameworkCount} frameworks loaded`,
      },
    };

    const isHealthy = Object.values(components).every(c => c.status === 'ok');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      version: VERSION,
      components,
    };
  }
}
