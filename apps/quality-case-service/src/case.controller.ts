import { Body, Controller, Get, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import {
  CaseService,
  type CaseCategoryQuery,
  type CaseQuery,
  type CreateCaseCategoryRequest,
  type CreateCaseRequest,
  type CreateCaseSuiteRequest,
  type PageQuery,
  type PresetImportRequest,
  type SuiteQuery,
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
    return ok(await this.caseService.list(request.data ?? {}, request.page));
  }

  @Post('category/list.do')
  async categoryList(@Body() request: { page: PageQuery; data: CaseCategoryQuery }) {
    return ok(await this.caseService.listCategories(request.data ?? {}, request.page));
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
  async updateCategory(@Body() request: { id: string; code?: string; data: UpdateCaseCategoryRequest }) {
    return ok(await this.caseService.updateCategory(request.id ?? request.code, request.data));
  }

  @Post('category/change-enabled.do')
  async changeCategoryEnabled(@Body() request: { id: string; code?: string; enabled: boolean }) {
    return ok(await this.caseService.changeCategoryEnabled(request.id ?? request.code, request.enabled));
  }

  @Post('category/delete.do')
  async deleteCategory(@Body() request: { id: string; code?: string }) {
    return ok(await this.caseService.deleteCategory(request.id ?? request.code));
  }

  @Post('preset/list.do')
  async presetList(@Body() request: { page: PageQuery; data: CaseQuery }) {
    return ok(await this.caseService.listPresetCases(request.data ?? {}, request.page));
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
  async updatePreset(@Body() request: { id: string; caseCode?: string; data: UpdateCaseRequest }) {
    return ok(await this.caseService.updatePresetCase(request.id ?? request.caseCode, request.data));
  }

  @Post('preset/change-enabled.do')
  async changePresetEnabled(@Body() request: { id: string; caseCode?: string; enabled: boolean }) {
    return ok(await this.caseService.changePresetCaseEnabled(request.id ?? request.caseCode, request.enabled));
  }

  @Post('preset/delete.do')
  async deletePreset(@Body() request: { id: string; caseCode?: string }) {
    return ok(await this.caseService.deletePresetCase(request.id ?? request.caseCode));
  }

  /**
   * @author codex
   * Imports selected global preset cases into an application workspace.
   */
  @Post('preset/import-to-app.do')
  async importPresetToApp(@Body() request: PresetImportRequest) {
    return ok(await this.caseService.importPresetCasesToApp(request));
  }

  @Post('create.do')
  async create(@Body() request: CreateCaseRequest) {
    return ok(await this.caseService.create(request));
  }

  @Post('update.do')
  async update(@Body() request: { id: string; caseCode?: string; data: UpdateCaseRequest }) {
    return ok(await this.caseService.update(request.id ?? request.caseCode, request.data));
  }

  @Post('change-enabled.do')
  async changeEnabled(@Body() request: { id: string; caseCode?: string; enabled: boolean }) {
    return ok(await this.caseService.changeEnabled(request.id ?? request.caseCode, request.enabled));
  }

  @Post('delete.do')
  async delete(@Body() request: { id: string; caseCode?: string }) {
    return ok(await this.caseService.delete(request.id ?? request.caseCode));
  }

  @Post('import.do')
  async importRows(@Body() request: { rows: CreateCaseRequest[] }) {
    return ok(await this.caseService.importRows(request.rows ?? []));
  }

  /**
   * @author codex
   * Lists case suites for the selected AI application.
   */
  @Post('suite/list.do')
  async suiteList(@Body() request: { page: PageQuery; data: SuiteQuery }) {
    return ok(await this.caseService.listSuites(request.data ?? {}, request.page));
  }

  @Post('suite/create.do')
  createSuite(@Body() request: CreateCaseSuiteRequest) {
    return ok(this.caseService.createSuite(request));
  }

  @Post('suite/bind-cases.do')
  bindSuiteCases(@Body() request: { suiteCode: string; caseCodes: string[] }) {
    return ok(this.caseService.bindSuiteCases(request.suiteCode, request.caseCodes ?? []));
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
  exportFile() {
    return this.excelService.exportWorkbook(this.caseService.exportRows());
  }
}
