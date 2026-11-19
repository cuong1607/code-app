import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { toErrorMessage } from '@acs/shared';
import { withTimeout } from '../common/with-timeout';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Không làm sập API nếu DB chưa sẵn sàng: Prisma sẽ tự kết nối lại khi có truy vấn,
    // và /health sẽ báo "database: down" cho tới khi DB lên.
    try {
      await withTimeout(this.$connect(), 3000, 'Kết nối PostgreSQL');
      this.logger.log('Đã kết nối PostgreSQL');
    } catch (error) {
      this.logger.warn(`Chưa kết nối được PostgreSQL: ${toErrorMessage(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
