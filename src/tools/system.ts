import { z } from 'zod';

/**
 * Schema for the `system/health` tool.
 * This tool takes no parameters.
 */
export const HealthToolSchema = {
  name: 'system/health',
  description: 'Get the current health status of the PolyAgent server.',
  input: z.object({}),
  output: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    uptime: z.number(),
    version: z.string(),
    components: z.record(
      z.string(),
      z.object({
        status: z.enum(['ok', 'degraded', 'error']),
        details: z.string().optional(),
      }),
    ),
  }),
};
