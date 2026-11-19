import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type ApiEnv, AppError } from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';

export const IS_PUBLIC_KEY = 'acs:isPublic';
/** Đánh dấu endpoint công khai (VD: /health). Mặc định mọi endpoint đều cần workspace. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface WorkspaceRef {
  id: string;
}

export type RequestWithWorkspace = Request & { workspace?: WorkspaceRef };

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const a = address.replace(/^::ffff:/, '');
  return a === '::1' || a === 'localhost' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a);
}

/**
 * GUARD XÁC ĐỊNH WORKSPACE.
 *
 * AUTH_MODE=dev-local (chế độ DUY NHẤT ở Phase 02):
 *  - KHÔNG phải xác thực. Mọi request được gán vào DEV_WORKSPACE_ID do SERVER quyết định
 *    (không bao giờ đọc workspaceId từ client).
 *  - Chỉ chấp nhận kết nối TCP từ loopback (127.0.0.1 / ::1). API mặc định cũng chỉ bind 127.0.0.1.
 *  - Bị cấm khi NODE_ENV=production (env validation từ chối khởi động).
 *
 * Phase 09: thay phần thân bằng xác thực phiên/JWT và tra workspace theo thành viên.
 * Service phía dưới đã luôn lọc theo workspaceId nên không cần sửa.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithWorkspace>();
    if (this.env.AUTH_MODE === 'dev-local') {
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        throw new AppError(
          'FORBIDDEN',
          'API đang ở chế độ phát triển (dev-local): chỉ chấp nhận truy cập từ máy cục bộ.',
        );
      }
      req.workspace = { id: this.env.DEV_WORKSPACE_ID };
      return true;
    }
    throw new AppError('UNAUTHORIZED', 'Chưa xác thực');
  }
}

/** Lấy workspaceId đã được guard xác định. */
export const WorkspaceId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<RequestWithWorkspace>();
  if (!req.workspace) throw new AppError('UNAUTHORIZED', 'Không xác định được workspace');
  return req.workspace.id;
});
