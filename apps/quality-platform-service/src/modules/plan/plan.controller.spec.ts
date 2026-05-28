import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlanController } from './plan.controller';
import { PlanService, type PlanDataStore, type PlanRecord, type PreviewCaseRecord } from './plan.service';

function createPlanDataStore(seed: { plans?: PlanRecord[]; cases?: PreviewCaseRecord[] } = {}): PlanDataStore {
  const plans = new Map(seed.plans?.map((plan) => [plan.planCode, plan]) ?? []);
  const cases = seed.cases ?? [];
  return {
    listPlans: async () => Array.from(plans.values()),
    listCases: async () => cases,
    findPlan: async (planCode) => plans.get(planCode) ?? null,
    createPlan: async (record) => {
      plans.set(record.planCode, record);
      return record;
    },
    updatePlan: async (record) => {
      plans.set(record.planCode, record);
      return record;
    },
    deletePlan: async (planCode) => {
      const plan = plans.get(planCode);
      if (!plan) throw new Error('计划不存在');
      plans.delete(planCode);
      return plan;
    },
  };
}

describe('PlanController', () => {
  it('does not synthesize missing list query data as an empty object', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/plan/plan.controller.ts'), 'utf8');

    expect(source).not.toContain('request.data ?? {}');
  });

  it('lists plans with pagination', async () => {
    const controller = new PlanController(new PlanService(createPlanDataStore()));
    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.success).toBe(true);
    expect(response.data.page.totalNum).toBe(0);
  });

  it('rejects list requests missing query data instead of silently using an empty query', async () => {
    const controller = new PlanController(new PlanService(createPlanDataStore()));

    await expect(
      controller.list({
        page: { currentPage: 1, linesPerPage: 10 },
      } as Parameters<PlanController['list']>[0]),
    ).rejects.toThrow('缺少计划查询条件');
  });

  it('exposes preview-cases and start endpoints with app selected cases', async () => {
    const service = new PlanService(createPlanDataStore());
    const controller = new PlanController(service);
    await controller.create({
      planCode: 'API_PLAN',
      planName: '接口计划',
      appCode: 'credit_assistant',
      caseFilter: { selectedCaseCodes: ['1'] },
    });

    expect((await controller.previewCases({
      planCode: 'API_PLAN',
      appCode: 'credit_assistant',
      selectedCaseCodes: ['1'],
    })).data.matchedCount).toBe(0);
    expect((await controller.start({ planCode: 'API_PLAN' })).data.appCode).toBe('credit_assistant');
  });
});
