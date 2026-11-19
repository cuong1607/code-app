import { Body, Controller, Get, Put } from '@nestjs/common';
import { appSettingsUpdateSchema } from '@acs/shared';
import { WorkspaceId } from '../auth/workspace.guard';
import { parseInput } from '../common/validation';
import { SettingsService } from './settings.service';

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Workspace hiện tại + chế độ truy cập (dev-local). */
  @Get('workspace')
  workspace(@WorkspaceId() ws: string) {
    return this.settings.workspace(ws);
  }

  @Get('settings')
  get(@WorkspaceId() ws: string) {
    return this.settings.get(ws);
  }

  /** Chỉ cài đặt KHÔNG nhạy cảm; khoá lạ (VD: apiKey) bị từ chối do schema strict. */
  @Put('settings')
  update(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.settings.update(ws, parseInput(appSettingsUpdateSchema, body));
  }
}
