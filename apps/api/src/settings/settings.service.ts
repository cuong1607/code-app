import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type ApiEnv,
  type AppSettings,
  type AppSettingsUpdate,
  DEFAULT_DISPLAY_TIMEZONE,
  DEFAULT_LOCALE,
  VIDEO_MODES,
  type WorkspaceContext,
  appPreferencesSchema,
} from '@acs/shared';
import { parseInput } from '../common/validation';
import { APP_ENV } from '../config/app-config.module';
import { PrismaService } from '../prisma/prisma.service';

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Gộp sâu object (mảng/giá trị nguyên thuỷ được thay thế). */
export function deepMerge(base: Plain, patch: Plain): Plain {
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlain(value) && isPlain(out[key]) ? deepMerge(out[key] as Plain, value) : value;
  }
  return out;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  async workspace(ws: string): Promise<WorkspaceContext> {
    const row = await this.prisma.workspace.findUnique({ where: { id: ws } });
    return { id: ws, name: row?.name ?? 'Workspace phát triển', authMode: this.env.AUTH_MODE };
  }

  async get(ws: string): Promise<AppSettings> {
    const [workspace, settings] = await Promise.all([
      this.prisma.workspace.findUnique({ where: { id: ws } }),
      this.prisma.applicationSettings.upsert({
        where: { workspaceId: ws },
        create: { workspaceId: ws },
        update: {},
      }),
    ]);
    // Dữ liệu cũ thiếu trường -> schema bổ sung mặc định
    const preferences = appPreferencesSchema.parse(settings.preferences ?? {});
    return {
      workspaceName: workspace?.name ?? 'Workspace phát triển',
      locale: DEFAULT_LOCALE,
      timezone: DEFAULT_DISPLAY_TIMEZONE,
      defaultVideoMode: (VIDEO_MODES as readonly string[]).includes(settings.defaultVideoMode)
        ? (settings.defaultVideoMode as AppSettings['defaultVideoMode'])
        : 'image_slideshow',
      preferences,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async update(ws: string, patch: AppSettingsUpdate): Promise<AppSettings> {
    const current = await this.get(ws);
    const preferences = patch.preferences
      ? parseInput(appPreferencesSchema, deepMerge(current.preferences as Plain, patch.preferences))
      : current.preferences;
    await this.prisma.$transaction([
      ...(patch.workspaceName
        ? [this.prisma.workspace.update({ where: { id: ws }, data: { name: patch.workspaceName } })]
        : []),
      this.prisma.applicationSettings.update({
        where: { workspaceId: ws },
        data: {
          ...(patch.defaultVideoMode && { defaultVideoMode: patch.defaultVideoMode }),
          preferences: preferences as Prisma.InputJsonValue,
        },
      }),
    ]);
    return this.get(ws);
  }
}
