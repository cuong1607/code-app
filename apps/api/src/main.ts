import 'reflect-metadata';
import { type LogLevel, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EnvValidationError, toErrorMessage } from '@acs/shared';
import { AppModule } from './app.module';
import { loadApiEnv } from './config/load-env';

const LOG_LEVELS: Record<string, LogLevel[]> = {
  error: ['fatal', 'error'],
  warn: ['fatal', 'error', 'warn'],
  log: ['fatal', 'error', 'warn', 'log'],
  info: ['fatal', 'error', 'warn', 'log'],
  debug: ['fatal', 'error', 'warn', 'log', 'debug'],
  verbose: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
};

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  const app = await NestFactory.create(AppModule.forRoot(env), {
    logger: LOG_LEVELS[env.LOG_LEVEL],
  });

  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, env.API_HOST);
  Logger.log(`API đang chạy tại http://localhost:${env.API_PORT} (health: /health)`, 'Bootstrap');
}

process.on('unhandledRejection', (reason) => {
  Logger.error(`unhandledRejection: ${toErrorMessage(reason)}`, undefined, 'Process');
});

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(`\n${error.message}\n\nHãy kiểm tra file .env (xem .env.example).\n`);
  } else {
    console.error('Không khởi động được API:', error);
  }
  process.exit(1);
});
