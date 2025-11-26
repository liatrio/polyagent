import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { z } from 'zod';
import { ConfigService } from '../config/index.js';
import { LoggerService } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Zod schema for individual requirement
 */
export const RequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  controls: z.array(z.string()),
  references: z.array(z.string()),
});

export type Requirement = z.infer<typeof RequirementSchema>;

/**
 * Zod schema for framework metadata
 */
export const FrameworkMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  url: z.string(),
});

/**
 * Zod schema for the complete framework YAML file
 */
export const FrameworkFileSchema = z.object({
  framework: FrameworkMetadataSchema,
  requirements: z.array(RequirementSchema),
});

export type FrameworkFile = z.infer<typeof FrameworkFileSchema>;

/**
 * Service for managing security framework data
 */
export class FrameworkStore {
  private static instance: FrameworkStore;
  private frameworks: Map<string, FrameworkFile> = new Map();
  private initialized = false;

  private constructor() {}

  public static getInstance(): FrameworkStore {
    if (!FrameworkStore.instance) {
      FrameworkStore.instance = new FrameworkStore();
    }
    return FrameworkStore.instance;
  }

  /**
   * Initialize the store by loading embedded and custom frameworks
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    const logger = LoggerService.getLogger();
    
    try {
      // 1. Load embedded frameworks
      // In production (dist), frameworks are likely one level up from services/ or in root
      // Adjust path based on project structure: project_root/frameworks/
      // src/services -> src -> root is 2 levels up
      const projectRoot = resolve(__dirname, '../..'); 
      const embeddedPath = join(projectRoot, 'frameworks');
      
      await this.loadFrameworksFromDir(embeddedPath);

      // 2. Load custom frameworks (overrides)
      const userConfigPath = process.env.POLYAGENT_CONFIG_DIR || join(process.env.HOME || process.env.USERPROFILE || '', '.polyagent');
      const customPath = join(userConfigPath, 'frameworks');
      
      if (existsSync(customPath)) {
        await this.loadFrameworksFromDir(customPath);
      }

      this.initialized = true;
      logger.info({ count: this.frameworks.size }, 'FrameworkStore initialized');
    } catch (error) {
      logger.error(error, 'Failed to initialize FrameworkStore');
      throw error; // AC-2: Invalid YAML prevents server startup
    }
  }

  /**
   * Load all .yaml files from a directory
   */
  private async loadFrameworksFromDir(dirPath: string): Promise<void> {
    const logger = LoggerService.getLogger();
    
    if (!existsSync(dirPath)) {
      logger.warn({ path: dirPath }, 'Framework directory not found, skipping');
      return;
    }

    const files = readdirSync(dirPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of files) {
      const filePath = join(dirPath, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const rawData = yaml.load(content);
        
        // Validate schema (AC-2)
        const result = FrameworkFileSchema.safeParse(rawData);
        
        if (!result.success) {
          logger.error({ 
            file: filePath, 
            errors: (result.error as any).errors 
          }, 'Framework YAML validation failed');
          // AC-2: Invalid YAML prevents server startup -> we throw here
          throw new Error(`Invalid framework YAML in ${file}: ${result.error.message}`);
        }

        const frameworkData = result.data;
        // AC-3: Custom frameworks override embedded ones with same ID
        this.frameworks.set(frameworkData.framework.id, frameworkData);
        logger.debug({ id: frameworkData.framework.id, file }, 'Loaded framework');
        
      } catch (error) {
        // Rethrow validation errors to stop startup, log others
        if (error instanceof Error && error.message.startsWith('Invalid framework YAML')) {
          throw error;
        }
        logger.error({ file, error }, 'Failed to load framework file');
        throw error;
      }
    }
  }

  /**
   * List all available framework IDs
   */
  public listFrameworks(): string[] {
    this.ensureInitialized();
    return Array.from(this.frameworks.keys());
  }

  /**
   * Get a specific requirement by framework ID and requirement ID
   */
  public getRequirement(frameworkId: string, requirementId: string): Requirement {
    this.ensureInitialized();
    
    const framework = this.frameworks.get(frameworkId);
    if (!framework) {
      const suggestions = this.getSuggestions(frameworkId, Array.from(this.frameworks.keys()));
      throw new Error(`Framework '${frameworkId}' not found. ${suggestions}`);
    }

    const requirement = framework.requirements.find(r => r.id === requirementId);
    if (!requirement) {
      const reqIds = framework.requirements.map(r => r.id);
      const suggestions = this.getSuggestions(requirementId, reqIds);
      throw new Error(`Requirement '${requirementId}' not found in framework '${frameworkId}'. ${suggestions}`);
    }

    return requirement;
  }

  /**
   * List all requirement IDs for a framework
   */
  public listRequirements(frameworkId: string): string[] {
    this.ensureInitialized();
    
    const framework = this.frameworks.get(frameworkId);
    if (!framework) {
      throw new Error(`Framework '${frameworkId}' not found.`);
    }

    return framework.requirements.map(r => r.id);
  }
  
  /**
   * Helper to generate "Did you mean?" suggestions
   */
  private getSuggestions(input: string, candidates: string[]): string {
    // Simple levenshtein-like check or just inclusion could work, 
    // but for now just returning list if short, or closest match logic if we had a library.
    // Since we can't add dependencies easily, we'll just list available options if few.
    if (candidates.length <= 5) {
      return `Available: ${candidates.join(', ')}`;
    }
    return `Available options include: ${candidates.slice(0, 5).join(', ')}...`;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('FrameworkStore not initialized. Call initialize() first.');
    }
  }

  /**
   * Public getter for the map (useful for health checks)
   */
  public getFrameworksCount(): number {
    return this.frameworks.size;
  }
}
