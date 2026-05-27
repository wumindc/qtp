import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AppController } from './modules/app/app.controller';
import { AppService } from './modules/app/app.service';
import { CaseController } from './modules/case/case.controller';
import { CaseExcelService } from './modules/case/excel.service';
import { CaseService } from './modules/case/case.service';
import { PlanController } from './modules/plan/plan.controller';
import { PlanService } from './modules/plan/plan.service';
import { ProviderController } from './modules/provider/provider.controller';
import { ProviderService } from './modules/provider/provider.service';
import { ReviewController } from './modules/review/review.controller';
import { ReviewService } from './modules/review/review.service';
import { ReportController } from './modules/report/report.controller';
import { ReportService } from './modules/report/report.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';

@Module({
  controllers: [
    HealthController,
    AppController,
    CaseController,
    PlanController,
    ProviderController,
    ReviewController,
    ReportController,
    AuthController,
  ],
  providers: [
    AppService,
    CaseService,
    CaseExcelService,
    PlanService,
    ProviderService,
    ReviewService,
    ReportService,
    AuthService,
  ],
})
export class AppModule {}
