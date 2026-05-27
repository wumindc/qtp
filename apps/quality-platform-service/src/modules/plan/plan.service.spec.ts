import { describe, expect, it } from 'vitest';
import { PlanService } from './plan.service';

describe('PlanService', () => {
  it('starts with no test plans', async () => {
    const service = new PlanService();
    const result = await service.list({}, { currentPage: 1, linesPerPage: 10 });

    expect(result.list).toHaveLength(0);
    expect(result.page.totalNum).toBe(0);
  });

  it('creates a custom test plan', async () => {
    const service = new PlanService();
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

  it('generates an opaque plan code when the caller does not provide one', async () => {
    const service = new PlanService();
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
    const service = new PlanService();
    await service.create({
      planCode: 'FILTER_PLAN',
      planName: '过滤计划',
      appCode: 'credit_assistant',
      caseFilter: { riskLevels: ['HIGH'], categoryCodes: ['1'] },
    });

    expect((await service.previewCases('FILTER_PLAN')).matchedCount).toBe(0);
    expect((await service.changeStatus('FILTER_PLAN', 'DISABLED')).status).toBe('DISABLED');
    expect((await service.update('FILTER_PLAN', { planName: '更新后的过滤计划' })).planName).toBe('更新后的过滤计划');
    expect((await service.delete('FILTER_PLAN')).planCode).toBe('FILTER_PLAN');
  });

  it('starts a plan DTO for execution forwarding', async () => {
    const service = new PlanService();
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
});
