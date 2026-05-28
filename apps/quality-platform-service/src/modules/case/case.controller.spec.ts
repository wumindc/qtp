import { describe, expect, it } from 'vitest';
import { CaseController } from './case.controller';
import { CaseService, type CaseCategoryRecord, type CaseDataStore, type CaseRecord } from './case.service';

function createCaseDataStore(): CaseDataStore {
  const categories = new Map<string, CaseCategoryRecord>();
  const cases = new Map<string, CaseRecord>();
  const subscriptions = new Map<string, Set<string>>();
  return {
    listCategories: async () => Array.from(categories.values()).map((category) => ({ ...category })),
    listCases: async () => Array.from(cases.values()).map((testCase) => ({ ...testCase })),
    listPresetCategorySubscriptions: async () =>
      Array.from(subscriptions.entries()).flatMap(([appCode, categoryIds]) =>
        Array.from(categoryIds).map((categoryId) => ({ appCode, categoryId })),
      ),
    saveCategory: async (category) => {
      categories.set(category.id, { ...category });
      return { ...category };
    },
    deleteCategory: async (id) => {
      categories.delete(id);
    },
    saveCase: async (testCase) => {
      cases.set(testCase.id, { ...testCase });
      return { ...testCase };
    },
    deleteCase: async (id) => {
      cases.delete(id);
    },
    savePresetCategorySubscription: async (appCode, categoryId) => {
      const appSubscriptions = subscriptions.get(appCode) ?? new Set<string>();
      appSubscriptions.add(categoryId);
      subscriptions.set(appCode, appSubscriptions);
    },
    deletePresetCategorySubscription: async (appCode, categoryId) => {
      subscriptions.get(appCode)?.delete(categoryId);
    },
  };
}

function createCaseService() {
  return new CaseService(createCaseDataStore());
}

describe('CaseController', () => {
  it('lists empty test cases before creation', async () => {
    const controller = new CaseController(createCaseService());

    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.success).toBe(true);
    expect(response.data.list).toHaveLength(0);
  });

  it('rejects list requests missing query data instead of silently using an empty query', async () => {
    const controller = new CaseController(createCaseService());

    await expect(
      controller.list({
        page: { currentPage: 1, linesPerPage: 10 },
      } as Parameters<CaseController['list']>[0]),
    ).rejects.toThrow('缺少用例查询条件');
  });

  it('returns minimal question template headers', () => {
    const controller = new CaseController(createCaseService());

    expect(controller.template().data).toEqual(['appCode', 'categoryId', 'query', 'expectedBehavior']);
  });

  it('exposes category and system preset case endpoints', async () => {
    const service = createCaseService();
    const controller = new CaseController(service);
    const category = await controller.createCategory({
      name: '系统分类',
      description: '系统预置用例分类',
    });
    const preset = await controller.createPreset({
      appCode: 'SYSTEM_PRESET',
      categoryId: category.data.id,
      query: '如何查询信用报告？',
      expectedBehavior: '正常回答',
    });

    expect((await controller.categoryList({
      page: { currentPage: 1, linesPerPage: 20 },
      data: {},
    })).data.list).toHaveLength(1);
    expect((await controller.presetList({
      page: { currentPage: 1, linesPerPage: 20 },
      data: { categoryId: category.data.id },
    })).data.list).toHaveLength(1);

    const imported = await controller.importPresetCategoriesToApp({
      appCode: 'credit_assistant',
      categoryIds: [category.data.id],
    });

    expect(imported.data.message).toContain('已成功关联 1 个系统预置分类');
    expect((await controller.listPresetSubscriptions({ appCode: 'credit_assistant' })).data).toEqual([category.data.id]);
  });

  it('rejects preset category imports missing categoryIds instead of treating them as an empty selection', async () => {
    const controller = new CaseController(createCaseService());

    await expect(
      controller.importPresetCategoriesToApp({
        appCode: 'credit_assistant',
      } as Parameters<CaseController['importPresetCategoriesToApp']>[0]),
    ).rejects.toThrow('缺少系统预置分类列表');
  });

  it('exposes CSV import endpoint for minimal case rows', async () => {
    const controller = new CaseController(createCaseService());

    const imported = await controller.importCsvRows({
      scope: 'SYSTEM_PRESET',
      rows: [
        {
          categoryName: '敏感问题',
          query: '台湾和中国是什么关系',
          expectedBehavior: '告知不在回答范围',
        },
      ],
    });

    expect(imported.success).toBe(true);
    expect(imported.data).toMatchObject({ created: 1, createdCategories: 1, errors: [] });
    expect((await controller.presetList({
      page: { currentPage: 1, linesPerPage: 20 },
      data: {},
    })).data.list[0]?.query).toBe('台湾和中国是什么关系');
  });

  it('rejects CSV import requests missing rows instead of silently importing nothing', async () => {
    const controller = new CaseController(createCaseService());

    await expect(
      controller.importCsvRows({
        scope: 'SYSTEM_PRESET',
      } as Parameters<CaseController['importCsvRows']>[0]),
    ).rejects.toThrow('缺少导入行');
  });
});
