import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import {
  PlanService,
  type CreatePlanRequest,
  type PlanRecord,
  type PreviewCasesRequest,
  type UpdatePlanRequest,
} from './plan.service';

@Controller('ai-quality-platform/plan')
export class PlanController {
  constructor(private readonly planService = new PlanService()) {}

  /**
   * @author codex
   * Lists configured test plans.
   */
  @Post('list.do')
  async list(@Body() request: { page: { currentPage: number; linesPerPage: number }; data: Record<string, unknown> }) {
    return ok(await this.planService.list(request.data ?? {}, request.page));
  }

  @Post('create.do')
  async create(@Body() request: CreatePlanRequest) {
    return ok(await this.planService.create(request));
  }

  @Post('update.do')
  async update(@Body() request: { planCode: string; data: UpdatePlanRequest }) {
    return ok(await this.planService.update(request.planCode, request.data));
  }

  @Post('change-status.do')
  async changeStatus(@Body() request: { planCode: string; status: PlanRecord['status'] }) {
    return ok(await this.planService.changeStatus(request.planCode, request.status));
  }

  @Post('delete.do')
  async delete(@Body() request: { planCode: string }) {
    return ok(await this.planService.delete(request.planCode));
  }

  @Post('preview-cases.do')
  async previewCases(@Body() request: PreviewCasesRequest) {
    return ok(await this.planService.previewCases(request));
  }

  @Post('start.do')
  async start(@Body() request: { planCode: string }) {
    return ok(await this.planService.start(request.planCode));
  }
}
