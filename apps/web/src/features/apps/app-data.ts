import { loadGatewayRecords } from '../gateway-server';
import type { ManagementConsoleRecord } from '../management-console-page';

export interface AppProtocolView {
  method: string;
  url: string;
  authType: string;
  headerTemplate: string;
  bodyTemplate: string;
  requestSchema: string;
  responseSchema: string;
  answerPath: string;
  successExpression: string;
  streamEnabled: boolean;
}

export interface AppView extends ManagementConsoleRecord {
  code: string;
  name: string;
  type: string;
  domain: string;
  owner: string;
  protocol: AppProtocolView;
}

export interface AppCaseCategoryView extends ManagementConsoleRecord {
  name: string;
  description: string;
  appCode?: string;
  scope: 'SYSTEM' | 'APP';
}

export interface AppDetailData {
  app: AppView;
  caseCategories: AppCaseCategoryView[];
  suites: ManagementConsoleRecord[];
  presetCases: ManagementConsoleRecord[];
  cases: ManagementConsoleRecord[];
  plans: ManagementConsoleRecord[];
  executions: ManagementConsoleRecord[];
  reports: ManagementConsoleRecord[];
}

/**
 * @author codex
 * Maps backend application records into the product-facing application container shape.
 */
export function mapAppRecord(item: Record<string, unknown>): AppView {
  const adapter = (item.adapterConfig ?? {}) as { response?: { answerPath?: string; successExpression?: string } };
  const invokeUrl = typeof item.invokeUrl === 'string' && item.invokeUrl.trim() ? item.invokeUrl : '未配置';

  return {
    id: String(item.appCode),
    code: String(item.appCode),
    name: String(item.appName),
    type: String(item.appType),
    domain: String(item.businessDomain),
    owner: String(item.owner ?? '未分配'),
    endpoint: invokeUrl,
    method: String(item.requestMethod ?? 'POST'),
    authType: String(item.authType ?? 'NONE'),
    headerTemplate: String(item.headerTemplate ?? '{\n  "Content-Type": "application/json"\n}'),
    bodyTemplate: String(item.bodyTemplate ?? '{\n  "query": "{{case.input.query}}"\n}'),
    requestSchema: String(item.requestSchema ?? '{\n  "query": "string"\n}'),
    responseSchema: String(item.responseSchema ?? '{\n  "data": {\n    "content": "string"\n  }\n}'),
    answerPath: String(adapter.response?.answerPath ?? '$.data.content'),
    successExpression: String(adapter.response?.successExpression ?? '$.code == 0'),
    protocolReady: item.adapterConfig ? '已配置' : '待配置',
    status: item.status === 'DISABLED' ? '停用' : '启用',
    protocol: {
      method: String(item.requestMethod ?? 'POST'),
      url: invokeUrl === '未配置' ? '' : invokeUrl,
      authType: String(item.authType ?? 'NONE'),
      headerTemplate: String(item.headerTemplate ?? '{\n  "Content-Type": "application/json"\n}'),
      bodyTemplate: String(item.bodyTemplate ?? '{\n  "query": "{{case.input.query}}"\n}'),
      requestSchema: String(item.requestSchema ?? '{\n  "query": "string"\n}'),
      responseSchema: String(item.responseSchema ?? '{\n  "data": {\n    "content": "string"\n  }\n}'),
      answerPath: String(adapter.response?.answerPath ?? '$.data.content'),
      successExpression: String(adapter.response?.successExpression ?? '$.code == 0'),
      streamEnabled: Boolean(item.streamEnabled),
    },
  };
}

export async function loadApps() {
  const data = await loadGatewayRecords('business', '/app/list.do');
  return data.records.map(mapAppRecord);
}

export async function loadAppDetail(appCode: string): Promise<AppDetailData | null> {
  const [apps, categoryData, suiteData, presetCaseData, caseData, planData, executionData, reportData] = await Promise.all([
    loadApps(),
    loadGatewayRecords('case', '/case/category/list.do', { appCode, includeGlobal: true }),
    loadGatewayRecords('case', '/case/suite/list.do', { appCode }),
    loadGatewayRecords('case', '/case/preset/list.do'),
    loadGatewayRecords('case', '/case/list.do', { appCode }),
    loadGatewayRecords('plan', '/plan/list.do', { appCode }),
    loadGatewayRecords('execution', '/execution/run-list.do', { appCode }),
    loadGatewayRecords('statistics', '/report/list.do', { appCode }),
  ]);
  const app = apps.find((item) => item.code === appCode);
  if (!app) return null;

  return {
    app,
    caseCategories: categoryData.records.map((item) => {
      const categoryAppCode = typeof item.appCode === 'string' ? item.appCode : undefined;
      return {
        id: String(item.id ?? item.code),
        code: String(item.id ?? item.code),
        name: String(item.name ?? '未命名分类'),
        description: String(item.description ?? '未配置说明'),
        appCode: categoryAppCode,
        scope: categoryAppCode ? 'APP' : 'SYSTEM',
        status: item.enabled === false || item.status === '停用' ? '停用' : '启用',
      };
    }),
    suites: suiteData.records.map((item) => ({
      id: String(item.suiteCode),
      code: String(item.suiteCode),
      name: String(item.suiteName),
      description: String(item.description ?? '当前应用的测试用例分组'),
      caseCount: String(item.caseCount ?? 0),
      status: '启用',
    })),
    presetCases: presetCaseData.records.map((item) => ({
      id: String(item.caseCode),
      code: String(item.caseCode),
      name: String(item.caseName),
      category: String(item.categoryCode),
      risk: String(item.riskLevel),
      expected: String(item.expectedBehavior ?? '未配置'),
      input: String(item.query ?? '未配置测试输入'),
      source: '系统预置测试用例',
      status: item.enabled === false ? '停用' : '启用',
    })),
    cases: caseData.records.map((item) => {
      const sourcePresetCode = (item as Record<string, unknown>).sourcePresetCode;
      return {
        id: String(item.caseCode),
        code: String(item.caseCode),
        name: String(item.caseName),
        category: String(item.categoryCode),
        risk: String(item.riskLevel),
        expected: String(item.expectedBehavior ?? '未配置'),
        input: String(item.query ?? '未配置测试输入'),
        source: sourcePresetCode ? '系统预置测试用例' : String(item.source ?? '当前应用'),
        sourcePresetCode: typeof sourcePresetCode === 'string' ? sourcePresetCode : undefined,
        status: item.enabled === false ? '停用' : '启用',
      };
    }),
    plans: planData.records.map((item) => ({
      id: String(item.planCode),
      code: String(item.planCode),
      name: String(item.planName),
      type: String(item.planType),
      scope: String(item.caseFilter ? '已配置筛选' : '全部用例'),
      caseFilter: item.caseFilter,
      status: item.status === 'DISABLED' ? '停用' : '启用',
    })),
    executions: executionData.records.map((item) => ({
      id: String(item.runCode),
      run: String(item.runCode),
      plan: String(item.planCode),
      total: String(item.totalCount),
      pass: String(item.passCount),
      review: String(item.reviewCount),
      score: String(item.avgScore),
      status: mapRunStatus(String(item.status)),
    })),
    reports: reportData.records.map((item) => ({
      id: String(item.reportCode),
      name: String(item.reportName),
      run: String(item.runCode),
      passRate: `${String(item.passRate ?? 0)}%`,
      generatedAt: String(item.generatedAt ?? '待生成'),
      status: '已生成',
    })),
  };
}

function mapRunStatus(status: string) {
  if (status === 'RUNNING') return '运行中';
  if (status === 'CANCELLED') return '已取消';
  if (status === 'FAILED') return '失败';
  return '已完成';
}
