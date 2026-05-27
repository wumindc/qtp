import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { ReportService, type GenerateReportRequest } from './report.service';

@Controller('ai-quality-platform/report')
export class ReportController {
  constructor(private readonly reportService = new ReportService()) {}

  /**
   * @author codex
   * Returns dashboard metrics for the frontend workbench.
   */
  @Get('dashboard.do')
  async dashboard() {
    return ok(await this.reportService.dashboard());
  }

  @Post('list.do')
  async list(@Body() request: { page: { currentPage: number; linesPerPage: number }; data?: Record<string, string> }) {
    return ok(await this.reportService.list(request.data ?? {}, request.page));
  }

  @Get('detail/:reportCode.do')
  async detail(@Param('reportCode') reportCode: string) {
    return ok(await this.reportService.detail(reportCode));
  }

  @Post('export.do')
  async export(@Body() request: { reportCode: string }) {
    return ok(await this.reportService.exportReport(request.reportCode));
  }

  @Post('generate.do')
  async generate(@Body() request: GenerateReportRequest) {
    return ok(await this.reportService.generate(request));
  }
}
