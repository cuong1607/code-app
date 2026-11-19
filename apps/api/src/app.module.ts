import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { type ApiEnv } from '@acs/shared';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { DashboardModule } from './dashboard/dashboard.module';
import { DraftsModule } from './drafts/drafts.module';
import { MediaModule } from './media/media.module';
import { ProductsModule } from './products/products.module';
import { ScriptsModule } from './scripts/scripts.module';
import { SettingsModule } from './settings/settings.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(env),
        PrismaModule,
        RedisModule,
        StorageModule,
        QueueModule,
        HealthModule,
        AuthModule,
        MediaModule,
        ProductsModule,
        DraftsModule,
        ScriptsModule,
        SettingsModule,
        DashboardModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
