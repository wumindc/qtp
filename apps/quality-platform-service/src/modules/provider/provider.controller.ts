import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import {
  ProviderService,
  type ModelConfigTestRequest,
  type ModelCreateRequest,
  type ModelQuery,
  type ModelRecord,
  type ModelUpdateRequest,
  type ProviderConfigTestRequest,
  type ProviderCreateRequest,
  type ProviderUpdateRequest,
} from './provider.service';

@Controller('ai-quality-platform/provider')
export class ProviderController {
  constructor(private readonly providerService = new ProviderService()) {}

  /**
   * @author codex
   * Returns configured model providers.
   */
  @Post('list.do')
  async list(@Body() request: { page: { currentPage: number; linesPerPage: number }; data?: Record<string, unknown> }) {
    return ok(await this.providerService.list(request.page));
  }

  @Post('create.do')
  async create(@Body() request: ProviderCreateRequest) {
    return ok(await this.providerService.create(request));
  }

  @Post('update.do')
  async update(@Body() request: { providerCode: string; data: ProviderUpdateRequest }) {
    return ok(await this.providerService.update(request.providerCode, request.data));
  }

  @Post('change-status.do')
  async changeStatus(@Body() request: { providerCode: string; enabled: boolean }) {
    return ok(await this.providerService.changeStatus(request.providerCode, request.enabled));
  }

  @Post('delete.do')
  async delete(@Body() request: { providerCode: string }) {
    return ok(await this.providerService.delete(request.providerCode));
  }

  @Post('test-connection.do')
  async testConnection(@Body() request: { providerCode: string }) {
    return ok(await this.providerService.testConnection(request.providerCode));
  }

  @Post('test-config.do')
  async testConfig(@Body() request: ProviderConfigTestRequest) {
    return ok(await this.providerService.testConfig(request));
  }

  @Post('model/list.do')
  async modelList(@Body() request: { page: { currentPage: number; linesPerPage: number }; data?: ModelQuery }) {
    return ok(await this.providerService.modelList(this.readRequiredObject<ModelQuery>(request.data, '缺少模型查询条件'), request.page));
  }

  @Post('model/create.do')
  async createModel(@Body() request: ModelCreateRequest) {
    return ok(await this.providerService.createModel(request));
  }

  @Post('model/update.do')
  async updateModel(@Body() request: { id: string; data: ModelUpdateRequest }) {
    return ok(await this.providerService.updateModel(request.id, request.data));
  }

  @Post('model/change-status.do')
  async changeModelStatus(@Body() request: { id: string; enabled: ModelRecord['enabled'] }) {
    return ok(await this.providerService.changeModelStatus(request.id, request.enabled));
  }

  @Post('model/test-connection.do')
  async testModelConnection(@Body() request: { id: string }) {
    return ok(await this.providerService.testModelConnection(request.id));
  }

  @Post('model/test-config.do')
  async testModelConfig(@Body() request: ModelConfigTestRequest) {
    return ok(await this.providerService.testModelConfigPayload(request));
  }

  @Post('model/delete.do')
  async deleteModel(@Body() request: { id: string }) {
    return ok(await this.providerService.deleteModel(request.id));
  }

  private readRequiredObject<TRecord extends object>(value: unknown, message: string): TRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as TRecord;
    throw new BadRequestException(message);
  }
}
