import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { type ApiEnv, AppError } from '@acs/shared';
import { WorkspaceGuard, isLoopbackAddress } from './workspace.guard';

const env = {
  AUTH_MODE: 'dev-local',
  DEV_WORKSPACE_ID: '00000000-0000-4000-8000-000000000001',
} as ApiEnv;

function ctx(remoteAddress: string, isPublic = false) {
  const req: Record<string, unknown> = { socket: { remoteAddress } };
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const context = {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { guard: new WorkspaceGuard(reflector, env), context, req };
}

describe('isLoopbackAddress', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.1.2.3'])('%s là loopback', (a) => {
    expect(isLoopbackAddress(a)).toBe(true);
  });
  it.each(['192.168.1.10', '10.0.0.5', '::ffff:192.168.1.2', '', undefined])(
    '%s KHÔNG là loopback',
    (a) => {
      expect(isLoopbackAddress(a)).toBe(false);
    },
  );
});

describe('WorkspaceGuard (dev-local)', () => {
  it('gán workspace do server quyết định cho request từ loopback', () => {
    const { guard, context, req } = ctx('127.0.0.1');
    expect(guard.canActivate(context)).toBe(true);
    expect(req.workspace).toEqual({ id: env.DEV_WORKSPACE_ID });
  });

  it('từ chối request từ máy khác trong mạng', () => {
    const { guard, context } = ctx('192.168.1.50');
    expect(() => guard.canActivate(context)).toThrow(AppError);
  });

  it('endpoint @Public không cần workspace', () => {
    const { guard, context, req } = ctx('192.168.1.50', true);
    expect(guard.canActivate(context)).toBe(true);
    expect(req.workspace).toBeUndefined();
  });
});
