import { randomBytes } from 'node:crypto';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';

export interface PlanRecord {
  planCode: string;
  planName: string;
  appCode: string;
  caseFilter: Record<string, unknown>;
  status: 'ENABLED' | 'DISABLED';
}

export interface CreatePlanRequest {
  planCode?: string;
  planName: string;
  appCode: string;
  caseFilter: Record<string, unknown>;
}

export type UpdatePlanRequest = Partial<Omit<PlanRecord, 'planCode'>>;

export interface PreviewCasesRequest {
  planCode?: string;
  appCode?: string;
  categoryCodes?: string[];
  selectedCaseCodes?: string[];
}

export interface StartPlanDto {
  planCode: string;
  appCode: string;
  selectedCaseCodes: string[];
  caseFilter: Record<string, unknown>;
}

export interface PreviewCaseRecord {
  id: string;
  caseCode: string;
  query: string;
  appCode: string;
  categoryId: string;
}

type PlanPrismaClient = {
  evalPlan: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    findUnique(input: { where: { planCode: string } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { planCode: string }; data: object }): Promise<unknown>;
    delete(input: { where: { planCode: string } }): Promise<unknown>;
  };
  evalCase: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
  };
};

export interface PlanDataStore {
  listPlans(): Promise<PlanRecord[]>;
  listCases(): Promise<PreviewCaseRecord[]>;
  findPlan(planCode: string): Promise<PlanRecord | null>;
  createPlan(record: PlanRecord): Promise<PlanRecord>;
  updatePlan(record: PlanRecord): Promise<PlanRecord>;
  deletePlan(planCode: string): Promise<PlanRecord>;
}

const OPAQUE_ID_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const OPAQUE_ID_ALPHABET = `${OPAQUE_ID_LETTERS}0123456789`;
const OPAQUE_ID_LENGTH = 10;

function createOpaqueId(prefix: string): string {
  const bytes = randomBytes(OPAQUE_ID_LENGTH);
  const suffix = [
    OPAQUE_ID_LETTERS[bytes[0] % OPAQUE_ID_LETTERS.length],
    ...Array.from(bytes.subarray(1), (byte) => OPAQUE_ID_ALPHABET[byte % OPAQUE_ID_ALPHABET.length]),
  ].join('');
  return `${prefix}-${suffix}`;
}

class PlanDatabase implements PlanDataStore {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads plans and previewable cases from MySQL without injecting default records.
   */
  async listPlans(): Promise<PlanRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalPlan.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toPlan(row));
  }

  async listCases(): Promise<PreviewCaseRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalCase.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toCase(row));
  }

  async findPlan(planCode: string): Promise<PlanRecord | null> {
    const prisma = await this.prismaPromise;
    const row = await prisma.evalPlan.findUnique({ where: { planCode } });
    return row ? this.toPlan(row) : null;
  }

  async createPlan(record: PlanRecord): Promise<PlanRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.evalPlan.create({ data: this.toPayload(record) });
    return this.toPlan(saved);
  }

  async updatePlan(record: PlanRecord): Promise<PlanRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.evalPlan.update({
      where: { planCode: record.planCode },
      data: this.toPayload(record),
    });
    return this.toPlan(saved);
  }

  async deletePlan(planCode: string): Promise<PlanRecord> {
    const prisma = await this.prismaPromise;
    const deleted = await prisma.evalPlan.delete({ where: { planCode } });
    return this.toPlan(deleted);
  }

  private async createClient() {
    return createRuntimePrismaClient<PlanPrismaClient>();
  }

  private toPayload(record: PlanRecord) {
    return {
      planCode: record.planCode,
      planName: record.planName,
      appCode: record.appCode,
      caseFilterJson: record.caseFilter,
      status: record.status,
    };
  }

  private toPlan(row: unknown): PlanRecord {
    const data = this.readRecord(row, '执行计划记录格式不正确');
    return {
      planCode: this.readRequiredString(data.planCode, '执行计划记录缺少计划编码'),
      planName: this.readRequiredString(data.planName, '执行计划记录缺少计划名称'),
      appCode: this.readRequiredString(data.appCode, '执行计划记录缺少应用编码'),
      caseFilter: this.readRequiredRecord(data.caseFilterJson, '执行计划记录缺少用例筛选条件'),
      status: this.readPlanStatus(data.status),
    };
  }

  private toCase(row: unknown): PreviewCaseRecord {
    const data = this.readRecord(row, '预览用例记录格式不正确');
    const inputJson = this.readRequiredRecord(data.inputJson, '预览用例记录缺少输入 JSON');
    const id = this.readRequiredBigIntId(data.id, '预览用例记录缺少数据库 ID');
    return {
      id,
      caseCode: id,
      query: this.readRequiredString(inputJson.query, '预览用例记录缺少问题内容'),
      appCode: this.readRequiredString(data.appCode, '预览用例记录缺少应用编码'),
      categoryId: this.readRequiredBigIntId(data.categoryId, '预览用例记录缺少分类 ID'),
    };
  }

  private readRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredString(value: unknown, message: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error(message);
  }

  private readRequiredBigIntId(value: unknown, message: string): string {
    if (typeof value === 'bigint' && value > 0n) return String(value);
    throw new Error(message);
  }

  private readPlanStatus(value: unknown): PlanRecord['status'] {
    if (value === 'ENABLED' || value === 'DISABLED') return value;
    throw new Error('执行计划记录状态非法');
  }
}

export class PlanService {
  constructor(private readonly database: PlanDataStore = new PlanDatabase()) {}

  /**
   * @author codex
   * Lists test plans with platform pagination.
   */
  async list(query: Record<string, unknown>, page: { currentPage: number; linesPerPage: number }): Promise<PageResult<PlanRecord>> {
    const appCode = typeof query.appCode === 'string' ? query.appCode : '';
    const all = (await this.getPlanSource()).filter((plan) => !appCode || plan.appCode === appCode);
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async create(request: CreatePlanRequest): Promise<PlanRecord> {
    const requestedPlanCode = request.planCode?.trim();
    const planCode = requestedPlanCode || (await this.createPlanCode());
    if (await this.findPlan(planCode)) throw new Error('计划编码已存在');
    return this.persist({
      planCode,
      planName: request.planName,
      appCode: request.appCode,
      caseFilter: this.readRequiredRecord(request.caseFilter, '执行计划缺少用例筛选条件'),
      status: 'ENABLED',
    });
  }

  async update(planCode: string, request: UpdatePlanRequest): Promise<PlanRecord> {
    const plan = await this.getPlan(planCode);
    return this.persist({
      planCode,
      planName: request.planName ?? plan.planName,
      appCode: request.appCode ?? plan.appCode,
      caseFilter: request.caseFilter === undefined
        ? this.readRequiredRecord(plan.caseFilter, '执行计划缺少用例筛选条件')
        : this.readRequiredRecord(request.caseFilter, '执行计划缺少用例筛选条件'),
      status: request.status ?? plan.status,
    });
  }

  async changeStatus(planCode: string, status: PlanRecord['status']): Promise<PlanRecord> {
    return this.update(planCode, { status });
  }

  async delete(planCode: string): Promise<PlanRecord> {
    await this.getPlan(planCode);
    return this.database.deletePlan(planCode);
  }

  /**
   * @author codex
   * Previews cases from a saved plan or transient filters by reading current database cases.
   */
  async previewCasesForPlan(request: string | PreviewCasesRequest) {
    const previewRequest = typeof request === 'string' ? { planCode: request } : request;
    const plan = previewRequest.planCode ? await this.getPlan(previewRequest.planCode) : undefined;
    const caseFilter = plan ? this.readRequiredRecord(plan.caseFilter, '执行计划缺少用例筛选条件') : undefined;
    const appCode = previewRequest.appCode ?? plan?.appCode;
    const categoryCodes = this.stringArray(previewRequest.categoryCodes ?? caseFilter?.categoryCodes);
    const selectedCaseCodes = this.stringArray(previewRequest.selectedCaseCodes ?? caseFilter?.selectedCaseCodes);
    const matchedCases = (await this.getCaseSource()).filter((testCase) => {
      const appMatched = !appCode || testCase.appCode === appCode;
      const categoryMatched = categoryCodes.length === 0 || categoryCodes.includes(testCase.categoryId);
      const selectedMatched = selectedCaseCodes.length === 0 || selectedCaseCodes.includes(testCase.caseCode);
      return appMatched && categoryMatched && selectedMatched;
    });
    return {
      matchedCount: matchedCases.length,
      sampleCases: matchedCases.slice(0, 5),
    };
  }

  async previewCases(request: string | PreviewCasesRequest) {
    return this.previewCasesForPlan(request);
  }

  async start(planCode: string): Promise<StartPlanDto> {
    const plan = await this.getPlan(planCode);
    const caseFilter = this.readRequiredRecord(plan.caseFilter, '执行计划缺少用例筛选条件');
    return {
      planCode,
      appCode: plan.appCode,
      selectedCaseCodes: this.stringArray(caseFilter.selectedCaseCodes),
      caseFilter,
    };
  }

  private async getPlanSource() {
    return this.database.listPlans();
  }

  private async getCaseSource() {
    return this.database.listCases();
  }

  private async findPlan(planCode: string): Promise<PlanRecord | null> {
    return this.database.findPlan(planCode);
  }

  private async getPlan(planCode: string) {
    const plan = await this.findPlan(planCode);
    if (!plan) throw new Error('计划不存在');
    return plan;
  }

  /**
   * @author codex
   * Generates non-guessable plan identifiers without embedding app codes or timestamps.
   */
  private async createPlanCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const planCode = createOpaqueId('plan');
      if (!(await this.findPlan(planCode))) return planCode;
    }
    throw new Error('计划编码生成失败，请重试');
  }

  private async persist(record: PlanRecord) {
    return (await this.findPlan(record.planCode))
      ? this.database.updatePlan(record)
      : this.database.createPlan(record);
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private readRequiredRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }
}
