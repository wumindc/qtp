import {
  createRuntimePrismaClient,
  SYSTEM_PRESET_APP_CODE,
  type SeedCaseCategory,
  type SeedCase,
} from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';
import type { CaseExcelRow } from './excel.service';

export interface CaseQuery {
  appCode?: string;
  categoryId?: string;
  category?: string;
  categoryCode?: string;
  keyword?: string;
  caseScope?: 'APP' | 'SYSTEM_PRESET';
}

export interface PageQuery {
  currentPage: number;
  linesPerPage: number;
}

export interface CaseRecord extends SeedCase {
  id: string;
  categoryId: string;
  caseCode: string;
  categoryCode: string;
  enabled: boolean;
  manualReviewRequired: boolean;
  sourcePresetId?: string;
  sourcePresetCode?: string;
}

export type CreateCaseRequest = Omit<SeedCase, 'id' | 'categoryId'> &
  Partial<Pick<SeedCase, 'id' | 'categoryId' | 'caseCode' | 'categoryCode'>>;
export type UpdateCaseRequest = Partial<Omit<CaseRecord, 'id' | 'caseCode' | 'categoryCode'>>;

export interface CaseCategoryRecord extends SeedCaseCategory {
  id: string;
  code: string;
  appCode?: string;
  enabled: boolean;
  sortOrder: number;
}

export type CreateCaseCategoryRequest = Omit<SeedCaseCategory, 'id'> &
  Partial<Pick<SeedCaseCategory, 'id'>> & {
    enabled?: boolean;
  };
export type UpdateCaseCategoryRequest = Partial<Omit<CaseCategoryRecord, 'id' | 'code'>>;

export interface CaseCategoryQuery {
  appCode?: string;
  includeGlobal?: boolean;
  keyword?: string;
  enabled?: boolean;
}

export interface CaseSuiteRecord {
  suiteCode: string;
  suiteName: string;
  appCode: string;
  description?: string;
  caseIds: string[];
  caseCodes: string[];
  caseCount: number;
}

export interface CreateCaseSuiteRequest {
  suiteCode: string;
  suiteName: string;
  appCode: string;
  description?: string;
}

export interface SuiteQuery {
  appCode?: string;
  keyword?: string;
}

export interface PresetImportRequest {
  appCode: string;
  suiteCode: string;
  suiteName: string;
  description?: string;
  presetCaseIds?: string[];
  presetCaseCodes: string[];
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
  evalCaseSuite: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    upsert(input: { where: object; create: object; update: object }): Promise<unknown>;
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
  caseName?: unknown;
  appCode?: unknown;
  caseScope?: unknown;
  categoryId?: unknown;
  sourcePresetId?: unknown;
  riskLevel?: unknown;
  inputJson?: unknown;
  expectedJson?: unknown;
  manualReviewRequired?: unknown;
  enabled?: unknown;
};

type EvalCaseSuiteRow = {
  suiteCode?: unknown;
  suiteName?: unknown;
  appCode?: unknown;
  description?: unknown;
  caseIdsJson?: unknown;
  caseCodesJson?: unknown;
  enabled?: unknown;
};

class CaseDatabaseWriter {
  private readonly prismaPromise: Promise<CasePrismaClient | null>;

  constructor() {
    this.prismaPromise = this.createClient();
  }

  /**
   * @author codex
   * Reads category and case definitions from MySQL through Prisma when database access is configured.
   */
  async listCategories(): Promise<CaseCategoryRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    try {
      const rows = (await prisma.evalCaseCategory.findMany({ orderBy: { id: 'asc' } })) as EvalCaseCategoryRow[];
      return rows
        .filter((row) => row.id !== undefined && typeof row.name === 'string')
        .map((row, index) => ({
          id: String(row.id),
          code: String(row.id),
          appCode: typeof row.appCode === 'string' ? row.appCode : undefined,
          name: String(row.name),
          description: typeof row.description === 'string' ? row.description : '',
          enabled: row.enabled !== false,
          sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : (index + 1) * 10,
        }));
    } catch (error) {
      if (!process.env.VITEST) throw error;
      return null;
    }
  }

  async listCases(): Promise<CaseRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    try {
      const rows = (await prisma.evalCase.findMany({ orderBy: { id: 'asc' } })) as EvalCaseRow[];
      return rows
        .filter((row) => row.id !== undefined && typeof row.caseName === 'string')
        .map((row) => this.toCaseRecord(row));
    } catch (error) {
      if (!process.env.VITEST) throw error;
      return null;
    }
  }

  async listSuites(): Promise<CaseSuiteRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    try {
      const rows = (await prisma.evalCaseSuite.findMany({ orderBy: { suiteCode: 'asc' } })) as EvalCaseSuiteRow[];
      return rows
        .filter((row) => typeof row.suiteCode === 'string' && typeof row.suiteName === 'string')
        .map((row) => this.toSuiteRecord(row));
    } catch (error) {
      if (!process.env.VITEST) throw error;
      return null;
    }
  }

  async saveCategory(category: CaseCategoryRecord): Promise<CaseCategoryRecord> {
    const prisma = await this.prismaPromise;
    if (!prisma) return category;
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
    const savedId = this.asRecord(saved).id;
    const id = savedId === undefined ? category.id : String(savedId);
    return { ...category, id, code: id };
  }

  async deleteCategory(id: string) {
    const prisma = await this.prismaPromise;
    if (!prisma || !this.isDatabaseId(id)) return;
    await prisma.evalCaseCategory.delete({ where: { id: BigInt(id) } });
  }

  async saveCase(testCase: CaseRecord): Promise<CaseRecord> {
    const prisma = await this.prismaPromise;
    if (!prisma) return testCase;
    const payload = {
      caseName: testCase.caseName,
      appCode: testCase.appCode,
      caseScope: testCase.caseScope ?? 'APP',
      categoryId: this.isDatabaseId(testCase.categoryId) ? BigInt(testCase.categoryId) : 0n,
      sourcePresetId: this.isDatabaseId(testCase.sourcePresetId) ? BigInt(testCase.sourcePresetId) : null,
      riskLevel: testCase.riskLevel,
      inputJson: { query: testCase.query },
      expectedJson: { expectedBehavior: testCase.expectedBehavior },
      minScore: 80,
      manualReviewRequired: testCase.manualReviewRequired,
      enabled: testCase.enabled,
    };
    if (payload.categoryId === 0n) return testCase;
    let saved: unknown;
    if (this.isDatabaseId(testCase.id)) {
      saved = await prisma.evalCase.update({
        where: { id: BigInt(testCase.id) },
        data: payload,
      });
    } else {
      saved = await prisma.evalCase.create({ data: payload });
    }
    const savedId = this.asRecord(saved).id;
    const id = savedId === undefined ? testCase.id : String(savedId);
    return { ...testCase, id, caseCode: id };
  }

  async deleteCase(id: string) {
    const prisma = await this.prismaPromise;
    if (!prisma || !this.isDatabaseId(id)) return;
    await prisma.evalCase.delete({ where: { id: BigInt(id) } });
  }

  async upsertSuite(suite: CaseSuiteRecord) {
    const prisma = await this.prismaPromise;
    if (!prisma) return;
    const payload = {
      suiteCode: suite.suiteCode,
      suiteName: suite.suiteName,
      appCode: suite.appCode,
      description: suite.description,
      caseIdsJson: suite.caseIds,
      enabled: true,
    };
    await prisma.evalCaseSuite.upsert({
      where: { suiteCode: suite.suiteCode },
      create: payload,
      update: payload,
    });
  }

  private async createClient(): Promise<CasePrismaClient | null> {
    if (process.env.VITEST) return null;
    try {
      return await createRuntimePrismaClient<CasePrismaClient>();
    } catch (error) {
      if (!process.env.VITEST) throw error;
      return null;
    }
  }

  private toCaseRecord(row: EvalCaseRow): CaseRecord {
    const inputJson = this.asRecord(row.inputJson);
    const expectedJson = this.asRecord(row.expectedJson);
    const id = String(row.id);
    const categoryId = String(row.categoryId ?? '');
    const caseScope = row.caseScope === 'SYSTEM_PRESET' ? 'SYSTEM_PRESET' : 'APP';
    return {
      id,
      caseCode: id,
      caseName: String(row.caseName),
      appCode: typeof row.appCode === 'string' ? row.appCode : '',
      caseScope,
      categoryId,
      categoryCode: categoryId,
      sourcePresetId: row.sourcePresetId === null || row.sourcePresetId === undefined ? undefined : String(row.sourcePresetId),
      riskLevel: this.normalizeRiskLevel(row.riskLevel),
      query: typeof inputJson.query === 'string' ? inputJson.query : '',
      expectedBehavior: typeof expectedJson.expectedBehavior === 'string' ? expectedJson.expectedBehavior : '',
      enabled: row.enabled !== false,
      manualReviewRequired: row.manualReviewRequired === true,
      sourcePresetCode: row.sourcePresetId === null || row.sourcePresetId === undefined ? undefined : String(row.sourcePresetId),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private normalizeRiskLevel(value: unknown): SeedCase['riskLevel'] {
    return value === 'LOW' || value === 'HIGH' ? value : 'MEDIUM';
  }

  private toSuiteRecord(row: EvalCaseSuiteRow): CaseSuiteRecord {
    const caseIds = Array.isArray(row.caseIdsJson)
      ? row.caseIdsJson.filter((caseId): caseId is string => typeof caseId === 'string')
      : Array.isArray(row.caseCodesJson)
        ? row.caseCodesJson.filter((caseId): caseId is string => typeof caseId === 'string')
        : [];
    const caseCodes = Array.isArray(row.caseCodesJson)
      ? row.caseCodesJson.filter((caseCode): caseCode is string => typeof caseCode === 'string')
      : caseIds;
    return {
      suiteCode: String(row.suiteCode),
      suiteName: String(row.suiteName),
      appCode: typeof row.appCode === 'string' ? row.appCode : '',
      description: typeof row.description === 'string' ? row.description : undefined,
      caseIds,
      caseCodes,
      caseCount: caseIds.length,
    };
  }

  private isDatabaseId(id: string | undefined): id is string {
    return typeof id === 'string' && /^\d+$/.test(id);
  }
}

export class CaseService {
  private readonly database = new CaseDatabaseWriter();
  private readonly categoriesMap = new Map<string, CaseCategoryRecord>();
  private readonly cases = new Map<string, CaseRecord>();
  private readonly presetCases = new Map<string, CaseRecord>();
  private readonly suites = new Map<string, CaseSuiteRecord>();

  constructor() {
    void this.hydrateFromDatabase();
  }

  categories() {
    return Array.from(this.categoriesMap.values()).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async listCategories(query: CaseCategoryQuery, page?: PageQuery): Promise<PageResult<CaseCategoryRecord>> {
    const normalizedPage = this.normalizePage(page);
    const appCode = query.appCode?.trim();
    const includeGlobal = query.includeGlobal !== false;
    const normalizedKeyword = query.keyword?.trim().toLowerCase();
    const sourceCategories = await this.getCategorySource();
    const all = sourceCategories.filter((category) => {
      const scopeMatched = appCode
        ? category.appCode === appCode || (includeGlobal && !category.appCode)
        : !category.appCode;
      const keywordMatched =
        !normalizedKeyword ||
        category.name.toLowerCase().includes(normalizedKeyword) ||
        category.description.toLowerCase().includes(normalizedKeyword);
      const enabledMatched = query.enabled === undefined || category.enabled === query.enabled;
      return scopeMatched && keywordMatched && enabledMatched;
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
    if (Array.from(this.categoriesMap.values()).some((category) => category.name === request.name && category.appCode === appCode)) {
      throw new Error('分类名称已存在');
    }
    const id = request.id ?? this.generateEntityId('category');
    const record: CaseCategoryRecord = {
      ...request,
      id,
      code: id,
      appCode,
      enabled: request.enabled ?? true,
      sortOrder: request.sortOrder ?? (this.categoriesMap.size + 1) * 10,
    };
    const saved = await this.database.saveCategory(record);
    this.categoriesMap.set(saved.id, saved);
    return saved;
  }

  async updateCategory(id: string, request: UpdateCaseCategoryRequest): Promise<CaseCategoryRecord> {
    const category = this.categoriesMap.get(id);
    if (!category) throw new Error('分类不存在');
    const updated = {
      ...category,
      ...request,
      id,
      code: id,
    };
    this.validateCategory(updated);
    const saved = await this.database.saveCategory(updated);
    this.categoriesMap.delete(id);
    this.categoriesMap.set(saved.id, saved);
    return saved;
  }

  async changeCategoryEnabled(id: string, enabled: boolean): Promise<CaseCategoryRecord> {
    return this.updateCategory(id, { enabled });
  }

  async deleteCategory(id: string): Promise<CaseCategoryRecord> {
    if (Array.from(this.cases.values()).some((testCase) => testCase.categoryId === id)) {
      throw new Error('分类下仍有关联应用测试用例');
    }
    if (Array.from(this.presetCases.values()).some((testCase) => testCase.categoryId === id)) {
      throw new Error('分类下仍有关联系统预置测试用例');
    }
    const category = this.categoriesMap.get(id);
    if (!category) throw new Error('分类不存在');
    this.categoriesMap.delete(id);
    await this.database.deleteCategory(id);
    return category;
  }

  /**
   * @author codex
   * Lists cases by category and keyword using the shared page shape.
   */
  async list(query: CaseQuery, page?: PageQuery): Promise<PageResult<CaseRecord>> {
    const normalizedPage = this.normalizePage(page);
    const categoryId = query.categoryId ?? query.categoryCode ?? query.category;
    const sourceCases = await this.getCaseSource(query.caseScope === 'SYSTEM_PRESET' ? 'SYSTEM_PRESET' : 'APP');
    const all = sourceCases.filter((testCase) => {
      const appMatched = !query.appCode || testCase.appCode === query.appCode;
      const categoryMatched = !categoryId || testCase.categoryId === categoryId;
      const keywordMatched =
        !query.keyword ||
        testCase.caseName.includes(query.keyword) ||
        testCase.query.includes(query.keyword);
      return appMatched && categoryMatched && keywordMatched;
    });
    const start = (normalizedPage.currentPage - 1) * normalizedPage.linesPerPage;
    return pageResult(
      all.slice(start, start + normalizedPage.linesPerPage),
      normalizedPage.currentPage,
      normalizedPage.linesPerPage,
      all.length,
    );
  }

  /**
   * @author codex
   * Lists case suites under an AI application for first-stage case grouping.
   */
  async listSuites(query: SuiteQuery, page?: PageQuery): Promise<PageResult<CaseSuiteRecord>> {
    const normalizedPage = this.normalizePage(page);
    const sourceSuites = await this.getSuiteSource();
    const all = sourceSuites.filter((suite) => {
      const appMatched = !query.appCode || suite.appCode === query.appCode;
      const keywordMatched =
        !query.keyword ||
        suite.suiteCode.includes(query.keyword) ||
        suite.suiteName.includes(query.keyword);
      return appMatched && keywordMatched;
    });
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

  createSuite(request: CreateCaseSuiteRequest): CaseSuiteRecord {
    const existing = this.suites.get(request.suiteCode);
    if (existing) {
      const updated = {
        ...existing,
        suiteName: request.suiteName || existing.suiteName,
        appCode: request.appCode || existing.appCode,
        description: request.description ?? existing.description,
      };
      this.suites.set(request.suiteCode, updated);
      void this.database.upsertSuite(updated);
      return updated;
    }
    const record = {
      ...request,
      caseIds: [],
      caseCodes: [],
      caseCount: 0,
    };
    this.suites.set(record.suiteCode, record);
    void this.database.upsertSuite(record);
    return record;
  }

  bindSuiteCases(suiteCode: string, caseCodes: string[]): CaseSuiteRecord {
    const suite = this.suites.get(suiteCode);
    if (!suite) throw new Error('用例集不存在');
    const uniqueCaseIds = Array.from(new Set(caseCodes));
    const missingCaseId = uniqueCaseIds.find((caseId) => !this.cases.has(caseId));
    if (missingCaseId) throw new Error(`用例不存在 ${missingCaseId}`);
    const updated = {
      ...suite,
      caseIds: uniqueCaseIds,
      caseCodes: uniqueCaseIds,
      caseCount: uniqueCaseIds.length,
    };
    this.suites.set(suiteCode, updated);
    void this.database.upsertSuite(updated);
    return updated;
  }

  async create(request: CreateCaseRequest): Promise<CaseRecord> {
    const record = this.toCaseRecordFromSeed(
      {
        ...request,
        id: request.id ?? request.caseCode ?? this.generateEntityId('case'),
        categoryId: request.categoryId ?? request.categoryCode ?? '',
      },
      {
      caseScope: 'APP' as const,
      enabled: true,
      manualReviewRequired: request.riskLevel === 'HIGH',
      },
    );
    this.validateCaseCategory(record.categoryId, record.appCode);
    const saved = await this.database.saveCase(record);
    this.cases.set(saved.id, saved);
    return saved;
  }

  async update(id: string, request: UpdateCaseRequest): Promise<CaseRecord> {
    const testCase = this.cases.get(id);
    if (!testCase) throw new Error('用例不存在');
    if (request.categoryId) this.validateCaseCategory(request.categoryId, testCase.appCode);
    const nextRiskLevel = request.riskLevel ?? testCase.riskLevel;
    const updated = {
      ...testCase,
      ...request,
      id,
      caseCode: id,
      categoryCode: request.categoryId ?? testCase.categoryId,
      riskLevel: nextRiskLevel,
      manualReviewRequired: request.manualReviewRequired ?? nextRiskLevel === 'HIGH',
    };
    const saved = await this.database.saveCase(updated);
    this.cases.delete(id);
    this.cases.set(saved.id, saved);
    return saved;
  }

  async createPresetCase(request: CreateCaseRequest): Promise<CaseRecord> {
    const record = this.toCaseRecordFromSeed(
      {
        ...request,
        id: request.id ?? request.caseCode ?? this.generateEntityId('preset_case'),
        categoryId: request.categoryId ?? request.categoryCode ?? '',
      },
      {
      appCode: SYSTEM_PRESET_APP_CODE,
      caseScope: 'SYSTEM_PRESET',
      enabled: true,
      manualReviewRequired: request.riskLevel === 'HIGH',
      },
    );
    this.validateCaseCategory(record.categoryId);
    const saved = await this.database.saveCase(record);
    this.presetCases.set(saved.id, saved);
    return saved;
  }

  async updatePresetCase(id: string, request: UpdateCaseRequest): Promise<CaseRecord> {
    const testCase = this.presetCases.get(id);
    if (!testCase) throw new Error('预置用例不存在');
    if (request.categoryId) this.validateCaseCategory(request.categoryId);
    const nextRiskLevel = request.riskLevel ?? testCase.riskLevel;
    const updated = {
      ...testCase,
      ...request,
      id,
      caseCode: id,
      appCode: SYSTEM_PRESET_APP_CODE,
      caseScope: 'SYSTEM_PRESET' as const,
      categoryCode: request.categoryId ?? testCase.categoryId,
      riskLevel: nextRiskLevel,
      manualReviewRequired: request.manualReviewRequired ?? nextRiskLevel === 'HIGH',
    };
    const saved = await this.database.saveCase(updated);
    this.presetCases.delete(id);
    this.presetCases.set(saved.id, saved);
    return saved;
  }

  async changePresetCaseEnabled(id: string, enabled: boolean): Promise<CaseRecord> {
    return this.updatePresetCase(id, { enabled });
  }

  async deletePresetCase(id: string): Promise<CaseRecord> {
    const testCase = this.presetCases.get(id);
    if (!testCase) throw new Error('预置用例不存在');
    this.presetCases.delete(id);
    await this.database.deleteCase(id);
    return testCase;
  }

  async importPresetCategoriesToApp(request: { appCode: string; suiteCode: string; suiteName: string; description?: string; categoryIds: string[] }) {
    if (!request.appCode) throw new Error('缺少应用编码');
    if (!request.suiteCode) throw new Error('缺少用例集编码');
    const categoryIds = Array.from(new Set(request.categoryIds ?? []));
    if (categoryIds.length === 0) throw new Error('请选择系统预置分类');

    const presetCaseIds = Array.from(this.presetCases.values())
      .filter((preset) => categoryIds.includes(preset.categoryId))
      .map((preset) => preset.id);

    if (presetCaseIds.length === 0) throw new Error('所选分类下没有系统预置用例');

    return this.importPresetCasesToApp({
      ...request,
      presetCaseIds,
      presetCaseCodes: presetCaseIds,
    });
  }

  async importPresetCasesToApp(request: PresetImportRequest) {
    if (!request.appCode) throw new Error('缺少应用编码');
    if (!request.suiteCode) throw new Error('缺少用例集编码');
    const uniquePresetIds = Array.from(new Set(request.presetCaseIds ?? request.presetCaseCodes));
    if (uniquePresetIds.length === 0) throw new Error('请选择系统预置测试用例');

    const importedCases: CaseRecord[] = [];
    let createdCount = 0;
    let reusedCount = 0;

    for (const presetId of uniquePresetIds) {
      const presetCase = this.presetCases.get(presetId);
      if (!presetCase) throw new Error(`系统预置测试用例不存在 ${presetId}`);
      const existingCase = Array.from(this.cases.values()).find(
        (testCase) => testCase.appCode === request.appCode && testCase.sourcePresetId === presetId,
      );
      if (existingCase) {
        importedCases.push(existingCase);
        reusedCount += 1;
        continue;
      }

      const importedCaseId = this.generateEntityId('case');
      const importedCase: CaseRecord = {
        ...presetCase,
        id: importedCaseId,
        caseCode: importedCaseId,
        appCode: request.appCode,
        caseScope: 'APP',
        sourcePresetId: presetId,
        sourcePresetCode: presetId,
        enabled: true,
        manualReviewRequired: presetCase.riskLevel === 'HIGH',
      };
      importedCase.caseCode = importedCase.id;
      const saved = await this.database.saveCase(importedCase);
      this.cases.set(saved.id, saved);
      importedCases.push(saved);
      createdCount += 1;
    }

    const suite = this.createSuite({
      suiteCode: request.suiteCode,
      suiteName: request.suiteName,
      appCode: request.appCode,
      description: request.description,
    });
    const boundSuite = this.bindSuiteCases(suite.suiteCode, Array.from(new Set([...suite.caseIds, ...importedCases.map((item) => item.id)])));

    return {
      suite: boundSuite,
      cases: importedCases,
      createdCount,
      reusedCount,
      message:
        createdCount > 0
          ? `已引用 ${createdCount} 条系统预置测试用例到当前应用`
          : `所选系统预置测试用例已在当前应用中，无需重复引用`,
    };
  }

  async changeEnabled(id: string, enabled: boolean): Promise<CaseRecord> {
    return this.update(id, { enabled });
  }

  async delete(id: string): Promise<CaseRecord> {
    const testCase = this.cases.get(id);
    if (!testCase) throw new Error('用例不存在');
    this.cases.delete(id);
    await this.database.deleteCase(id);
    return testCase;
  }

  async importRows(rows: CreateCaseRequest[]) {
    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, row] of rows.entries()) {
      try {
        this.validateImportRow(row);
        const existingId = row.id ?? row.caseCode;
        if (existingId && this.cases.has(existingId)) {
          await this.update(existingId, {
            ...row,
            categoryId: row.categoryId ?? row.categoryCode,
          });
          updated += 1;
        } else {
          await this.create(row);
          created += 1;
        }
      } catch (error) {
        errors.push({ row: index + 2, message: error instanceof Error ? error.message : '导入失败' });
      }
    }

    return { created, updated, errors };
  }

  excelTemplateHeaders() {
    return [
      'caseName',
      'appCode',
      'categoryId',
      'riskLevel',
      'query',
      'expectedBehavior',
      'referenceAnswer',
      'mustInclude',
      'mustNotInclude',
      'minScore',
      'manualReviewRequired',
      'tags',
    ];
  }

  exportRows(): CaseExcelRow[] {
    return Array.from(this.cases.values()).map((testCase) => ({
      caseName: testCase.caseName,
      appCode: testCase.appCode,
      categoryId: testCase.categoryId,
      riskLevel: testCase.riskLevel,
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
      enabled: testCase.enabled,
      manualReviewRequired: testCase.manualReviewRequired,
    }));
  }

  templateRows() {
    return [
      Object.fromEntries(this.excelTemplateHeaders().map((header) => [header, ''])),
    ];
  }

  private validateImportRow(row: CreateCaseRequest) {
    const requiredFields: Array<keyof CreateCaseRequest> = [
      'caseName',
      'appCode',
      'riskLevel',
      'query',
      'expectedBehavior',
    ];
    const missingField = requiredFields.find((field) => !row[field]);
    if (missingField) throw new Error(`缺少必填字段 ${missingField}`);
    if (!row.categoryId && !row.categoryCode) throw new Error('缺少必填字段 categoryId');
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(row.riskLevel)) throw new Error('风险等级不合法');
    this.validateCaseCategory(row.categoryId ?? row.categoryCode ?? '', row.appCode);
  }

  private validateCaseCategory(categoryId: string, appCode?: string) {
    const category = this.categoriesMap.get(categoryId);
    if (!category || !category.enabled) throw new Error(`测试用例分类不可用 ${categoryId}`);
    if (category.appCode && category.appCode !== appCode) throw new Error(`测试用例分类不可用 ${categoryId}`);
  }

  private validateCategory(category: CreateCaseCategoryRequest | CaseCategoryRecord) {
    if (!category.name?.trim()) throw new Error('分类名称不能为空');
    if (!category.description?.trim()) throw new Error('分类描述不能为空');
  }

  private toCaseRecordFromSeed(testCase: CreateCaseRequest, overrides: Partial<CaseRecord> = {}): CaseRecord {
    const id = String(overrides.id ?? testCase.id ?? testCase.caseCode ?? this.generateEntityId('case'));
    const categoryId = String(overrides.categoryId ?? testCase.categoryId ?? testCase.categoryCode ?? '');
    const riskLevel = overrides.riskLevel ?? testCase.riskLevel;
    return {
      ...testCase,
      ...overrides,
      id,
      caseCode: id,
      categoryId,
      categoryCode: categoryId,
      riskLevel,
      enabled: overrides.enabled ?? true,
      manualReviewRequired: overrides.manualReviewRequired ?? riskLevel === 'HIGH',
    };
  }

  private generateEntityId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async getCategorySource() {
    const databaseCategories = await this.database.listCategories();
    return databaseCategories ?? this.categories();
  }

  private async getCaseSource(scope: 'APP' | 'SYSTEM_PRESET') {
    const databaseCases = await this.database.listCases();
    if (databaseCases) {
      return databaseCases.filter((testCase) => (testCase.caseScope ?? 'APP') === scope);
    }
    return Array.from((scope === 'SYSTEM_PRESET' ? this.presetCases : this.cases).values());
  }

  private async getSuiteSource() {
    const databaseSuites = await this.database.listSuites();
    return databaseSuites ?? Array.from(this.suites.values());
  }

  private async hydrateFromDatabase() {
    const [databaseCategories, databaseCases, databaseSuites] = await Promise.all([
      this.database.listCategories(),
      this.database.listCases(),
      this.database.listSuites(),
    ]);
    if (databaseCategories) {
      this.categoriesMap.clear();
      databaseCategories.forEach((category) => this.categoriesMap.set(category.id, category));
    }
    if (databaseCases) {
      this.cases.clear();
      this.presetCases.clear();
      for (const testCase of databaseCases) {
        if (testCase.caseScope === 'SYSTEM_PRESET') {
          this.presetCases.set(testCase.id, testCase);
        } else {
          this.cases.set(testCase.id, testCase);
        }
      }
    }
    if (databaseSuites) {
      this.suites.clear();
      databaseSuites.forEach((suite) => this.suites.set(suite.suiteCode, suite));
    }
  }

  private normalizePage(page?: PageQuery): PageQuery {
    return {
      currentPage: Math.max(1, page?.currentPage ?? 1),
      linesPerPage: Math.max(1, page?.linesPerPage ?? 20),
    };
  }
}
