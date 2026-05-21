import { createRuntimePrismaClient, type SeedPlan } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';

export interface PlanRecord extends Omit<SeedPlan, 'planType'> {
  planType: SeedPlan['planType'] | 'CUSTOM';
  caseFilter: Record<string, unknown>;
  status: 'ENABLED' | 'DISABLED';
}

export interface CreatePlanRequest {
  planCode: string;
  planName: string;
  appCode: string;
  planType: PlanRecord['planType'];
  caseFilter: Record<string, unknown>;
}

export type UpdatePlanRequest = Partial<Omit<PlanRecord, 'planCode'>>;

export interface PreviewCasesRequest {
  planCode?: string;
  appCode?: string;
  categoryCodes?: string[];
  riskLevels?: string[];
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
  caseName: string;
  appCode: string;
  categoryId: string;
  riskLevel: string;
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

class PlanDatabase {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads plans and previewable cases from MySQL without injecting default records.
   */
  async listPlans(): Promise<PlanRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalPlan.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toPlan(row));
  }

  async listCases(): Promise<PreviewCaseRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalCase.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toCase(row));
  }

  async findPlan(planCode: string): Promise<PlanRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.evalPlan.findUnique({ where: { planCode } });
    return row ? this.toPlan(row) : null;
  }

  async createPlan(record: PlanRecord): Promise<PlanRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.evalPlan.create({ data: this.toPayload(record) });
    return this.toPlan(saved);
  }

  async updatePlan(record: PlanRecord): Promise<PlanRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.evalPlan.update({
      where: { planCode: record.planCode },
      data: this.toPayload(record),
    });
    return this.toPlan(saved);
  }

  async deletePlan(planCode: string): Promise<PlanRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const deleted = await prisma.evalPlan.delete({ where: { planCode } });
    return this.toPlan(deleted);
  }

  private async createClient() {
    if (process.env.VITEST) return null;
    return createRuntimePrismaClient<PlanPrismaClient>();
  }

  private toPayload(record: PlanRecord) {
    return {
      planCode: record.planCode,
      planName: record.planName,
      appCode: record.appCode,
      planType: record.planType,
      caseFilterJson: record.caseFilter,
      status: record.status,
    };
  }

  private toPlan(row: unknown): PlanRecord {
    const data = this.asRecord(row);
    return {
      planCode: String(data.planCode),
      planName: String(data.planName),
      appCode: String(data.appCode),
      planType: this.normalizePlanType(data.planType),
      caseFilter: this.asRecord(data.caseFilterJson),
      status: data.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
    };
  }

  private toCase(row: unknown): PreviewCaseRecord {
    const data = this.asRecord(row);
    return {
      id: String(data.id),
      caseCode: String(data.id),
      caseName: String(data.caseName),
      appCode: String(data.appCode),
      categoryId: String(data.categoryId),
      riskLevel: String(data.riskLevel ?? 'MEDIUM'),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private normalizePlanType(value: unknown): PlanRecord['planType'] {
    return value === 'SMOKE' || value === 'FULL_REGRESSION' || value === 'HIGH_RISK' ? value : 'CUSTOM';
  }
}

export class PlanService {
  private readonly database = new PlanDatabase();
  private readonly plans = new Map<string, PlanRecord>();
  private readonly previewCaseMap = new Map<string, PreviewCaseRecord>();

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
    if (await this.findPlan(request.planCode)) throw new Error('计划编码已存在');
    return this.persist({
      ...request,
      status: 'ENABLED',
    });
  }

  async update(planCode: string, request: UpdatePlanRequest): Promise<PlanRecord> {
    const plan = await this.getPlan(planCode);
    return this.persist({ ...plan, ...request, planCode });
  }

  async changeStatus(planCode: string, status: PlanRecord['status']): Promise<PlanRecord> {
    return this.update(planCode, { status });
  }

  async delete(planCode: string): Promise<PlanRecord> {
    const plan = await this.getPlan(planCode);
    const deleted = await this.database.deletePlan(planCode);
    this.plans.delete(planCode);
    return deleted ?? plan;
  }

  /**
   * @author codex
   * Previews cases from a saved plan or transient filters by reading current database cases.
   */
  async previewCasesForPlan(request: string | PreviewCasesRequest) {
    const previewRequest = typeof request === 'string' ? { planCode: request } : request;
    const plan = previewRequest.planCode ? await this.getPlan(previewRequest.planCode) : undefined;
    const caseFilter = plan?.caseFilter ?? {};
    const appCode = previewRequest.appCode ?? plan?.appCode;
    const categoryCodes = this.stringArray(previewRequest.categoryCodes ?? caseFilter.categoryCodes);
    const riskLevels = this.stringArray(previewRequest.riskLevels ?? caseFilter.riskLevels);
    const selectedCaseCodes = this.stringArray(previewRequest.selectedCaseCodes ?? caseFilter.selectedCaseCodes);
    const matchedCases = (await this.getCaseSource()).filter((testCase) => {
      const appMatched = !appCode || testCase.appCode === appCode;
      const categoryMatched = categoryCodes.length === 0 || categoryCodes.includes(testCase.categoryId);
      const riskMatched = riskLevels.length === 0 || riskLevels.includes(testCase.riskLevel);
      const selectedMatched = selectedCaseCodes.length === 0 || selectedCaseCodes.includes(testCase.caseCode);
      return appMatched && categoryMatched && riskMatched && selectedMatched;
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
    return {
      planCode,
      appCode: plan.appCode,
      selectedCaseCodes: this.stringArray(plan.caseFilter.selectedCaseCodes),
      caseFilter: plan.caseFilter,
    };
  }

  private async getPlanSource() {
    const databasePlans = await this.database.listPlans();
    if (databasePlans) {
      this.plans.clear();
      databasePlans.forEach((plan) => this.plans.set(plan.planCode, plan));
      return databasePlans;
    }
    return Array.from(this.plans.values());
  }

  private async getCaseSource() {
    const databaseCases = await this.database.listCases();
    if (databaseCases) {
      this.previewCaseMap.clear();
      databaseCases.forEach((testCase) => this.previewCaseMap.set(testCase.caseCode, testCase));
      return databaseCases;
    }
    return Array.from(this.previewCaseMap.values());
  }

  private async findPlan(planCode: string): Promise<PlanRecord | null> {
    const databasePlan = await this.database.findPlan(planCode);
    if (databasePlan !== undefined) {
      if (databasePlan) this.plans.set(databasePlan.planCode, databasePlan);
      return databasePlan;
    }
    return this.plans.get(planCode) ?? null;
  }

  private async getPlan(planCode: string) {
    const plan = await this.findPlan(planCode);
    if (!plan) throw new Error('计划不存在');
    return plan;
  }

  private async persist(record: PlanRecord) {
    const saved = this.plans.has(record.planCode)
      ? await this.database.updatePlan(record)
      : await this.database.createPlan(record);
    const next = saved ?? record;
    this.plans.set(next.planCode, next);
    return next;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
