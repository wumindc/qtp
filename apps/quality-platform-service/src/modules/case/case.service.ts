import {
  createRuntimePrismaClient,
  SYSTEM_PRESET_APP_CODE,
} from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';
import { randomBytes } from 'node:crypto';
import type { CaseExcelRow } from './excel.service';

export interface CaseQuery {
  appCode?: string;
  categoryId?: string;
  keyword?: string;
  caseScope?: 'APP' | 'SYSTEM_PRESET';
}

export interface PageQuery {
  currentPage: number;
  linesPerPage: number;
}

export interface CaseRecord {
  id: string;
  appCode: string;
  caseScope: 'APP' | 'SYSTEM_PRESET';
  categoryId: string;
  caseCode: string;
  query: string;
  expectedBehavior: string;
  enabled: boolean;
  isSubscribedPreset?: boolean;
}

export interface CreateCaseRequest {
  appCode: string;
  categoryId: string;
  query: string;
  expectedBehavior: string;
  enabled?: boolean;
}

export interface UpdateCaseRequest {
  categoryId?: string;
  query?: string;
  expectedBehavior?: string;
  enabled?: boolean;
}

export interface CaseCategoryRecord {
  id: string;
  appCode?: string;
  name: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
}

export interface CreateCaseCategoryRequest {
  id?: string;
  appCode?: string;
  name: string;
  description: string;
  sortOrder?: number;
  enabled?: boolean;
}
export type UpdateCaseCategoryRequest = Partial<Omit<CaseCategoryRecord, 'id'>>;

export interface CaseCategoryQuery {
  appCode?: string;
  includeGlobal?: boolean;
  keyword?: string;
  enabled?: boolean;
  subscribedByApp?: string;
}

export interface CaseCsvImportRow {
  categoryName?: string;
  query?: string;
  expectedBehavior?: string;
}

export interface CaseCsvImportRequest {
  scope: 'APP' | 'SYSTEM_PRESET';
  appCode?: string;
  rows: CaseCsvImportRow[];
}

export interface CaseCsvImportResult {
  created: number;
  updated: number;
  createdCategories: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  message: string;
}

type CasePrismaClient = {
  evalCaseCategory: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: object; data: object }): Promise<unknown>;
    delete(input: { where: object }): Promise<unknown>;
  };
  evalCase: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: object; data: object }): Promise<unknown>;
    delete(input: { where: object }): Promise<unknown>;
  };
  appPresetCategory: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
    create(input: { data: object }): Promise<unknown>;
    delete(input: { where: object }): Promise<unknown>;
  };
};

type EvalCaseCategoryRow = {
  id?: unknown;
  appCode?: unknown;
  name?: unknown;
  description?: unknown;
  enabled?: unknown;
  sortOrder?: unknown;
};

type EvalCaseRow = {
  id?: unknown;
  appCode?: unknown;
  caseScope?: unknown;
  categoryId?: unknown;
  inputJson?: unknown;
  expectedJson?: unknown;
  enabled?: unknown;
};

type AppPresetCategoryRow = {
  appCode?: unknown;
  categoryId?: unknown;
};

export interface CaseDataStore {
  listCategories(): Promise<CaseCategoryRecord[]>;
  listCases(): Promise<CaseRecord[]>;
  listPresetCategorySubscriptions(): Promise<Array<{ appCode: string; categoryId: string }>>;
  saveCategory(category: CaseCategoryRecord): Promise<CaseCategoryRecord>;
  deleteCategory(id: string): Promise<void>;
  saveCase(testCase: CaseRecord): Promise<CaseRecord>;
  deleteCase(id: string): Promise<void>;
  savePresetCategorySubscription(appCode: string, categoryId: string): Promise<void>;
  deletePresetCategorySubscription(appCode: string, categoryId: string): Promise<void>;
}

class CaseDatabaseWriter implements CaseDataStore {
  private readonly prismaPromise: Promise<CasePrismaClient>;

  constructor() {
    this.prismaPromise = this.createClient();
  }

  /**
   * @author codex
   * Reads category and case definitions from MySQL through Prisma.
   */
  async listCategories(): Promise<CaseCategoryRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = (await prisma.evalCaseCategory.findMany({ orderBy: { id: 'asc' } })) as EvalCaseCategoryRow[];
    return rows.map((row) => this.toCategoryRecord(row));
  }

  async listCases(): Promise<CaseRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = (await prisma.evalCase.findMany({ orderBy: { id: 'asc' } })) as EvalCaseRow[];
    return rows.map((row) => this.toCaseRecord(row));
  }

  async listPresetCategorySubscriptions(): Promise<Array<{ appCode: string; categoryId: string }>> {
    const prisma = await this.prismaPromise;
    const rows = (await prisma.appPresetCategory.findMany({ orderBy: { id: 'asc' } })) as AppPresetCategoryRow[];
    return rows.map((row) => ({
      appCode: this.readRequiredString(row.appCode, '预置订阅缺少应用编码'),
      categoryId: this.readRequiredBigIntId(row.categoryId, '预置订阅缺少分类 ID'),
    }));
  }

  async saveCategory(category: CaseCategoryRecord): Promise<CaseCategoryRecord> {
    const prisma = await this.prismaPromise;
    const payload = {
      appCode: category.appCode ?? null,
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      enabled: category.enabled,
    };
    let saved: unknown;
    if (this.isDatabaseId(category.id)) {
      saved = await prisma.evalCaseCategory.update({
        where: { id: BigInt(category.id) },
        data: payload,
      });
    } else {
      saved = await prisma.evalCaseCategory.create({
        data: payload,
      });
    }
    const id = this.readRequiredBigIntId(this.asRecord(saved).id, '数据库未返回分类 ID');
    return { ...category, id };
  }

  async deleteCategory(id: string) {
    const prisma = await this.prismaPromise;
    if (!this.isDatabaseId(id)) throw new Error(`分类不存在: ${id}`);
    await prisma.evalCaseCategory.delete({ where: { id: BigInt(id) } });
  }

  async saveCase(testCase: CaseRecord): Promise<CaseRecord> {
    const prisma = await this.prismaPromise;
    if (!this.isDatabaseId(testCase.categoryId)) throw new Error(`测试用例分类不可用 ${testCase.categoryId}`);
    const payload = {
      appCode: testCase.appCode,
      caseScope: testCase.caseScope,
      categoryId: BigInt(testCase.categoryId),
      inputJson: { query: testCase.query },
      expectedJson: { expectedBehavior: testCase.expectedBehavior },
      enabled: testCase.enabled,
    };
    let saved: unknown;
    if (this.isDatabaseId(testCase.id)) {
      saved = await prisma.evalCase.update({
        where: { id: BigInt(testCase.id) },
        data: payload,
      });
    } else {
      saved = await prisma.evalCase.create({ data: payload });
    }
    const id = this.readRequiredBigIntId(this.asRecord(saved).id, '数据库未返回用例 ID');
    return { ...testCase, id, caseCode: id };
  }

  async deleteCase(id: string) {
    const prisma = await this.prismaPromise;
    if (!this.isDatabaseId(id)) throw new Error(`用例不存在: ${id}`);
    await prisma.evalCase.delete({ where: { id: BigInt(id) } });
  }

  async savePresetCategorySubscription(appCode: string, categoryId: string) {
    const prisma = await this.prismaPromise;
    if (!this.isDatabaseId(categoryId)) throw new Error(`分类不存在: ${categoryId}`);
    try {
      await prisma.appPresetCategory.create({
        data: {
          appCode,
          categoryId: BigInt(categoryId),
        },
      });
    } catch (error) {
      if (!this.isPrismaKnownErrorCode(error, 'P2002')) throw error;
    }
  }

  async deletePresetCategorySubscription(appCode: string, categoryId: string) {
    const prisma = await this.prismaPromise;
    if (!this.isDatabaseId(categoryId)) throw new Error(`分类不存在: ${categoryId}`);
    try {
      await prisma.appPresetCategory.delete({
        where: {
          appCode_categoryId: {
            appCode,
            categoryId: BigInt(categoryId),
          },
        },
      });
    } catch (error) {
      if (!this.isPrismaKnownErrorCode(error, 'P2025')) throw error;
    }
  }

  private async createClient(): Promise<CasePrismaClient> {
    return createRuntimePrismaClient<CasePrismaClient>();
  }

  private toCategoryRecord(row: EvalCaseCategoryRow): CaseCategoryRecord {
    const id = this.readRequiredBigIntId(row.id, '分类记录缺少 ID');
    return {
      id,
      appCode: this.readNullableString(row.appCode, '分类记录包含非法应用编码'),
      name: this.readRequiredString(row.name, '分类记录缺少名称'),
      description: this.readString(row.description, '分类记录缺少描述'),
      enabled: this.readBoolean(row.enabled, '分类记录缺少启停状态'),
      sortOrder: this.readNumber(row.sortOrder, '分类记录缺少排序值'),
    };
  }

  private toCaseRecord(row: EvalCaseRow): CaseRecord {
    const inputJson = this.readRecord(row.inputJson, '用例记录缺少输入 JSON');
    const expectedJson = this.readRecord(row.expectedJson, '用例记录缺少期望 JSON');
    const id = this.readRequiredBigIntId(row.id, '用例记录缺少 ID');
    return {
      id,
      caseCode: id,
      appCode: this.readRequiredString(row.appCode, '用例记录缺少应用编码'),
      caseScope: this.readCaseScope(row.caseScope),
      categoryId: this.readRequiredBigIntId(row.categoryId, '用例记录缺少分类 ID'),
      query: this.readRequiredString(inputJson.query, '用例记录缺少问题内容'),
      expectedBehavior: this.readRequiredString(expectedJson.expectedBehavior, '用例记录缺少期望回答'),
      enabled: this.readBoolean(row.enabled, '用例记录缺少启停状态'),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private readRecord(value: unknown, message: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
    return value as Record<string, unknown>;
  }

  private readRequiredBigIntId(value: unknown, message: string): string {
    if (typeof value !== 'bigint') throw new Error(message);
    return value.toString();
  }

  private readRequiredString(value: unknown, message: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(message);
    return value;
  }

  private readString(value: unknown, message: string): string {
    if (typeof value !== 'string') throw new Error(message);
    return value;
  }

  private readNullableString(value: unknown, message: string): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') throw new Error(message);
    return value;
  }

  private readBoolean(value: unknown, message: string): boolean {
    if (typeof value !== 'boolean') throw new Error(message);
    return value;
  }

  private readNumber(value: unknown, message: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message);
    return value;
  }

  private readCaseScope(value: unknown): 'APP' | 'SYSTEM_PRESET' {
    if (value === 'APP' || value === 'SYSTEM_PRESET') return value;
    throw new Error('用例记录包含非法用例范围');
  }

  private isDatabaseId(id: string | undefined): id is string {
    return typeof id === 'string' && /^\d+$/.test(id);
  }

  private isPrismaKnownErrorCode(error: unknown, code: string) {
    return this.asRecord(error).code === code;
  }
}

export class CaseService {
  constructor(
    private readonly database: CaseDataStore = new CaseDatabaseWriter(),
  ) {}

  async listCategories(query: CaseCategoryQuery, page?: PageQuery): Promise<PageResult<CaseCategoryRecord>> {
    const normalizedPage = this.normalizePage(page);
    const appCode = query.appCode?.trim();
    const includeGlobal = query.includeGlobal !== false;
    const normalizedKeyword = query.keyword?.trim().toLowerCase();
    const sourceCategories = await this.getCategorySource();

    let subscribedIds: Set<string> | undefined;
    if (query.subscribedByApp) {
      subscribedIds = new Set(await this.listCategorySubscriptions(query.subscribedByApp));
    }

    const all = sourceCategories.filter((category) => {
      if (subscribedIds) {
        if (!subscribedIds.has(category.id)) return false;
      } else {
        const scopeMatched = appCode
          ? category.appCode === appCode || (includeGlobal && !category.appCode)
          : !category.appCode;
        if (!scopeMatched) return false;
      }

      const keywordMatched =
        !normalizedKeyword ||
        category.name.toLowerCase().includes(normalizedKeyword) ||
        category.description.toLowerCase().includes(normalizedKeyword);
      const enabledMatched = query.enabled === undefined || category.enabled === query.enabled;
      return keywordMatched && enabledMatched;
    });
    const start = (normalizedPage.currentPage - 1) * normalizedPage.linesPerPage;
    return pageResult(
      all.slice(start, start + normalizedPage.linesPerPage),
      normalizedPage.currentPage,
      normalizedPage.linesPerPage,
      all.length,
    );
  }

  async createCategory(request: CreateCaseCategoryRequest): Promise<CaseCategoryRecord> {
    this.validateCategory(request);
    const appCode = request.appCode?.trim() || undefined;
    const categories = await this.getCategorySource();
    if (categories.some((category) => category.name === request.name && category.appCode === appCode)) {
      throw new Error('分类名称已存在');
    }
    const id = request.id ?? this.generateEntityId('category');
    const record: CaseCategoryRecord = {
      id,
      appCode,
      name: request.name.trim(),
      description: request.description.trim(),
      enabled: request.enabled ?? true,
      sortOrder: request.sortOrder ?? (categories.length + 1) * 10,
    };
    return this.database.saveCategory(record);
  }

  async updateCategory(id: string, request: UpdateCaseCategoryRequest): Promise<CaseCategoryRecord> {
    const category = await this.findCategoryById(id);
    if (!category) throw new Error('分类不存在');
    const updated: CaseCategoryRecord = {
      id,
      appCode: request.appCode === undefined ? category.appCode : request.appCode?.trim() || undefined,
      name: request.name ?? category.name,
      description: request.description ?? category.description,
      enabled: request.enabled ?? category.enabled,
      sortOrder: request.sortOrder ?? category.sortOrder,
    };
    this.validateCategory(updated);
    return this.database.saveCategory(updated);
  }

  async changeCategoryEnabled(id: string, enabled: boolean): Promise<CaseCategoryRecord> {
    return this.updateCategory(id, { enabled });
  }

  async deleteCategory(id: string): Promise<CaseCategoryRecord> {
    const cases = await this.database.listCases();
    if (cases.some((testCase) => testCase.caseScope === 'APP' && testCase.categoryId === id)) {
      throw new Error('分类下仍有关联应用测试用例');
    }
    if (cases.some((testCase) => testCase.caseScope === 'SYSTEM_PRESET' && testCase.categoryId === id)) {
      throw new Error('分类下仍有关联系统预置测试用例');
    }
    const category = await this.findCategoryById(id);
    if (!category) throw new Error('分类不存在');
    await this.database.deleteCategory(id);
    return category;
  }

  /**
   * @author codex
   * Lists cases by category and keyword using the shared page shape.
   */
  async list(query: CaseQuery, page?: PageQuery): Promise<PageResult<CaseRecord>> {
    const normalizedPage = this.normalizePage(page);
    const categoryId = query.categoryId;
    const scope = query.caseScope === 'SYSTEM_PRESET' ? 'SYSTEM_PRESET' : 'APP';
    const appCode = query.appCode;

    const sourceCases = await this.getCaseSource(scope);
    let all = sourceCases.filter((testCase) => {
      const appMatched = !appCode || testCase.appCode === appCode;
      const categoryMatched = !categoryId || testCase.categoryId === categoryId;
      const keywordMatched =
        !query.keyword ||
        testCase.query.includes(query.keyword) ||
        testCase.expectedBehavior.includes(query.keyword);
      return appMatched && categoryMatched && keywordMatched;
    });

    if (scope === 'APP' && appCode) {
      const subscribedIds = new Set(await this.listCategorySubscriptions(appCode));
      if (subscribedIds.size > 0) {
        const presetCases = await this.getCaseSource('SYSTEM_PRESET');
        const matchedPresets = presetCases.filter((testCase) => {
          const isSubscribed = subscribedIds.has(testCase.categoryId);
          const categoryMatched = !categoryId || testCase.categoryId === categoryId;
          const keywordMatched =
            !query.keyword ||
            testCase.query.includes(query.keyword) ||
            testCase.expectedBehavior.includes(query.keyword);
          return isSubscribed && categoryMatched && keywordMatched;
        }).map(testCase => ({ ...testCase, isSubscribedPreset: true }));
        all = [...all, ...matchedPresets];
      }
    }

    all.sort((a, b) => a.id.localeCompare(b.id));

    const start = (normalizedPage.currentPage - 1) * normalizedPage.linesPerPage;
    return pageResult(
      all.slice(start, start + normalizedPage.linesPerPage),
      normalizedPage.currentPage,
      normalizedPage.linesPerPage,
      all.length,
    );
  }

  async listPresetCases(query: CaseQuery, page?: PageQuery): Promise<PageResult<CaseRecord>> {
    return this.list({ ...query, appCode: SYSTEM_PRESET_APP_CODE, caseScope: 'SYSTEM_PRESET' }, page);
  }

  async create(request: CreateCaseRequest): Promise<CaseRecord> {
    const record = this.toCaseRecordFromRequest(
      request,
      {
        id: this.generateEntityId('case'),
        categoryId: request.categoryId,
        caseScope: 'APP' as const,
        enabled: request.enabled ?? true,
      },
    );
    await this.validateCaseCategory(record.categoryId, record.appCode);
    return this.database.saveCase(record);
  }

  async update(id: string, request: UpdateCaseRequest): Promise<CaseRecord> {
    const testCase = await this.findCaseById(id, 'APP');
    if (!testCase) throw new Error('用例不存在');
    if (request.categoryId) await this.validateCaseCategory(request.categoryId, testCase.appCode);
    const nextCategoryId = request.categoryId === undefined
      ? testCase.categoryId
      : this.readRequiredRequestString(request.categoryId, '缺少分类 ID');
    const nextQuery = request.query === undefined
      ? testCase.query
      : this.readRequiredRequestString(request.query, '缺少问题内容');
    const nextExpectedBehavior = request.expectedBehavior === undefined
      ? testCase.expectedBehavior
      : this.readRequiredRequestString(request.expectedBehavior, '缺少期望回答');
    const updated: CaseRecord = {
      appCode: testCase.appCode,
      id,
      caseCode: id,
      categoryId: nextCategoryId,
      query: nextQuery,
      expectedBehavior: nextExpectedBehavior,
      enabled: request.enabled ?? testCase.enabled,
      caseScope: testCase.caseScope,
    };
    return this.database.saveCase(updated);
  }

  async createPresetCase(request: CreateCaseRequest): Promise<CaseRecord> {
    const record = this.toCaseRecordFromRequest(
      request,
      {
        id: this.generateEntityId('preset_case'),
        categoryId: request.categoryId,
        appCode: SYSTEM_PRESET_APP_CODE,
        caseScope: 'SYSTEM_PRESET',
        enabled: request.enabled ?? true,
      },
    );
    await this.validateCaseCategory(record.categoryId);
    return this.database.saveCase(record);
  }

  async updatePresetCase(id: string, request: UpdateCaseRequest): Promise<CaseRecord> {
    const testCase = await this.findCaseById(id, 'SYSTEM_PRESET');
    if (!testCase) throw new Error('预置用例不存在');
    if (request.categoryId) await this.validateCaseCategory(request.categoryId);
    const nextCategoryId = request.categoryId === undefined
      ? testCase.categoryId
      : this.readRequiredRequestString(request.categoryId, '缺少分类 ID');
    const nextQuery = request.query === undefined
      ? testCase.query
      : this.readRequiredRequestString(request.query, '缺少问题内容');
    const nextExpectedBehavior = request.expectedBehavior === undefined
      ? testCase.expectedBehavior
      : this.readRequiredRequestString(request.expectedBehavior, '缺少期望回答');
    const updated: CaseRecord = {
      id,
      caseCode: id,
      categoryId: nextCategoryId,
      query: nextQuery,
      expectedBehavior: nextExpectedBehavior,
      enabled: request.enabled ?? testCase.enabled,
      appCode: SYSTEM_PRESET_APP_CODE,
      caseScope: 'SYSTEM_PRESET' as const,
    };
    return this.database.saveCase(updated);
  }

  async changePresetCaseEnabled(id: string, enabled: boolean): Promise<CaseRecord> {
    return this.updatePresetCase(id, { enabled });
  }

  async deletePresetCase(id: string): Promise<CaseRecord> {
    const testCase = await this.findCaseById(id, 'SYSTEM_PRESET');
    if (!testCase) throw new Error('预置用例不存在');
    await this.database.deleteCase(id);
    return testCase;
  }

  async importPresetCategoriesToApp(request: { appCode: string; categoryIds: string[] }) {
    if (!request.appCode) throw new Error('缺少应用编码');
    if (!Array.isArray(request.categoryIds)) throw new Error('缺少系统预置分类列表');
    const categoryIds = Array.from(new Set(request.categoryIds));
    if (categoryIds.length === 0) throw new Error('请选择系统预置分类');

    for (const categoryId of categoryIds) {
      await this.subscribePresetCategory(request.appCode, categoryId);
    }

    return {
      message: `已成功关联 ${categoryIds.length} 个系统预置分类`,
    };
  }

  async subscribePresetCategory(appCode: string, categoryId: string) {
    if (!(await this.findCategoryById(categoryId))) {
      throw new Error(`分类不存在: ${categoryId}`);
    }
    await this.database.savePresetCategorySubscription(appCode, categoryId);
  }

  async unsubscribePresetCategory(appCode: string, categoryId: string) {
    await this.database.deletePresetCategorySubscription(appCode, categoryId);
  }

  async listCategorySubscriptions(appCode: string): Promise<string[]> {
    const subscriptions = await this.database.listPresetCategorySubscriptions();
    return subscriptions
      .filter((subscription) => subscription.appCode === appCode)
      .map((subscription) => subscription.categoryId);
  }

  async changeEnabled(id: string, enabled: boolean): Promise<CaseRecord> {
    return this.update(id, { enabled });
  }

  async delete(id: string): Promise<CaseRecord> {
    const testCase = await this.findCaseById(id, 'APP');
    if (!testCase) throw new Error('用例不存在');
    await this.database.deleteCase(id);
    return testCase;
  }

  async importCsvRows(request: CaseCsvImportRequest): Promise<CaseCsvImportResult> {
    const scope = request.scope === 'SYSTEM_PRESET' ? 'SYSTEM_PRESET' : 'APP';
    const appCode = request.appCode?.trim();
    if (scope === 'APP' && !appCode) throw new Error('缺少应用编码');
    if (!Array.isArray(request.rows)) throw new Error('缺少导入行');

    let created = 0;
    let updated = 0;
    let createdCategories = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, row] of request.rows.entries()) {
      try {
        const normalized = this.normalizeCsvImportRow(row);
        if (!normalized) {
          skipped += 1;
          continue;
        }
        const categoryResult = await this.findOrCreateCsvCategory(scope, appCode, normalized.categoryName);
        if (categoryResult.created) createdCategories += 1;

        const existingCase = await this.findCsvImportCase(scope, appCode, categoryResult.category.id, normalized.query);
        if (existingCase) {
          const updatePayload = {
            categoryId: categoryResult.category.id,
            query: normalized.query,
            expectedBehavior: normalized.expectedBehavior,
            enabled: true,
          };
          if (scope === 'SYSTEM_PRESET') {
            await this.updatePresetCase(existingCase.id, updatePayload);
          } else {
            await this.update(existingCase.id, updatePayload);
          }
          updated += 1;
        } else if (scope === 'SYSTEM_PRESET') {
          await this.createPresetCase({
            appCode: SYSTEM_PRESET_APP_CODE,
            categoryId: categoryResult.category.id,
            query: normalized.query,
            expectedBehavior: normalized.expectedBehavior,
          });
          created += 1;
        } else {
          await this.create({
            appCode: appCode ?? '',
            categoryId: categoryResult.category.id,
            query: normalized.query,
            expectedBehavior: normalized.expectedBehavior,
          });
          created += 1;
        }
      } catch (error) {
        errors.push({ row: index + 2, message: error instanceof Error ? error.message : '导入失败' });
      }
    }

    return {
      created,
      updated,
      createdCategories,
      skipped,
      errors,
      message: `导入完成：新增 ${created} 条，更新 ${updated} 条，新增分类 ${createdCategories} 个`,
    };
  }

  excelTemplateHeaders() {
    return [
      'appCode',
      'categoryId',
      'query',
      'expectedBehavior',
    ];
  }

  async exportRows(): Promise<CaseExcelRow[]> {
    return (await this.getCaseSource('APP')).map((testCase) => ({
      appCode: testCase.appCode,
      categoryId: testCase.categoryId,
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
    }));
  }

  templateRows() {
    return [
      Object.fromEntries(this.excelTemplateHeaders().map((header) => [header, ''])),
    ];
  }

  private normalizeCsvImportRow(row: CaseCsvImportRow) {
    const categoryName = row.categoryName?.trim() ?? '';
    const query = row.query?.trim() ?? '';
    const expectedBehavior = row.expectedBehavior?.trim() ?? '';
    if (!categoryName && !query && !expectedBehavior) return null;
    if (!categoryName) throw new Error('缺少必填字段 问题分类');
    if (!query) throw new Error('缺少必填字段 问题内容');
    if (!expectedBehavior) throw new Error('缺少必填字段 期望回答');
    return { categoryName, query, expectedBehavior };
  }

  private async findOrCreateCsvCategory(scope: 'APP' | 'SYSTEM_PRESET', appCode: string | undefined, categoryName: string) {
    const sourceCategories = await this.getCategorySource();
    const matched = sourceCategories.find((category) => {
      const scopeMatched = scope === 'SYSTEM_PRESET' ? !category.appCode : category.appCode === appCode;
      return scopeMatched && category.name === categoryName && category.enabled;
    });
    if (matched) return { category: matched, created: false };

    const category = await this.createCategory({
      appCode: scope === 'APP' ? appCode : undefined,
      name: categoryName,
      description: 'CSV 导入自动创建',
      enabled: true,
    });
    return { category, created: true };
  }

  private async findCsvImportCase(scope: 'APP' | 'SYSTEM_PRESET', appCode: string | undefined, categoryId: string, query: string) {
    const sourceCases = await this.getCaseSource(scope);
    return sourceCases.find((testCase) => {
      const scopeMatched = scope === 'SYSTEM_PRESET' ? testCase.caseScope === 'SYSTEM_PRESET' : testCase.appCode === appCode;
      return scopeMatched && testCase.categoryId === categoryId && testCase.query === query;
    });
  }

  private async validateCaseCategory(categoryId: string, appCode?: string) {
    const category = await this.findCategoryById(categoryId);
    if (!category || !category.enabled) throw new Error(`测试用例分类不可用 ${categoryId}`);
    if (category.appCode && category.appCode !== appCode) throw new Error(`测试用例分类不可用 ${categoryId}`);
  }

  private async findCategoryById(id: string) {
    return (await this.getCategorySource()).find((category) => category.id === id);
  }

  private async findCaseById(id: string, scope: 'APP' | 'SYSTEM_PRESET') {
    return (await this.getCaseSource(scope)).find((testCase) => testCase.id === id);
  }

  private validateCategory(category: CreateCaseCategoryRequest | CaseCategoryRecord) {
    if (!category.name?.trim()) throw new Error('分类名称不能为空');
    if (!category.description?.trim()) throw new Error('分类描述不能为空');
  }

  private toCaseRecordFromRequest(testCase: CreateCaseRequest, overrides: Partial<CaseRecord> = {}): CaseRecord {
    const id = this.readRequiredRequestString(overrides.id, '缺少用例 ID');
    return {
      appCode: this.readRequiredRequestString(overrides.appCode ?? testCase.appCode, '缺少应用编码'),
      id,
      caseCode: id,
      categoryId: this.readRequiredRequestString(overrides.categoryId ?? testCase.categoryId, '缺少分类 ID'),
      query: this.readRequiredRequestString(overrides.query ?? testCase.query, '缺少问题内容'),
      expectedBehavior: this.readRequiredRequestString(overrides.expectedBehavior ?? testCase.expectedBehavior, '缺少期望回答'),
      caseScope: this.readCaseScope(overrides.caseScope),
      enabled: overrides.enabled ?? true,
    };
  }

  private readRequiredRequestString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(message);
    return value.trim();
  }

  private readCaseScope(value: unknown): 'APP' | 'SYSTEM_PRESET' {
    if (value === 'APP' || value === 'SYSTEM_PRESET') return value;
    throw new Error('用例范围不能为空，且必须为 APP 或 SYSTEM_PRESET');
  }

  private generateEntityId(prefix: string) {
    return `${prefix}_${randomBytes(12).toString('hex')}`;
  }

  private async getCategorySource() {
    return this.database.listCategories();
  }

  private async getCaseSource(scope: 'APP' | 'SYSTEM_PRESET') {
    const databaseCases = await this.database.listCases();
    return databaseCases.filter((testCase) => testCase.caseScope === scope);
  }

  private normalizePage(page?: PageQuery): PageQuery {
    return {
      currentPage: Math.max(1, page?.currentPage ?? 1),
      linesPerPage: Math.max(1, page?.linesPerPage ?? 20),
    };
  }
}
