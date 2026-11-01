import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG, configuration, AppConfig } from './config/configuration';
import { AppLogger } from './common/logging/app-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get<AppConfig>(APP_CONFIG);
  const logger = app.get(AppLogger);

  app.useLogger(logger);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix(config.apiPrefix);
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    exposedHeaders: ['x-request-id', 'x-ratelimit-remaining', 'retry-after'],
  });
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');

  logger.info('api started', {
    port: config.port,
    env: config.nodeEnv,
    apiPrefix: config.apiPrefix,
  });
}

void bootstrap().catch((error: unknown) => {
  console.error('the API could not be started', error);
  process.exitCode = 1;
});

export { configuration };
