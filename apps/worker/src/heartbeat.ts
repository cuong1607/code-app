import type { Redis } from 'ioredis';
import { WORKER_HEARTBEAT_KEY, type WorkerHeartbeat, nowUtcIso } from '@acs/shared';

/**
 * Ghi heartbeat vào Redis với TTL = 3 x interval.
 * API đọc key này để biết worker còn sống (key hết hạn => worker down).
 */
export async function writeHeartbeat(
  redis: Redis,
  base: Omit<WorkerHeartbeat, 'lastBeatAt'>,
  intervalMs: number,
): Promise<void> {
  const payload: WorkerHeartbeat = { ...base, lastBeatAt: nowUtcIso() };
  const ttlSeconds = Math.max(5, Math.ceil((intervalMs * 3) / 1000));
  await redis.set(WORKER_HEARTBEAT_KEY, JSON.stringify(payload), 'EX', ttlSeconds);
}
