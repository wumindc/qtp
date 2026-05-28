import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import {
  CaseService,
  type CaseCsvImportRequest,
  type CaseCategoryQuery,
  type CaseQuery,
  type CreateCaseCategoryRequest,
  type CreateCaseRequest,
  type PageQuery,
  type UpdateCaseCategoryRequest,
  type UpdateCaseRequest,
} from './case.service';
import { CaseExcelService } from './excel.service';

@Controller('ai-quality-platform/case')
export class CaseController {
  constructor(
    private readonly caseService = new CaseService(),
    private readonly excelService = new CaseExcelService(),
  ) {}

  /**
   * @author codex
   * Lists AI evaluation cases.
   */
  @Post('list.do')
  async list(@Body() request: { page: PageQuery; data: CaseQuery }) {
    return ok(await this.caseService.list(this.readRequiredObject<CaseQuery>(request?.data, '缺少用例查询条件'), request.page));
  }

  @Post('category/list.do')
  async categoryList(@Body() request: { page: PageQuery; data: CaseCategoryQuery }) {
    return ok(await this.caseService.listCategories(this.readRequiredObject<CaseCategoryQuery>(request?.data, '缺少分类查询条件'), request.page));
  }

  /**
   * @author codex
   * Maintains global preset case categories.
   */
  @Post('category/create.do')
  async createCategory(@Body() request: CreateCaseCategoryRequest) {
    return ok(await this.caseService.createCategory(request));
  }

  @Post('category/update.do')
  async updateCategory(@Body() request: { id: string; data: UpdateCaseCategoryRequest }) {
    return ok(await this.caseService.updateCategory(request.id, request.data));
  }

  @Post('category/change-enabled.do')
  async changeCategoryEnabled(@Body() request: { id: string; enabled: boolean }) {
    return ok(await this.caseService.changeCategoryEnabled(request.id, request.enabled));
  }

  @Post('category/delete.do')
  async deleteCategory(@Body() request: { id: string }) {
    return ok(await this.caseService.deleteCategory(request.id));
  }

  @Post('preset/list.do')
  async presetList(@Body() request: { page: PageQuery; data: CaseQuery }) {
    return ok(await this.caseService.listPresetCases(this.readRequiredObject<CaseQuery>(request?.data, '缺少预置用例查询条件'), request.page));
  }

  /**
   * @author codex
   * Maintains global reusable preset cases.
   */
  @Post('preset/create.do')
  async createPreset(@Body() request: CreateCaseRequest) {
    return ok(await this.caseService.createPresetCase(request));
  }

  @Post('preset/update.do')
  async updatePreset(@Body() request: { id: string; data: UpdateCaseRequest }) {
    return ok(await this.caseService.updatePresetCase(request.id, request.data));
  }

  @Post('preset/change-enabled.do')
  async changePresetEnabled(@Body() request: { id: string; enabled: boolean }) {
    return ok(await this.caseService.changePresetCaseEnabled(request.id, request.enabled));
  }

  @Post('preset/delete.do')
  async deletePreset(@Body() request: { id: string }) {
    return ok(await this.caseService.deletePresetCase(request.id));
  }

  @Post('preset/import-categories-to-app.do')
  async importPresetCategoriesToApp(@Body() request: { appCode: string; categoryIds: string[] }) {
    return ok(await this.caseService.importPresetCategoriesToApp(request));
  }

  @Post('preset/unsubscribe-category.do')
  async unsubscribePresetCategory(@Body() request: { appCode: string; categoryId: string }) {
    await this.caseService.unsubscribePresetCategory(request.appCode, request.categoryId);
    return ok(null);
  }

  @Post('preset/subscriptions.do')
  async listPresetSubscriptions(@Body() request: { appCode: string }) {
    return ok(await this.caseService.listCategorySubscriptions(request.appCode));
  }

  @Post('create.do')
  async create(@Body() request: CreateCaseRequest) {
    return ok(await this.caseService.create(request));
  }

  @Post('update.do')
  async update(@Body() request: { id: string; data: UpdateCaseRequest }) {
    return ok(await this.caseService.update(request.id, request.data));
  }

  @Post('change-enabled.do')
  async changeEnabled(@Body() request: { id: string; enabled: boolean }) {
    return ok(await this.caseService.changeEnabled(request.id, request.enabled));
  }

  @Post('delete.do')
  async delete(@Body() request: { id: string }) {
    return ok(await this.caseService.delete(request.id));
  }

  @Post('import-csv.do')
  async importCsvRows(@Body() request: CaseCsvImportRequest) {
    return ok(await this.caseService.importCsvRows({
      scope: request.scope,
      appCode: request.appCode,
      rows: this.readRequiredArray(request.rows, '缺少导入行'),
    }));
  }

  @Get('template.do')
  template() {
    return ok(this.caseService.excelTemplateHeaders());
  }

  @Get('template-file.do')
  templateFile() {
    return this.excelService.exportWorkbook(this.caseService.templateRows());
  }

  @Get('export.do')
  async exportFile() {
    return this.excelService.exportWorkbook(await this.caseService.exportRows());
  }

  private readRequiredObject<TRecord extends object>(value: unknown, message: string): TRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as TRecord;
    throw new BadRequestException(message);
  }

  private readRequiredArray<TItem>(value: unknown, message: string): TItem[] {
    if (Array.isArray(value)) return value as TItem[];
    throw new BadRequestException(message);
  }
}
