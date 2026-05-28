import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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

describe('PlanService', () => {
  it('does not keep a production in-memory fallback store', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/plan/plan.service.ts'), 'utf8');

    expect(source).not.toContain('process.env.VITEST');
    expect(source).not.toContain('private readonly plans = new Map');
    expect(source).not.toContain('previewCaseMap');
    expect(source).not.toContain('plan?.caseFilter ?? {}');
    expect(source).not.toContain('planCode: String(data.planCode)');
    expect(source).not.toContain('planName: String(data.planName)');
    expect(source).not.toContain('appCode: String(data.appCode)');
    expect(source).not.toContain('caseFilter: this.asRecord(data.caseFilterJson)');
    expect(source).not.toContain("status: data.status === 'DISABLED' ? 'DISABLED' : 'ENABLED'");
    expect(source).not.toContain('query: typeof inputJson.query ===');
  });

  it('starts with no test plans', async () => {
    const service = new PlanService(createPlanDataStore());
    const result = await service.list({}, { currentPage: 1, linesPerPage: 10 });

    expect(result.list).toHaveLength(0);
    expect(result.page.totalNum).toBe(0);
  });

  it('creates a custom test plan', async () => {
    const service = new PlanService(createPlanDataStore());
    const created = await service.create({
      planCode: 'CUSTOM_PLAN',
      planName: '自定义计划',
      appCode: 'credit_assistant',
      caseFilter: { categoryCodes: ['1'] },
    });

    expect(created.planCode).toBe('CUSTOM_PLAN');
    expect(created.status).toBe('ENABLED');
    expect(created).not.toHaveProperty('planType');
  });

  it('keeps unexpected request fields out of plan records', async () => {
    const service = new PlanService(createPlanDataStore());
    const created = await service.create({
      planName: '白名单计划',
      appCode: 'credit_assistant',
      caseFilter: {},
      temporaryUiOnlyField: 'should-not-leak',
    } as Parameters<PlanService['create']>[0] & Record<string, unknown>);

    expect(created).not.toHaveProperty('temporaryUiOnlyField');

    const updated = await service.update(created.planCode, {
      planName: '更新后的白名单计划',
      transientEditorState: { expanded: true },
    } as Parameters<PlanService['update']>[1] & Record<string, unknown>);

    expect(updated).not.toHaveProperty('transientEditorState');
  });

  it('generates an opaque plan code when the caller does not provide one', async () => {
    const service = new PlanService(createPlanDataStore());
    const created = await service.create({
      planName: '自动编码计划',
      appCode: 'credit_assistant',
      caseFilter: {},
    });

    expect(created.planCode).toMatch(/^plan-[a-z0-9]{10}$/u);
    expect(created.planCode).not.toContain('credit_assistant');
    expect(created.planCode).not.toMatch(/\d{10,}/u);
  });

  it('updates status, previews empty case filters, and deletes a plan', async () => {
    const service = new PlanService(createPlanDataStore());
    await service.create({
      planCode: 'FILTER_PLAN',
      planName: '过滤计划',
      appCode: 'credit_assistant',
      caseFilter: { categoryCodes: ['1'] },
    });

    expect((await service.previewCases('FILTER_PLAN')).matchedCount).toBe(0);
    expect((await service.changeStatus('FILTER_PLAN', 'DISABLED')).status).toBe('DISABLED');
    expect((await service.update('FILTER_PLAN', { planName: '更新后的过滤计划' })).planName).toBe('更新后的过滤计划');
    expect((await service.delete('FILTER_PLAN')).planCode).toBe('FILTER_PLAN');
  });

  it('starts a plan DTO for execution forwarding', async () => {
    const service = new PlanService(createPlanDataStore());
    await service.create({
      planCode: 'SELECTED_PLAN',
      planName: '选中用例计划',
      appCode: 'credit_assistant',
      caseFilter: { selectedCaseCodes: ['1', '2'] },
    });

    await expect(service.previewCases({
      planCode: 'SELECTED_PLAN',
      appCode: 'credit_assistant',
      selectedCaseCodes: ['1'],
    })).resolves.toMatchObject({ matchedCount: 0 });
    await expect(service.start('SELECTED_PLAN')).resolves.toMatchObject({
      planCode: 'SELECTED_PLAN',
      appCode: 'credit_assistant',
      selectedCaseCodes: ['1', '2'],
    });
  });

  it('rejects saved plans missing case filters instead of previewing with an empty filter', async () => {
    const service = new PlanService(createPlanDataStore({
      plans: [{
        planCode: 'BROKEN_PLAN',
        planName: '坏计划',
        appCode: 'credit_assistant',
        status: 'ENABLED',
      } as PlanRecord],
    }));

    await expect(service.previewCases('BROKEN_PLAN')).rejects.toThrow('执行计划缺少用例筛选条件');
    await expect(service.start('BROKEN_PLAN')).rejects.toThrow('执行计划缺少用例筛选条件');
  });
});
