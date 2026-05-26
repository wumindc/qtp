import { describe, expect, it } from 'vitest';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

describe('PlanController', () => {
  it('lists plans with pagination', async () => {
    const controller = new PlanController(new PlanService());
    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.success).toBe(true);
    expect(response.data.page.totalNum).toBe(0);
  });

  it('exposes preview-cases and start endpoints with app selected cases', async () => {
    const service = new PlanService();
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
