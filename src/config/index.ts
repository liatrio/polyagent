import { readFile, access, constants } from 'fs/promises';
import { join } from 'path';
import { Config, ConfigSchema } from './schema.js';

/**
 * Service for loading and validating configuration
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: Config | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Initialize configuration
   * Loads defaults and merges with user configuration if file exists
   * @param configPath Optional path to user config file (defaults to polyagent.config.json in cwd)
   */
  public async initialize(configPath?: string): Promise<Config> {
    try {
      const userConfig = await this.loadUserConfig(configPath);
      
      // Zod handles validation and merging with defaults
      const parsedConfig = ConfigSchema.parse(userConfig);
      
      // Freeze configuration to ensure immutability (AC-5)
      this.config = Object.freeze(parsedConfig);
      
      return this.config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Configuration initialization failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the loaded configuration
   * Throws if not initialized
   */
  public getConfig(): Config {
    if (!this.config) {
      throw new Error('ConfigService not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Load user configuration from file
   */
  private async loadUserConfig(customPath?: string): Promise<unknown> {
    const configPath = customPath || process.env.POLYAGENT_CONFIG_PATH || join(process.cwd(), 'polyagent.config.json');

    try {
      // Check if file exists
      await access(configPath, constants.R_OK);
      
      // Read and parse JSON
      const fileContent = await readFile(configPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // If file doesn't exist or not readable, return empty object (use defaults)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new Error(`Failed to load config file at ${configPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Reset configuration (for testing)
   */
  public reset(): void {
    this.config = null;
  }
}

// Export singleton getter for convenience
export const getConfig = () => ConfigService.getInstance().getConfig();
