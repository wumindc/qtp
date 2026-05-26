import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import {
  AppService,
  type AppEvaluationConfigSaveRequest,
  type AppQuery,
  type AppRecord,
  type AppProtocolSaveRequest,
  type CreateAppRequest,
  type PageQuery,
  type UpdateAppRequest,
} from './app.service';

interface ListRequest {
  page: PageQuery;
  data: AppQuery;
}

@Controller('ai-quality-platform/app')
export class AppController {
  constructor(private readonly appService = new AppService()) {}

  /**
   * @author codex
   * Returns AI applications in the shared list response format.
   */
  @Post('list.do')
  async list(@Body() request: ListRequest) {
    return ok(await this.appService.list(request.data ?? {}, request.page));
  }

  @Post('create.do')
  async create(@Body() request: CreateAppRequest) {
    return ok(await this.appService.create(request));
  }

  @Post('update.do')
  async update(@Body() request: { appCode: string; data: UpdateAppRequest }) {
    return ok(await this.appService.update(request.appCode, request.data));
  }

  @Post('change-status.do')
  async changeStatus(@Body() request: { appCode: string; status: AppRecord['status'] }) {
    return ok(await this.appService.changeStatus(request.appCode, request.status));
  }

  /**
   * @author codex
   * Returns one AI application for the Semi workspace detail page.
   */
  @Post('detail.do')
  async detail(@Body() request: { appCode: string }) {
    return ok(await this.appService.detail(request.appCode));
  }

  @Post('delete.do')
  async delete(@Body() request: { appCode: string }) {
    return ok(await this.appService.delete(request.appCode));
  }

  /**
   * @author codex
   * Returns the protocol configuration for a single AI application.
   */
  @Post('protocol/detail.do')
  async protocolDetail(@Body() request: { appCode: string }) {
    return ok(await this.appService.protocolDetail(request.appCode));
  }

  @Post('protocol/save.do')
  async protocolSave(@Body() request: { appCode: string; data: AppProtocolSaveRequest }) {
    return ok(await this.appService.saveProtocol(request.appCode, request.data));
  }

  @Post('protocol/test.do')
  async protocolTest(@Body() request: { appCode: string; sampleInput?: Record<string, unknown> }) {
    return ok(await this.appService.testProtocol(request.appCode, request.sampleInput ?? {}));
  }

  @Post('evaluation-config/detail.do')
  async evaluationConfigDetail(@Body() request: { appCode: string }) {
    return ok(await this.appService.evaluationConfigDetail(request.appCode));
  }

  @Post('evaluation-config/save.do')
  async evaluationConfigSave(@Body() request: { appCode: string; data: AppEvaluationConfigSaveRequest }) {
    return ok(await this.appService.saveEvaluationConfig(request.appCode, request.data));
  }
}
