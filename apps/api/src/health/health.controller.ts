import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type HealthResponse, nowUtcIso } from '@acs/shared';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Readiness: kiểm tra thật DB, Redis, MinIO và worker.
   * 200 khi ok/degraded, 503 khi một thành phần lõi down.
   */
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.status(result.status === 'down' ? 503 : 200);
    return result;
  }

  /** Liveness: tiến trình API còn sống, không phụ thuộc dịch vụ ngoài. */
  @Get('live')
  live() {
    return { status: 'ok', service: 'api', timestamp: nowUtcIso() };
  }
}
