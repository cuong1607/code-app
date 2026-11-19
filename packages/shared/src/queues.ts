import { z } from 'zod';

/**
 * Tên các hàng đợi BullMQ.
 * Giai đoạn 00 chỉ có hàng đợi "system" để kiểm tra đường ống api -> redis -> worker.
 */
export const QUEUE_NAMES = {
  system: 'system',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const SYSTEM_JOBS = {
  ping: 'system.ping',
} as const;

export const systemPingPayloadSchema = z.object({
  requestedAt: z.iso.datetime(),
  note: z.string().max(200).optional(),
});
export type SystemPingPayload = z.infer<typeof systemPingPayloadSchema>;

export const systemPingResultSchema = z.object({
  receivedAt: z.iso.datetime(),
  workerId: z.string(),
  roundTripMs: z.number().nonnegative(),
});
export type SystemPingResult = z.infer<typeof systemPingResultSchema>;
