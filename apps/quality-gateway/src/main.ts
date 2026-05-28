import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { GATEWAY_PORT } from '@ai-quality-platform/shared-config';
import { GlobalExceptionFilter } from '@ai-quality-platform/shared-http';
import { AppModule } from './app.module';

/**
 * @author codex
 * Boots the unified backend gateway on port 8080.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(GATEWAY_PORT);
}

void bootstrap();
