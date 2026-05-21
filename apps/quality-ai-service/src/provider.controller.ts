import { Body, Controller, Post } from '@nestjs/common';
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
  list(@Body() request: { page: { currentPage: number; linesPerPage: number }; data?: Record<string, unknown> }) {
    return this.providerService.list(request.page);
  }

  @Post('create.do')
  create(@Body() request: ProviderCreateRequest) {
    return this.providerService.create(request);
  }

  @Post('update.do')
  update(@Body() request: { providerCode: string; data: ProviderUpdateRequest }) {
    return this.providerService.update(request.providerCode, request.data);
  }

  @Post('change-status.do')
  changeStatus(@Body() request: { providerCode: string; enabled: boolean }) {
    return this.providerService.changeStatus(request.providerCode, request.enabled);
  }

  @Post('delete.do')
  delete(@Body() request: { providerCode: string }) {
    return this.providerService.delete(request.providerCode);
  }

  @Post('test-connection.do')
  testConnection(@Body() request: { providerCode: string }) {
    return this.providerService.testConnection(request.providerCode);
  }

  @Post('test-config.do')
  testConfig(@Body() request: ProviderConfigTestRequest) {
    return this.providerService.testConfig(request);
  }

  @Post('model/list.do')
  modelList(@Body() request: { page: { currentPage: number; linesPerPage: number }; data?: ModelQuery }) {
    return this.providerService.modelList(request.data ?? {}, request.page);
  }

  @Post('model/create.do')
  createModel(@Body() request: ModelCreateRequest) {
    return this.providerService.createModel(request);
  }

  @Post('model/update.do')
  updateModel(@Body() request: { id: string; data: ModelUpdateRequest }) {
    return this.providerService.updateModel(request.id, request.data);
  }

  @Post('model/change-status.do')
  changeModelStatus(@Body() request: { id: string; enabled: ModelRecord['enabled'] }) {
    return this.providerService.changeModelStatus(request.id, request.enabled);
  }

  @Post('model/test-connection.do')
  testModelConnection(@Body() request: { id: string }) {
    return this.providerService.testModelConnection(request.id);
  }

  @Post('model/test-config.do')
  testModelConfig(@Body() request: ModelConfigTestRequest) {
    return this.providerService.testModelConfigPayload(request);
  }

  @Post('model/delete.do')
  deleteModel(@Body() request: { id: string }) {
    return this.providerService.deleteModel(request.id);
  }
}
