import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getServicePort } from '@ai-quality-platform/shared-config';
import { GlobalExceptionFilter } from '@ai-quality-platform/shared-http';
import { AppModule } from './app.module';

/**
 * @author codex
 * Boots the internal AI invocation service on its planned local port.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(getServicePort('aiInvocation'));
}

void bootstrap();
