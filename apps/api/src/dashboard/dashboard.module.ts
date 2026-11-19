import { Controller, Get, Module } from '@nestjs/common';
import { WorkspaceId } from '../auth/workspace.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@WorkspaceId() ws: string) {
    return this.dashboard.summary(ws);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
