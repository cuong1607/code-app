import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { WorkspaceBootstrapService } from './workspace-bootstrap.service';
import { WorkspaceGuard } from './workspace.guard';

@Module({
  providers: [{ provide: APP_GUARD, useClass: WorkspaceGuard }, WorkspaceBootstrapService],
  exports: [WorkspaceBootstrapService],
})
export class AuthModule {}
