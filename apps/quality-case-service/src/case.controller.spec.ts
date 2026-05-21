import { describe, expect, it } from 'vitest';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';

describe('CaseController', () => {
  it('lists empty test cases before creation', async () => {
    const controller = new CaseController(new CaseService());

    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.list).toHaveLength(0);
  });

  it('returns full-field template headers', () => {
    const controller = new CaseController(new CaseService());

    expect(controller.template().data).toContain('manualReviewRequired');
  });

  it('exposes suite list, create, and bind-cases endpoints', async () => {
    const service = new CaseService();
    const category = await service.createCategory({
      appCode: 'credit_assistant',
      name: '应用分类',
      description: '当前应用分类',
    });
    const testCase = await service.create({
      caseName: '接口用例',
      appCode: 'credit_assistant',
      categoryId: category.id,
      riskLevel: 'LOW',
      query: '问题',
      expectedBehavior: '回答',
    });
    const controller = new CaseController(service);

    const created = controller.createSuite({
      suiteCode: 'SUITE_API',
      suiteName: '接口用例集',
      appCode: 'credit_assistant',
    });

    expect(created.data.suiteCode).toBe('SUITE_API');
    expect(controller.bindSuiteCases({ suiteCode: 'SUITE_API', caseCodes: [testCase.id] }).data.caseCount).toBe(1);
    expect((await controller.suiteList({
      page: { currentPage: 1, linesPerPage: 10 },
      data: { appCode: 'credit_assistant' },
    })).list[0]?.suiteCode).toBe('SUITE_API');
  });

  it('exposes category and system preset case endpoints', async () => {
    const service = new CaseService();
    const controller = new CaseController(service);
    const category = await controller.createCategory({
      name: '系统分类',
      description: '系统预置用例分类',
    });
    const preset = await controller.createPreset({
      caseName: '系统预置用例',
      appCode: 'SYSTEM_PRESET',
      categoryId: category.data.id,
      riskLevel: 'LOW',
      query: '如何查询信用报告？',
      expectedBehavior: '正常回答',
    });

    expect((await controller.categoryList({
      page: { currentPage: 1, linesPerPage: 20 },
      data: {},
    })).list).toHaveLength(1);
    expect((await controller.presetList({
      page: { currentPage: 1, linesPerPage: 20 },
      data: { categoryId: category.data.id },
    })).list).toHaveLength(1);

    const imported = await controller.importPresetToApp({
      appCode: 'credit_assistant',
      suiteCode: 'CONTROLLER_PRESET_SUITE',
      suiteName: '控制器预置用例集',
      presetCaseCodes: [preset.data.id],
    });

    expect(imported.data.createdCount).toBe(1);
    expect(imported.data.suite.caseCount).toBe(1);
  });
});
