import { z } from 'zod';

export const HEALTH_COMPONENTS = ['database', 'redis', 'storage', 'worker'] as const;
export type HealthComponentName = (typeof HEALTH_COMPONENTS)[number];

export const componentStatusSchema = z.enum(['up', 'down']);
export type ComponentStatus = z.infer<typeof componentStatusSchema>;

export const componentHealthSchema = z.object({
  status: componentStatusSchema,
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ComponentHealth = z.infer<typeof componentHealthSchema>;

/**
 * ok        : mọi thành phần đều up
 * degraded  : thành phần phụ (worker) down nhưng lõi (db/redis/storage) vẫn up
 * down      : ít nhất một thành phần lõi down
 */
export const overallStatusSchema = z.enum(['ok', 'degraded', 'down']);
export type OverallStatus = z.infer<typeof overallStatusSchema>;

export const healthResponseSchema = z.object({
  status: overallStatusSchema,
  service: z.literal('api'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  /** Luôn là ISO-8601 UTC */
  timestamp: z.iso.datetime(),
  components: z.object({
    database: componentHealthSchema,
    redis: componentHealthSchema,
    storage: componentHealthSchema,
    worker: componentHealthSchema,
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Thành phần lõi: nếu down thì toàn hệ thống coi là down. */
const CORE_COMPONENTS: HealthComponentName[] = ['database', 'redis', 'storage'];

export function computeOverallStatus(
  components: Record<HealthComponentName, ComponentHealth>,
): OverallStatus {
  const coreDown = CORE_COMPONENTS.some((name) => components[name].status === 'down');
  if (coreDown) return 'down';
  const anyDown = Object.values(components).some((c) => c.status === 'down');
  return anyDown ? 'degraded' : 'ok';
}

/** Payload worker ghi vào Redis làm heartbeat. */
export const workerHeartbeatSchema = z.object({
  workerId: z.string(),
  pid: z.number().int(),
  startedAt: z.iso.datetime(),
  lastBeatAt: z.iso.datetime(),
  ffmpeg: z.object({
    available: z.boolean(),
    version: z.string().optional(),
    error: z.string().optional(),
  }),
});
export type WorkerHeartbeat = z.infer<typeof workerHeartbeatSchema>;
