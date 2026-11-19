import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AppError, systemPingPayloadSchema } from '@acs/shared';
import { QueueService } from './queue.service';

/**
 * Endpoint kỹ thuật để kiểm tra đường ống thật: API -> Redis/BullMQ -> Worker.
 * POST /system/ping  -> tạo job
 * GET  /system/ping/:jobId -> xem trạng thái/kết quả do worker trả về
 */
@Controller('system')
export class SystemController {
  constructor(private readonly queue: QueueService) {}

  @Post('ping')
  @HttpCode(202)
  async ping(@Body() body: unknown) {
    const parsed = systemPingPayloadSchema.pick({ note: true }).safeParse(body ?? {});
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', parsed.error.issues);
    }
    return this.queue.enqueuePing(parsed.data.note);
  }

  @Get('ping/:jobId')
  async status(@Param('jobId') jobId: string) {
    return this.queue.getPingStatus(jobId);
  }
}
