import { z } from 'zod';

/**
 * Tên các hàng đợi BullMQ.
 * Giai đoạn 00 chỉ có hàng đợi "system" để kiểm tra đường ống api -> redis -> worker.
 */
export const QUEUE_NAMES = {
  system: 'system',
  /** Phase 04: tạo ảnh AI – mỗi job = 1 ảnh (image_generation_items) */
  image: 'image',
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

export const IMAGE_JOBS = {
  generateItem: 'image.generate-item',
} as const;

/** Payload chỉ chứa ID – dữ liệu thật đọc từ DB (luôn lọc theo workspace). */
export const imageGenerateItemPayloadSchema = z
  .object({
    workspaceId: z.uuid(),
    jobId: z.uuid(),
    itemId: z.uuid(),
  })
  .strict();
export type ImageGenerateItemPayload = z.infer<typeof imageGenerateItemPayloadSchema>;

/** ID job BullMQ cố định theo item -> thêm lại (refresh/khôi phục) không tạo job trùng. */
export const imageQueueJobId = (itemId: string) => `img-item-${itemId}`;
