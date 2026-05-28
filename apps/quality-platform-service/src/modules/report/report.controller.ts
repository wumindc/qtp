/**
 * @author codex
 * @author Antigravity/Claude-Sonnet-4.6
 */
import { Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { ReportService } from './report.service';

@Controller('ai-quality-platform/report')
export class ReportController {
  constructor(private readonly reportService = new ReportService()) {}

  /**
   * @author codex
   * Returns dashboard metrics for the frontend workbench.
   * 注意：统一使用 POST 与项目其他接口保持一致。
   */
  @Post('dashboard.do')
  async dashboard() {
    return ok(await this.reportService.dashboard());
  }
}
