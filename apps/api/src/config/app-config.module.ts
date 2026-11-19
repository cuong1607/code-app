import { type DynamicModule, Global, Module } from '@nestjs/common';
import { type ApiEnv } from '@acs/shared';

export const APP_ENV = Symbol('APP_ENV');

/** Cung cấp env đã được Zod kiểm tra cho toàn bộ app qua token APP_ENV. */
@Global()
@Module({})
export class AppConfigModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_ENV, useValue: env }],
      exports: [APP_ENV],
    };
  }
}
