import { z } from 'zod';

/**
 * Log level enum
 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'silent']);

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  host: z.string().default('localhost'),
  logLevel: LogLevelSchema.default('info'),
});

/**
 * Security configuration schema
 */
export const SecurityConfigSchema = z.object({
  trustedCommands: z.array(z.string()).default([]),
  sandbox: z.boolean().default(true),
});

/**
 * OPA configuration schema
 */
export const OpaConfigSchema = z.object({
  bundlePath: z.string().optional(),
  decisionLogs: z.boolean().default(false),
});

/**
 * Git configuration schema
 */
export const GitConfigSchema = z.object({
  ignoredPaths: z.array(z.string()).default(['.git', 'node_modules', 'dist', 'coverage']),
  branch: z.string().default('main'),
});

/**
 * Root configuration schema
 */
export const ConfigSchema = z.object({
  server: ServerConfigSchema.default({
    port: 3000,
    host: 'localhost',
    logLevel: 'info',
  }),
  security: SecurityConfigSchema.default({
    trustedCommands: [],
    sandbox: true,
  }),
  opa: OpaConfigSchema.default({
    decisionLogs: false,
  }),
  git: GitConfigSchema.default({
    ignoredPaths: ['.git', 'node_modules', 'dist', 'coverage'],
    branch: 'main',
  }),
});

/**
 * Inferred TypeScript configuration type
 */
export type Config = z.infer<typeof ConfigSchema>;
export type LogLevel = z.infer<typeof LogLevelSchema>;
