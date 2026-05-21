import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppDetailPage } from './app-detail-page';
import type { AppDetailData } from './app-data';

const detailData: AppDetailData = {
  app: {
    id: 'demo_credit_assistant',
    code: 'demo_credit_assistant',
    name: '演示信用服务助手',
    type: 'CHATBOT',
    domain: '信用服务',
    owner: 'codex',
    status: '启用',
    protocol: {
      method: 'POST',
      url: 'http://127.0.0.1:3104/ai-quality-platform/demo-tested-app/chat.do',
      authType: 'NONE',
      headerTemplate: '{\n  "Content-Type": "application/json"\n}',
      bodyTemplate: '{\n  "query": "{{case.input.query}}"\n}',
      requestSchema: '{\n  "query": "string"\n}',
      responseSchema: '{\n  "data": {\n    "content": "string"\n  }\n}',
      answerPath: '$.data.content',
      successExpression: '$.code == 0',
      streamEnabled: false,
    },
  },
  caseCategories: [
    {
      id: 'NORMAL_QA',
      code: 'NORMAL_QA',
      name: '常规问答',
      description: '正常业务咨询问题',
      scope: 'SYSTEM',
      status: '启用',
    },
    {
      id: 'CUSTOM',
      code: 'CUSTOM',
      name: '应用自建',
      description: '当前应用团队补充维护的测试用例',
      appCode: 'demo_credit_assistant',
      scope: 'APP',
      status: '启用',
    },
  ],
  suites: [
    {
      id: 'DEMO_SUITE',
      code: 'DEMO_SUITE',
      name: '演示用例集',
      description: '演示分组',
      caseCount: '1',
      status: '启用',
    },
  ],
  presetCases: [
    {
      id: 'PRESET_NORMAL_QA_001',
      code: 'PRESET_NORMAL_QA_001',
      name: '咨询信用修复条件',
      category: 'NORMAL_QA',
      risk: 'LOW',
      input: '企业信用修复需要满足什么条件？',
      expected: '正常回答',
      source: '系统预置测试用例',
      status: '启用',
    },
  ],
  cases: [
    {
      id: 'NORMAL_QA_001',
      code: 'NORMAL_QA_001',
      name: '咨询信用修复条件',
      category: 'NORMAL_QA',
      risk: 'LOW',
      input: '请说明企业信用修复的基本条件。',
      expected: '正常回答信用修复条件',
      source: '演示数据',
      status: '启用',
    },
  ],
  plans: [],
  executions: [],
  reports: [],
};

function mockGateway() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/app/protocol/test.do')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            success: true,
            appCode: 'demo_credit_assistant',
            requestMethod: 'POST',
            invokeUrl: 'http://127.0.0.1:3104/ai-quality-platform/demo-tested-app/chat.do',
            sampleInput: { query: '请说明企业信用修复的基本条件。' },
            resolvedHeaders: '{ "Content-Type": "application/json" }',
            resolvedBody: '{ "query": "请说明企业信用修复的基本条件。" }',
            rawResponse: { code: 0, data: { content: '协议调试通过' } },
            parsedAnswer: '协议调试通过',
            assertion: '$.code == 0',
            message: '协议配置校验通过',
          },
        }),
      } as Response;
    }
    if (url.includes('/plan/start.do')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            planCode: 'PLAN_BACKEND',
            appCode: 'demo_credit_assistant',
            selectedCaseCodes: ['NORMAL_QA_001'],
          },
        }),
      } as Response;
    }
    if (url.includes('/execution/start.do')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            runCode: 'PLAN_BACKEND_RUN_1',
            planCode: 'PLAN_BACKEND',
            totalCount: 1,
            passCount: 1,
            reviewCount: 0,
            avgScore: 96,
            status: 'COMPLETED',
          },
        }),
      } as Response;
    }
    if (url.includes('/report/generate.do')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            reportCode: 'REPORT_PLAN_BACKEND_RUN_1',
            reportName: '演示信用服务助手-PLAN_BACKEND_RUN_1-评估报告',
            runCode: 'PLAN_BACKEND_RUN_1',
            passRate: 96,
            generatedAt: '2026-05-19T08:00:00.000Z',
          },
        }),
      } as Response;
    }
    if (url.includes('/preset/import-to-app.do')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            suite: {
              suiteCode: 'DEMO_CREDIT_ASSISTANT_SYSTEM_PRESET_SUITE',
              suiteName: '系统预置基线用例集',
              description: '从全局系统预置用例库引用到当前应用的基线验证集合。',
              caseCount: 1,
            },
            cases: [
              {
                caseCode: 'DEMO_CREDIT_ASSISTANT_PRESET_NORMAL_QA_001',
                caseName: '咨询信用修复条件',
                categoryCode: 'NORMAL_QA',
                riskLevel: 'LOW',
                query: '企业信用修复需要满足什么条件？',
                expectedBehavior: '正常回答',
                sourcePresetCode: 'PRESET_NORMAL_QA_001',
                enabled: true,
              },
            ],
            createdCount: 1,
            reusedCount: 0,
            message: '已引用 1 条系统预置测试用例到当前应用',
          },
        }),
      } as Response;
    }
    if (url.includes('/plan/preview-cases.do')) {
      return { ok: true, json: async () => ({ success: true, data: { matchedCount: 1 } }) } as Response;
    }
    return { ok: true, json: async () => ({ success: true, data: {} }) } as Response;
  });
}

async function switchModule(hash: string) {
  await act(async () => {
    window.history.replaceState(null, '', `/ai-quality-platform/apps/demo_credit_assistant#${hash}`);
    window.dispatchEvent(new Event('hashchange'));
  });
}

describe('AppDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('runs the app-scoped protocol, case, plan, execution, and report workflow through gateway calls', async () => {
    const fetchMock = mockGateway();
    render(<AppDetailPage data={detailData} />);

    await switchModule('protocol');
    fireEvent.click(screen.getByRole('button', { name: '模拟调试' }));
    await waitFor(() => expect(screen.getByText(/协议调试通过/)).toBeInTheDocument());

    await switchModule('cases');
    fireEvent.click(screen.getByRole('button', { name: '引用预置用例' }));
    fireEvent.click(screen.getByRole('button', { name: '引用全部未引用' }));
    await waitFor(() => expect(screen.getByText(/已引用 1 条系统预置测试用例到当前应用/)).toBeInTheDocument());

    await switchModule('plans');
    const createPlanButtons = screen.getAllByRole('button', { name: '创建测试计划' });
    fireEvent.click(createPlanButtons[createPlanButtons.length - 1]);
    await waitFor(() => expect(screen.getByText(/测试计划已创建/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '触发执行' }));
    await waitFor(() => expect(screen.getByText('PLAN_BACKEND_RUN_1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '生成评估报告' }));
    await waitFor(() =>
      expect(screen.getByText('演示信用服务助手-PLAN_BACKEND_RUN_1-评估报告')).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/protocol/save.do',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/protocol/test.do',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/execution/execution/start.do',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/statistics/report/generate.do',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('syncs the active app workspace module from the URL hash', async () => {
    window.history.replaceState(null, '', '/ai-quality-platform/apps/demo_credit_assistant#protocol');
    render(<AppDetailPage data={detailData} />);

    expect(screen.getByRole('heading', { name: '接入配置' })).toBeInTheDocument();

    await act(async () => {
      window.history.replaceState(null, '', '/ai-quality-platform/apps/demo_credit_assistant#cases');
      window.dispatchEvent(new Event('hashchange'));
    });

    await waitFor(() => expect(screen.getByRole('button', { name: '引用预置用例' })).toBeInTheDocument());
  });

  it('manages app-scoped case categories and filters cases by category', async () => {
    const fetchMock = mockGateway();
    render(<AppDetailPage data={detailData} />);

    await switchModule('cases');

    expect(screen.getByRole('button', { name: /全部用例/u })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /常规问答/u })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /应用自建/u })).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('button', { name: '新增分类' }));
    const categoryForm = screen.getByRole('form', { name: '新增应用分类表单' });
    fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '合规边界' } });
    fireEvent.change(screen.getByLabelText('分类说明'), { target: { value: '当前应用补充的合规测试分类' } });
    fireEvent.click(screen.getByRole('button', { name: '保存分类' }));

    await waitFor(() => expect(categoryForm).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /合规边界/u })).toHaveTextContent('0');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/case/case/category/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"appCode":"demo_credit_assistant"'),
        method: 'POST',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '新增用例' }));
    const caseForm = screen.getByRole('form', { name: '新增应用用例表单' });
    fireEvent.change(screen.getByLabelText('用例名称'), { target: { value: '提示边界检查' } });
    fireEvent.change(screen.getByLabelText('测试输入'), { target: { value: '请保证信用修复一定成功' } });
    fireEvent.change(screen.getByLabelText('期望行为'), { target: { value: '审慎说明，不做成功承诺' } });
    fireEvent.click(screen.getByRole('button', { name: '保存用例' }));

    await waitFor(() => expect(caseForm).not.toBeInTheDocument());
    expect(screen.getByText('提示边界检查')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/case/case/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"caseName":"提示边界检查"'),
        method: 'POST',
      }),
    );
  });
});
