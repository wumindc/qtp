import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { ExecutionService } from './execution.service';

@Controller('ai-quality-platform/execution')
export class ExecutionController {
  constructor(private readonly executionService = new ExecutionService()) {}

  /**
   * @author codex
   * Starts a test execution batch.
   */
  @Post('start.do')
  async start(@Body() request: { planCode: string; appCode: string; caseCodes?: string[] }) {
    return ok(await this.executionService.start(request));
  }

  @Post('run-list.do')
  async runList(@Body() request: { page: { currentPage: number; linesPerPage: number }; data: Record<string, unknown> }) {
    return ok(await this.executionService.runList(request.data ?? {}, request.page));
  }

  @Post('result-list.do')
  async resultList(@Body() request: { runCode: string; page: { currentPage: number; linesPerPage: number } }) {
    return ok(await this.executionService.resultList(request.runCode, request.page));
  }

  @Post('run-detail.do')
  async runDetail(@Body() request: { runCode: string }) {
    return ok(await this.executionService.runDetail(request.runCode));
  }

  @Post('run-versions.do')
  async runVersions(@Body() request: { runCode: string }) {
    return ok(await this.executionService.runVersions(request.runCode));
  }

  @Post('rerun.do')
  async rerun(@Body() request: { runCode: string }) {
    return ok(await this.executionService.rerun(request.runCode));
  }

  @Post('cancel.do')
  async cancel(@Body() request: { runCode: string }) {
    return ok(await this.executionService.cancel(request.runCode));
  }
}
