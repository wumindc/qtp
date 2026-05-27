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

  @Post('judge-call/detail.do')
  async judgeCallDetail(@Body() request: { resultId: string }) {
    return ok(await this.executionService.judgeCallDetail(request.resultId));
  }

  @Post('cost/recalculate.do')
  async recalculateCost(@Body() request: { runCode: string }) {
    return ok(await this.executionService.recalculateCost(request.runCode));
  }

  @Post('rerun.do')
  async rerun(@Body() request: { runCode: string }) {
    return ok(await this.executionService.rerun(request.runCode));
  }

  /**
   * 仅重新发起 AI 评估，不重新调用业务接口
   * @author Antigravity/Claude-Sonnet-4.6
   */
  @Post('re-evaluate.do')
  async reEvaluate(@Body() request: { resultIds: string[] }) {
    return ok(await this.executionService.reEvaluate(request.resultIds));
  }

  @Post('cancel.do')
  async cancel(@Body() request: { runCode: string }) {
    return ok(await this.executionService.cancel(request.runCode));
  }
}
