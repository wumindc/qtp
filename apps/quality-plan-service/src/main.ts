import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getServicePort } from '@ai-quality-platform/shared-config';
import { AppModule } from './app.module';

/**
 * @author codex
 * Boots the plan service on its planned local port.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  await app.listen(getServicePort('plan'));
}

void bootstrap();
