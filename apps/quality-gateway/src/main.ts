import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { GATEWAY_PORT } from '@ai-quality-platform/shared-config';
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
  await app.listen(GATEWAY_PORT);
}

void bootstrap();
