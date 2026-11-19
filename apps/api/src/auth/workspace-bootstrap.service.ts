import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type ApiEnv, toErrorMessage } from '@acs/shared';
import { withTimeout } from '../common/with-timeout';
import { APP_ENV } from '../config/app-config.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ở chế độ dev-local, đảm bảo workspace phát triển tồn tại (idempotent) để API dùng được
 * ngay cả khi chưa chạy seed. Không làm sập API nếu DB chưa sẵn sàng.
 */
@Injectable()
export class WorkspaceBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkspaceBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.env.AUTH_MODE !== 'dev-local') return;
    try {
      await withTimeout(this.ensureDevWorkspace(), 5000, 'Khởi tạo workspace phát triển');
    } catch (error) {
      this.logger.warn(`Chưa khởi tạo được workspace phát triển: ${toErrorMessage(error)}`);
    }
  }

  async ensureDevWorkspace(): Promise<void> {
    const id = this.env.DEV_WORKSPACE_ID;
    await this.prisma.workspace.upsert({
      where: { id },
      create: { id, name: 'Workspace phát triển', slug: 'dev-local' },
      update: {},
    });
    await this.prisma.applicationSettings.upsert({
      where: { workspaceId: id },
      create: { workspaceId: id },
      update: {},
    });
  }
}
