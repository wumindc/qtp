import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { AppController } from './modules/app/app.controller';
import { ProviderController } from './modules/provider/provider.controller';
import { CaseController } from './modules/case/case.controller';
import { PlanController } from './modules/plan/plan.controller';
import { ReviewController } from './modules/review/review.controller';
import { ReportController } from './modules/report/report.controller';
import { AuthController } from './modules/auth/auth.controller';

const MODULE_NAMES = ['app', 'case', 'plan', 'provider', 'review', 'report', 'auth'];

describe('quality-platform-service AppModule', () => {
  it('registers all consolidated platform controllers', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule);

    expect(controllers).toEqual(
      expect.arrayContaining([
        AppController,
        ProviderController,
        CaseController,
        PlanController,
        ReviewController,
        ReportController,
        AuthController,
      ]),
    );
  });

  it('keeps every platform module documented with a contract README', () => {
    for (const moduleName of MODULE_NAMES) {
      const readmePath = join(import.meta.dirname, 'modules', moduleName, 'README.md');
      expect(existsSync(readmePath), `${moduleName} module README missing`).toBe(true);
      const content = readFileSync(readmePath, 'utf8');
      expect(content).toContain('职责边界');
      expect(content).toContain('依赖规则');
    }
  });
});
