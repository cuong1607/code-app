import { type Job, UnrecoverableError } from 'bullmq';
import {
  SYSTEM_JOBS,
  type SystemPingPayload,
  type SystemPingResult,
  nowUtcIso,
  systemPingPayloadSchema,
} from '@acs/shared';

/** Xử lý các job của hàng đợi "system". */
export function createSystemProcessor(workerId: string) {
  return async (job: Job<SystemPingPayload, SystemPingResult>): Promise<SystemPingResult> => {
    switch (job.name) {
      case SYSTEM_JOBS.ping: {
        const parsed = systemPingPayloadSchema.safeParse(job.data);
        if (!parsed.success) {
          // Dữ liệu sai thì retry cũng vô ích
          throw new UnrecoverableError(`Payload không hợp lệ: ${parsed.error.message}`);
        }
        const receivedAt = nowUtcIso();
        return {
          receivedAt,
          workerId,
          roundTripMs: Math.max(0, Date.parse(receivedAt) - Date.parse(parsed.data.requestedAt)),
        };
      }
      default:
        throw new UnrecoverableError(`Job không được hỗ trợ: ${job.name}`);
    }
  };
}
