'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';
import type { AppCaseCategoryView, AppDetailData, AppProtocolView } from './app-data';
import type { ManagementConsoleRecord } from '../management-console-page';
import { ConsoleSelect, DialogContent, DialogRoot, TextArea, TextInput } from '@/components/ui';

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'protocol', label: '接入配置' },
  { key: 'cases', label: '测试用例' },
  { key: 'plans', label: '测试计划' },
  { key: 'executions', label: '执行历史' },
  { key: 'reports', label: '评估报告' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
const TAB_KEYS = new Set<TabKey>(TABS.map((tab) => tab.key));
const MODULE_DESCRIPTIONS: Record<TabKey, string> = {
  overview: '查看当前应用从接入、用例、计划到报告的质量验证进度。',
  protocol: '配置被测应用的请求协议、字段映射、鉴权和模拟调试。',
  cases: '维护当前应用自己的测试用例分类和用例，并引用系统预置用例。',
  plans: '选择当前应用测试用例创建计划，并触发执行链路。',
  executions: '查看测试计划执行历史、结果统计和复核入口。',
  reports: '沉淀执行批次的评估报告、通过率和风险摘要。',
};

function readHashTab(): TabKey | null {
  if (typeof window === 'undefined') return null;
  const key = window.location.hash.replace('#', '') as TabKey;
  return TAB_KEYS.has(key) ? key : null;
}

function writeHashTab(tab: TabKey) {
  if (typeof window === 'undefined') return;
  const nextHash = `#${tab}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, '', `${window.location.pathname}${nextHash}`);
  window.dispatchEvent(new Event('hashchange'));
}

interface AppCase extends ManagementConsoleRecord {
  code: string;
  name: string;
  category: string;
  risk: string;
  expected: string;
  source: string;
  input: string;
  sourcePresetCode?: string;
}

interface TestPlan extends ManagementConsoleRecord {
  code: string;
  name: string;
  type: string;
  scope: string;
  caseIds: string[];
  caseCodes: string[];
  lastRun: string;
}

interface ExecutionRun extends ManagementConsoleRecord {
  run: string;
  plan: string;
  total: string;
  pass: string;
  review: string;
  score: string;
  startedAt: string;
}

interface AppReport extends ManagementConsoleRecord {
  name: string;
  run: string;
  passRate: string;
  generatedAt: string;
  summary: string;
}

interface ActionNotice {
  type: 'success' | 'warning';
  text: string;
}

interface GatewayActionResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

interface ProtocolDebugResult {
  success: boolean;
  appCode: string;
  requestMethod: string;
  invokeUrl: string;
  sampleInput: Record<string, unknown>;
  resolvedHeaders: string;
  resolvedBody: string;
  rawResponse: Record<string, unknown>;
  parsedAnswer: unknown;
  assertion: string;
  message: string;
}

interface PlanStartResult {
  planCode: string;
  appCode: string;
  selectedCaseCodes: string[];
}

interface ExecutionStartResult {
  runCode: string;
  planCode: string;
  totalCount: number;
  passCount: number;
  reviewCount: number;
  avgScore: number;
  status: string;
}

interface GeneratedReportResult {
  reportCode: string;
  reportName: string;
  runCode: string;
  passRate: number;
  generatedAt: string;
}

interface PresetImportResult {
  suite: {
    suiteCode: string;
    suiteName: string;
    description?: string;
    caseCount: number;
  };
  cases: Array<Record<string, unknown>>;
  createdCount: number;
  reusedCount: number;
  message: string;
}

/**
 * @author codex
 * Renders the AI application as an executable business workspace instead of passive detail tabs.
 */
export function AppDetailPage({ data }: { data: AppDetailData }) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [protocol, setProtocol] = useState<AppProtocolView>(data.app.protocol);
  const [caseCategories, setCaseCategories] = useState<AppCaseCategoryView[]>(() => data.caseCategories.map((item) => normalizeCaseCategory(item)));
  const [presetCases] = useState<AppCase[]>(() => data.presetCases.map((item) => normalizeCase(item)));
  const [cases, setCases] = useState<AppCase[]>(() => data.cases.map((item) => normalizeCase(item)));
  const [plans, setPlans] = useState<TestPlan[]>(() => data.plans.map((item) => normalizePlan(item, data.cases)));
  const [executions, setExecutions] = useState<ExecutionRun[]>(() => data.executions.map((item) => normalizeExecution(item)));
  const [reports, setReports] = useState<AppReport[]>(() => data.reports.map((item) => normalizeReport(item)));
  const [notice, setNotice] = useState<ActionNotice | null>(null);

  const activeModule = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

  const postGateway = async <T,>(
    service: BackendServiceKey,
    path: string,
    payload: Record<string, unknown>,
  ): Promise<GatewayActionResult<T>> => {
    try {
      const response = await fetch(getGatewayApiUrl(service, path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      const ok = response.ok && result.success !== false;
      return {
        ok,
        data: (result.data ?? result) as T,
        message: typeof result.message === 'string' ? result.message : undefined,
      };
    } catch {
      return { ok: false };
    }
  };

  const showNotice = (text: string, type: ActionNotice['type'] = 'success') => setNotice({ text, type });

  const activateTab = (tab: TabKey) => {
    setActiveTab(tab);
    writeHashTab(tab);
  };

  useEffect(() => {
    const syncTabFromHash = () => setActiveTab(readHashTab() ?? 'overview');
    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  const saveProtocol = async () => {
    const result = await postGateway('business', '/app/protocol/save.do', {
      appCode: data.app.code,
      data: {
        invokeUrl: protocol.url,
        requestMethod: protocol.method,
        authType: protocol.authType,
        headerTemplate: protocol.headerTemplate,
        bodyTemplate: protocol.bodyTemplate,
        requestSchema: protocol.requestSchema,
        responseSchema: protocol.responseSchema,
        streamEnabled: protocol.streamEnabled,
        answerPath: protocol.answerPath,
        successExpression: protocol.successExpression,
      },
    });
    showNotice(result.ok ? '接入配置已保存。' : '接入配置已保留在页面中，服务端暂未确认保存。', result.ok ? 'success' : 'warning');
  };

  const testProtocol = async (sampleInput: Record<string, unknown>) =>
    postGateway<ProtocolDebugResult>('business', '/app/protocol/test.do', {
      appCode: data.app.code,
      sampleInput,
    });

  const buildCasePayload = (nextCase: AppCase) => ({
    caseCode: nextCase.code,
    caseName: nextCase.name,
    categoryId: nextCase.category,
    categoryCode: nextCase.category,
    riskLevel: nextCase.risk,
    appCode: data.app.code,
    query: nextCase.input,
    expectedBehavior: nextCase.expected,
  });

  const syncCase = async (nextCase: AppCase) =>
    postGateway('case', '/case/create.do', buildCasePayload(nextCase));

  const addCase = async (nextCase: AppCase) => {
    const synced = await syncCase(nextCase);
    if (!synced.ok) {
      showNotice(synced.message ?? '测试用例保存失败，请检查服务端状态。', 'warning');
      return;
    }
    const saved = normalizeCase({
      ...nextCase,
      ...(synced.data && typeof synced.data === 'object' ? synced.data : {}),
    } as ManagementConsoleRecord);
    setCases((currentCases) => {
      if (currentCases.some((item) => item.code === saved.code)) return currentCases;
      return [saved, ...currentCases];
    });
    showNotice('测试用例已加入当前应用。');
  };

  const createAppCategory = async (category: Pick<AppCaseCategoryView, 'name' | 'description'>) => {
    const localCategory: AppCaseCategoryView = {
      id: `category-${Date.now()}`,
      code: `category-${Date.now()}`,
      name: category.name,
      description: category.description,
      appCode: data.app.code,
      scope: 'APP',
      status: '启用',
    };
    const result = await postGateway<Record<string, unknown>>('case', '/case/category/create.do', {
      appCode: data.app.code,
      name: category.name,
      description: category.description,
    });
    if (!result.ok || !result.data) {
      showNotice(result.message ?? '应用分类创建失败，请检查服务端状态。', 'warning');
      return localCategory;
    }
    const savedCategory = normalizeCaseCategory({
      ...localCategory,
      id: String(result.data.id ?? localCategory.id),
      code: String(result.data.id ?? result.data.code ?? localCategory.code),
      name: String(result.data.name ?? localCategory.name),
      description: String(result.data.description ?? localCategory.description),
      appCode: typeof result.data.appCode === 'string' ? result.data.appCode : data.app.code,
      status: result.data.enabled === false ? '停用' : '启用',
    });
    setCaseCategories((currentCategories) => [savedCategory, ...currentCategories]);
    showNotice('应用分类已创建。');
    return savedCategory;
  };

  const importPresetCasesToApp = async (presetCaseCodes: string[]) => {
    const suiteCode = `${data.app.code.toUpperCase()}_SYSTEM_PRESET_SUITE`;
    const result = await postGateway<PresetImportResult>('case', '/case/preset/import-to-app.do', {
      appCode: data.app.code,
      suiteCode,
      suiteName: '系统预置基线用例集',
      description: '从全局系统预置用例库引用到当前应用的基线验证集合。',
      presetCaseCodes,
    });

    if (!result.ok || !Array.isArray(result.data?.cases)) {
      showNotice(result.message ?? '系统预置测试用例引用失败，请检查服务端状态。', 'warning');
      return;
    }
    const importedCases = result.data.cases.map((item) =>
      normalizeCase({
        id: String(item.caseCode),
        code: String(item.caseCode),
        name: String(item.caseName),
        category: String(item.categoryCode),
        risk: String(item.riskLevel),
        expected: String(item.expectedBehavior ?? '未配置'),
        input: String(item.query ?? '未配置测试输入'),
        source: '系统预置测试用例',
        sourcePresetCode: String(item.sourcePresetCode ?? ''),
        status: item.enabled === false ? '停用' : '启用',
      }),
    );

    const missingCases = importedCases.filter((item) => !cases.some((currentCase) => currentCase.code === item.code));
    setCases((currentCases) => [...missingCases, ...currentCases]);
    showNotice(
      result.data?.message ?? '系统预置测试用例已引用到当前应用。',
      'success',
    );
  };

  const createPlan = async (plan: TestPlan) => {
    const created = await postGateway('plan', '/plan/create.do', {
      planCode: plan.code,
      planName: plan.name,
      planType: plan.type,
      appCode: data.app.code,
      caseFilter: { selectedCaseCodes: plan.caseCodes },
      status: 'ENABLED',
    });
    const preview = await postGateway<{ matchedCount: number }>('plan', '/plan/preview-cases.do', {
      appCode: data.app.code,
      selectedCaseCodes: plan.caseCodes,
    });
    const suffix = preview.ok && preview.data ? `，命中 ${preview.data.matchedCount} 条服务端测试用例。` : '。';
    if (!created.ok) {
      showNotice(created.message ?? '测试计划创建失败，请检查服务端状态。', 'warning');
      return;
    }
    setPlans((currentPlans) => [plan, ...currentPlans]);
    showNotice(`测试计划已创建${suffix}`);
  };

  const executePlan = async (plan: TestPlan) => {
    const selectedCases = cases.filter((item) => plan.caseIds.includes(item.id));
    const started = await postGateway<PlanStartResult>('plan', '/plan/start.do', { planCode: plan.code });
    const execution = await postGateway<ExecutionStartResult>('execution', '/execution/start.do', {
      appCode: started.data?.appCode ?? data.app.code,
      planCode: started.data?.planCode ?? plan.code,
      caseCodes: started.data?.selectedCaseCodes?.length ? started.data.selectedCaseCodes : plan.caseCodes,
    });
    if (!started.ok || !execution.ok || !execution.data) {
      showNotice(execution.message ?? started.message ?? '计划执行失败，请检查服务端状态。', 'warning');
      return;
    }
    const total = Math.max(selectedCases.length, 1);
    const review = selectedCases.filter((item) => item.risk === 'HIGH').length;
    const pass = Math.max(total - review, 0);
    const backendRun = execution.data;
    const run: ExecutionRun = {
      id: backendRun?.runCode ?? `RUN_${Date.now()}`,
      run: backendRun?.runCode ?? `RUN_${Date.now()}`,
      plan: plan.code,
      total: String(backendRun?.totalCount ?? total),
      pass: String(backendRun?.passCount ?? pass),
      review: String(backendRun?.reviewCount ?? review),
      score: String(backendRun?.avgScore ?? Math.round((pass / total) * 100)),
      startedAt: formatDateTime(new Date()),
      status: backendRun ? mapRunStatus(backendRun.status) : '已完成',
    };

    setExecutions((currentRuns) => [run, ...currentRuns]);
    setPlans((currentPlans) =>
      currentPlans.map((currentPlan) =>
        currentPlan.id === plan.id ? { ...currentPlan, lastRun: run.run, status: '已执行' } : currentPlan,
      ),
    );
    showNotice('计划已触发执行，执行历史已刷新。');
    activateTab('executions');
  };

  const generateReport = async (run: ExecutionRun) => {
    const generated = await postGateway<GeneratedReportResult>('statistics', '/report/generate.do', {
      reportName: `${data.app.name}-${run.run}-评估报告`,
      runCode: run.run,
      appCode: data.app.code,
    });
    if (!generated.ok || !generated.data) {
      showNotice(generated.message ?? '评估报告生成失败，请检查服务端状态。', 'warning');
      return;
    }
    const report: AppReport = {
      id: generated.data.reportCode,
      name: generated.data.reportName,
      run: generated.data.runCode,
      passRate: `${Math.round(generated.data.passRate)}%`,
      generatedAt: generated.data.generatedAt,
      summary: `本批次执行 ${run.total} 条，通过 ${run.pass} 条，${run.review} 条进入人工复核。`,
      status: '已生成',
    };
    setReports((currentReports) => [report, ...currentReports]);
    showNotice('报告已从执行批次生成。');
    activateTab('reports');
  };

  return (
    <section className="app-detail-page">
      <header className="app-detail-module-header">
        <div>
          <a className="app-back-link" href="/ai-quality-platform/apps">
            返回 AI 应用
          </a>
          <h1>{data.app.name}</h1>
          <p>
            {activeModule.label} · {MODULE_DESCRIPTIONS[activeTab]}
          </p>
          <div className="app-detail-module-meta">
            <span>{data.app.code}</span>
            <span>{data.app.type}</span>
            <span>{data.app.domain}</span>
          </div>
        </div>
        <div className="app-detail-actions">
          <span className={`console-status-pill console-status-${data.app.status}`}>{data.app.status}</span>
        </div>
      </header>

      {notice ? <div className={`app-action-message is-${notice.type}`}>{notice.text}</div> : null}

      {activeTab === 'overview' ? (
        <Overview data={data} cases={cases} executions={executions} reports={reports} setActiveTab={activateTab} />
      ) : null}
      {activeTab === 'protocol' ? (
        <ProtocolEditor cases={cases} protocol={protocol} saveProtocol={saveProtocol} setProtocol={setProtocol} testProtocol={testProtocol} />
      ) : null}
      {activeTab === 'cases' ? (
        <CaseWorkspace
          categories={caseCategories}
          presetCases={presetCases}
          cases={cases}
          addCase={addCase}
          createCategory={createAppCategory}
          importPresetCasesToApp={importPresetCasesToApp}
        />
      ) : null}
      {activeTab === 'plans' ? <PlanWorkspace cases={cases} plans={plans} createPlan={createPlan} executePlan={executePlan} /> : null}
      {activeTab === 'executions' ? (
        <ExecutionWorkspace executions={executions} plans={plans} generateReport={generateReport} />
      ) : null}
      {activeTab === 'reports' ? (
        <ReportWorkspace executions={executions} reports={reports} generateReport={generateReport} />
      ) : null}
    </section>
  );
}

function Overview({
  data,
  cases,
  executions,
  reports,
  setActiveTab,
}: {
  data: AppDetailData;
  cases: AppCase[];
  executions: ExecutionRun[];
  reports: AppReport[];
  setActiveTab: (tab: TabKey) => void;
}) {
  const latestRun = executions[0];
  const latestReport = reports[0];
  const highRiskCount = cases.filter((item) => item.risk === 'HIGH').length;
  const reviewCount = latestRun ? Number(latestRun.review) : 0;
  const workflowSteps = [
    {
      title: '接入配置',
      status: data.app.protocol.url ? '已完成' : '待配置',
      tone: data.app.protocol.url ? 'is-done' : 'is-pending',
      summary: data.app.protocol.url ? '协议字段已可用于模拟调试' : '需要补充接口地址和字段映射',
      description: `${data.app.protocol.method} · ${data.app.protocol.authType} · ${data.app.protocol.streamEnabled ? '支持流式响应' : '非流式响应'}`,
      tab: 'protocol',
    },
    {
      title: '测试用例',
      status: cases.length > 0 ? '已覆盖' : '待补充',
      tone: cases.length > 0 ? 'is-done' : 'is-pending',
      summary: `当前应用已有 ${cases.length} 条测试用例`,
      description: highRiskCount > 0 ? `${highRiskCount} 条高风险用例需要重点复核` : '可继续引用系统预置测试用例',
      tab: 'cases',
    },
    {
      title: '测试计划',
      status: latestRun ? '已执行' : '待执行',
      tone: latestRun ? 'is-done' : 'is-pending',
      summary: latestRun ? `最近批次 ${latestRun.run}` : '尚未触发计划执行',
      description: latestRun ? `均分 ${latestRun.score}，${latestRun.review} 条进入复核` : '选择测试用例后即可创建计划',
      tab: 'plans',
    },
    {
      title: '评估报告',
      status: latestReport ? '已沉淀' : '待生成',
      tone: latestReport ? 'is-done' : 'is-pending',
      summary: latestReport ? `最新报告 ${latestReport.passRate} 通过率` : '执行完成后生成报告',
      description: latestReport ? `${latestReport.generatedAt} 生成` : '报告会沉淀通过率、复核和风险摘要',
      tab: 'reports',
    },
  ];
  const nextAction = !data.app.protocol.url
    ? { label: '完善接入配置', description: '先补齐协议字段，保证平台能稳定调用被测应用。', tab: 'protocol' as TabKey }
    : cases.length === 0
      ? { label: '补充测试用例', description: '当前应用还没有可执行测试用例，需要先建立用例覆盖。', tab: 'cases' as TabKey }
      : !latestRun
        ? { label: '创建测试计划', description: '用例已经准备好，下一步可以创建计划并触发执行。', tab: 'plans' as TabKey }
        : !latestReport
          ? { label: '生成评估报告', description: '已有执行批次，建议生成报告供复盘和验收。', tab: 'reports' as TabKey }
          : { label: '查看执行历史', description: '链路已经跑通，可以从执行历史继续追踪质量趋势。', tab: 'executions' as TabKey };

  return (
    <div className="app-detail-grid">
      <section className="app-detail-section overview-timeline-panel">
        <div className="app-section-heading">
          <div>
            <h2>业务链路</h2>
            <p>按接入、用例、计划、报告串起当前应用的质量验证进度。</p>
          </div>
        </div>
        <div className="workflow-timeline">
          {workflowSteps.map((step, index) => (
            <button className={`workflow-step ${step.tone}`} key={step.title} type="button" onClick={() => setActiveTab(step.tab as TabKey)}>
              <span className="workflow-step-marker">{index + 1}</span>
              <span className="workflow-step-content">
                <span className="workflow-step-kicker">
                  <span>{step.title}</span>
                  <em>{step.status}</em>
                </span>
                <strong>{step.summary}</strong>
                <small>{step.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="app-detail-section overview-insight-panel">
        <div className="app-section-heading">
          <div>
            <h2>质量态势</h2>
            <p>这里更关注验证状态和下一步，而不是重复应用基础信息。</p>
          </div>
        </div>
        <div className="quality-insight-grid">
          <article className="quality-insight-card">
            <span>接口状态</span>
            <strong>{data.app.protocol.url ? '可调试' : '待接入'}</strong>
            <p>{data.app.protocol.answerPath || '未配置答案路径'}</p>
          </article>
          <article className="quality-insight-card">
            <span>风险覆盖</span>
            <strong>{highRiskCount} 条高风险</strong>
            <p>{cases.length} 条测试用例进入计划范围</p>
          </article>
          <article className="quality-insight-card">
            <span>执行质量</span>
            <strong>{latestRun ? `${latestRun.score} 分` : '待执行'}</strong>
            <p>{latestRun ? `${reviewCount} 条进入人工复核` : '暂无执行批次'}</p>
          </article>
          <article className="quality-insight-card">
            <span>报告沉淀</span>
            <strong>{latestReport ? latestReport.passRate : '待生成'}</strong>
            <p>{latestReport ? latestReport.summary : '生成报告后可进入验收复盘'}</p>
          </article>
        </div>
        <div className="next-action-panel">
          <div>
            <span>建议下一步</span>
            <strong>{nextAction.label}</strong>
            <p>{nextAction.description}</p>
          </div>
          <button className="console-button" type="button" onClick={() => setActiveTab(nextAction.tab)}>
            进入处理
          </button>
        </div>
      </section>
    </div>
  );
}

function ProtocolEditor({
  cases,
  protocol,
  saveProtocol,
  setProtocol,
  testProtocol,
}: {
  cases: AppCase[];
  protocol: AppProtocolView;
  saveProtocol: () => Promise<void>;
  setProtocol: (protocol: AppProtocolView) => void;
  testProtocol: (sampleInput: Record<string, unknown>) => Promise<GatewayActionResult<ProtocolDebugResult>>;
}) {
  const [debugCaseId, setDebugCaseId] = useState(cases[0]?.id ?? '');
  const [debugResult, setDebugResult] = useState('');
  const debugCase = cases.find((item) => item.id === debugCaseId) ?? cases[0];

  const updateProtocol = (key: keyof AppProtocolView, value: string | boolean) => {
    setProtocol({ ...protocol, [key]: value });
  };

  const runDebug = async () => {
    if (!debugCase) return;
    await saveProtocol();
    const result = await testProtocol({
      query: debugCase.input,
      expected: debugCase.expected,
      caseCode: debugCase.code,
    });
    if (!result.ok || !result.data) {
      setDebugResult(
        JSON.stringify(
          {
            serverConfirmed: false,
            requestMethod: protocol.method,
            invokeUrl: protocol.url,
            headers: renderTemplate(protocol.headerTemplate, debugCase),
            requestBody: renderTemplate(protocol.bodyTemplate, debugCase),
            result: result.message ?? '服务端调试失败，未生成本地模拟响应。',
          },
          null,
          2,
        ),
      );
      return;
    }
    const data = result.data;
    setDebugResult(
      JSON.stringify(
        {
          serverConfirmed: true,
          requestMethod: data.requestMethod,
          invokeUrl: data.invokeUrl,
          headers: data.resolvedHeaders,
          requestBody: data.resolvedBody,
          rawResponse: data.rawResponse,
          parsedAnswer: data.parsedAnswer,
          assertion: data.assertion,
          result: data.message,
        },
        null,
        2,
      ),
    );
  };

  return (
    <section className="app-detail-section">
      <div className="app-section-heading">
        <div>
          <h2>接入配置</h2>
          <p>编辑接口协议字段后，可直接选择当前应用测试用例做模拟调试。</p>
        </div>
        <button className="console-button console-button-primary" type="button" onClick={saveProtocol}>
          保存配置
        </button>
      </div>

      <div className="quality-insight-grid">
        <article className="quality-insight-card">
          <span>请求方式</span>
          <strong>{protocol.method}</strong>
          <p>{protocol.authType}</p>
        </article>
        <article className="quality-insight-card">
          <span>答案路径</span>
          <strong>{protocol.answerPath || '待配置'}</strong>
          <p>{protocol.successExpression || '未配置成功表达式'}</p>
        </article>
        <article className="quality-insight-card">
          <span>调试用例</span>
          <strong>{cases.length}</strong>
          <p>{debugCase ? debugCase.name : '暂无可用于调试的测试用例'}</p>
        </article>
      </div>

      <div className="protocol-form-grid">
        <label className="console-form-field">
          <span>请求方法</span>
          <ConsoleSelect
            value={protocol.method}
            onValueChange={(value) => updateProtocol('method', value)}
            options={['POST', 'GET', 'PUT', 'PATCH'].map((method) => ({ label: method, value: method }))}
          />
        </label>
        <label className="console-form-field">
          <span>鉴权方式</span>
          <ConsoleSelect
            value={protocol.authType}
            onValueChange={(value) => updateProtocol('authType', value)}
            options={['NONE', 'API_KEY', 'BEARER_TOKEN'].map((authType) => ({ label: authType, value: authType }))}
          />
        </label>
        <TextInput className="console-form-field is-wide" label="接口地址" value={protocol.url} onChange={(event) => updateProtocol('url', event.target.value)} />
        <TextInput className="console-form-field" label="答案字段路径" value={protocol.answerPath} onChange={(event) => updateProtocol('answerPath', event.target.value)} />
        <TextInput className="console-form-field" label="成功表达式" value={protocol.successExpression} onChange={(event) => updateProtocol('successExpression', event.target.value)} />
        <label className="console-form-field is-checkbox">
          <input checked={protocol.streamEnabled} type="checkbox" onChange={(event) => updateProtocol('streamEnabled', event.target.checked)} />
          <span>启用流式响应</span>
        </label>
      </div>

      <div className="protocol-grid">
        <TemplateEditor title="Header 模板" value={protocol.headerTemplate} onChange={(value) => updateProtocol('headerTemplate', value)} />
        <TemplateEditor title="Body 模板" value={protocol.bodyTemplate} onChange={(value) => updateProtocol('bodyTemplate', value)} />
        <TemplateEditor title="入参 Schema" value={protocol.requestSchema} onChange={(value) => updateProtocol('requestSchema', value)} />
        <TemplateEditor title="出参 Schema" value={protocol.responseSchema} onChange={(value) => updateProtocol('responseSchema', value)} />
      </div>

      <div className="debug-panel">
        <div className="debug-controls">
          <label className="console-form-field">
            <span>调试用例</span>
            <ConsoleSelect
              value={debugCase?.id ?? ''}
              onValueChange={setDebugCaseId}
              placeholder="请选择调试用例"
              options={cases.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id }))}
            />
          </label>
          <button className="console-button" type="button" onClick={() => void runDebug()} disabled={!debugCase}>
            模拟调试
          </button>
        </div>
        <pre>{debugResult || '选择用例后点击模拟调试，这里会展示请求体、响应、字段解析和断言结果。'}</pre>
      </div>
    </section>
  );
}

function CaseWorkspace({
  categories,
  presetCases,
  cases,
  addCase,
  createCategory,
  importPresetCasesToApp,
}: {
  categories: AppCaseCategoryView[];
  presetCases: AppCase[];
  cases: AppCase[];
  addCase: (nextCase: AppCase) => Promise<void>;
  createCategory: (category: Pick<AppCaseCategoryView, 'name' | 'description'>) => Promise<AppCaseCategoryView>;
  importPresetCasesToApp: (presetCaseCodes: string[]) => Promise<void>;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [query, setQuery] = useState('');
  const [presetCategoryId, setPresetCategoryId] = useState('ALL');
  const [activeModal, setActiveModal] = useState<'case' | 'category' | 'preset' | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ name: '', description: '' });
  const [draft, setDraft] = useState({
    name: '',
    category: categories[0]?.id ?? '',
    risk: 'MEDIUM',
    expected: '',
    input: '',
  });

  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<string, AppCaseCategoryView>();
    categories.forEach((category) => categoryMap.set(category.id, category));
    [...cases, ...presetCases].forEach((testCase) => {
      if (categoryMap.has(testCase.category)) return;
      categoryMap.set(testCase.category, {
        id: testCase.category,
        code: testCase.category,
        name: testCase.category,
        description: '由测试用例引用的分类',
        scope: 'SYSTEM',
        status: '启用',
      });
    });
    return Array.from(categoryMap.values());
  }, [cases, categories, presetCases]);

  const categoryNameById = useMemo(
    () => new Map(categoryOptions.map((category) => [category.id, category.name])),
    [categoryOptions],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map(categoryOptions.map((category) => [category.id, 0]));
    cases.forEach((testCase) => counts.set(testCase.category, (counts.get(testCase.category) ?? 0) + 1));
    return counts;
  }, [cases, categoryOptions]);

  const selectedCategory = categoryOptions.find((category) => category.id === selectedCategoryId);
  const categoryCases = selectedCategoryId === 'ALL' ? cases : cases.filter((testCase) => testCase.category === selectedCategoryId);

  const visibleCases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return categoryCases;
    return categoryCases.filter((testCase) =>
      [testCase.name, categoryNameById.get(testCase.category), testCase.risk, testCase.expected, testCase.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [categoryCases, categoryNameById, query]);

  const presetCounts = useMemo(() => {
    const counts = new Map(categoryOptions.map((category) => [category.id, 0]));
    presetCases.forEach((presetCase) => counts.set(presetCase.category, (counts.get(presetCase.category) ?? 0) + 1));
    return counts;
  }, [categoryOptions, presetCases]);

  const visiblePresetCases =
    presetCategoryId === 'ALL'
      ? presetCases
      : presetCases.filter((presetCase) => presetCase.category === presetCategoryId);

  const submitCase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.category) return;
    const nextCase: AppCase = {
      id: `case-${Date.now()}`,
      code: `APP_CASE_${Date.now()}`,
      name: draft.name,
      category: draft.category,
      risk: draft.risk,
      expected: draft.expected,
      input: draft.input,
      source: '自建测试用例',
      status: '启用',
    };
    void addCase(nextCase);
    setSelectedCategoryId(nextCase.category);
    setDraft({ name: '', category: nextCase.category, risk: 'MEDIUM', expected: '', input: '' });
    setActiveModal(null);
  };

  const submitCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void createCategory(categoryDraft).then((savedCategory) => {
      setCategoryDraft({ name: '', description: '' });
      setSelectedCategoryId(savedCategory.id);
      setDraft((currentDraft) => ({ ...currentDraft, category: savedCategory.id }));
      setActiveModal(null);
    });
  };

  const isPresetImported = (presetCase: AppCase) =>
    cases.some(
      (currentCase) =>
        currentCase.sourcePresetCode === presetCase.code ||
        currentCase.code === presetCase.code ||
        currentCase.code.endsWith(`_${presetCase.code}`),
    );

  const importPresetSelection = (presetCaseCodes: string[]) => {
    if (presetCaseCodes.length === 0) return;
    void importPresetCasesToApp(presetCaseCodes).then(() => setActiveModal(null));
  };

  const unimportedPresetCodes = visiblePresetCases.filter((presetCase) => !isPresetImported(presetCase)).map((presetCase) => presetCase.code);
  const allUnimportedPresetCodes = presetCases.filter((presetCase) => !isPresetImported(presetCase)).map((presetCase) => presetCase.code);

  return (
    <section className="app-detail-section preset-admin-panel app-case-panel">
      <div className="preset-case-browser app-case-browser">
        <aside className="preset-category-rail" aria-label="应用测试用例分类">
          <div className="preset-category-rail-header">
            <strong>测试用例分类</strong>
            <span>{cases.length} 条用例</span>
          </div>
          <div className="preset-category-list">
            <button
              aria-pressed={selectedCategoryId === 'ALL'}
              className={selectedCategoryId === 'ALL' ? 'is-active' : ''}
              type="button"
              onClick={() => setSelectedCategoryId('ALL')}
            >
              <span>
                <strong>全部用例</strong>
                <small>查看当前应用所有用例</small>
              </span>
              <em>{cases.length}</em>
            </button>
            {categoryOptions.map((category) => (
              <button
                aria-pressed={selectedCategoryId === category.id}
                className={selectedCategoryId === category.id ? 'is-active' : ''}
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
              >
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.scope === 'APP' ? '应用自建分类' : category.description}</small>
                </span>
                <em>{categoryCounts.get(category.id) ?? 0}</em>
              </button>
            ))}
          </div>
        </aside>

        <div className="preset-case-content">
          <div className="preset-admin-toolbar preset-case-toolbar app-case-toolbar">
            <div className="preset-case-heading">
              <strong>{selectedCategory?.name ?? '全部用例'}</strong>
              <span>
                共 {categoryCases.length} 条
                {selectedCategory ? ` · ${selectedCategory.description}` : '，可引用系统预置，也可维护应用自建用例'}
              </span>
            </div>
            <TextInput
              aria-label="搜索应用测试用例"
              className="console-search"
              placeholder="搜索用例名称、分类、风险或期望行为"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="app-case-toolbar-actions">
              <button className="console-button" type="button" onClick={() => setActiveModal('preset')}>
                引用预置用例
              </button>
              <button className="console-button" type="button" onClick={() => setActiveModal('category')}>
                新增分类
              </button>
              <button
                className="console-button console-button-primary"
                type="button"
                onClick={() => {
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    category: selectedCategoryId === 'ALL' ? currentDraft.category || categoryOptions[0]?.id || '' : selectedCategoryId,
                  }));
                  setActiveModal('case');
                }}
              >
                新增用例
              </button>
            </div>
          </div>

          <div className="console-table-wrap preset-admin-table-wrap">
            <table className={`console-table preset-admin-table app-case-table ${selectedCategoryId === 'ALL' ? 'is-all-categories' : 'is-category-scoped'}`}>
              <thead>
                <tr>
                  <th>用例名称</th>
                  {selectedCategoryId === 'ALL' ? <th>分类</th> : null}
                  <th>风险</th>
                  <th>期望行为</th>
                  <th>来源</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((testCase) => (
                  <tr key={testCase.id}>
                    <td>
                      <strong>{testCase.name}</strong>
                      <small>{testCase.input}</small>
                    </td>
                    {selectedCategoryId === 'ALL' ? <td>{categoryNameById.get(testCase.category) ?? testCase.category}</td> : null}
                    <td>
                      <span className={`app-case-risk is-${testCase.risk.toLowerCase()}`}>{testCase.risk}</span>
                    </td>
                    <td>{testCase.expected}</td>
                    <td>{testCase.source}</td>
                    <td>
                      <span className={`console-status-pill console-status-${testCase.status}`}>{testCase.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCases.length === 0 ? <div className="preset-case-empty">当前分类下暂无测试用例。</div> : null}
          </div>
        </div>
      </div>

      <DialogRoot open={activeModal === 'preset'} onOpenChange={(open) => !open && setActiveModal(null)}>
        {activeModal === 'preset' ? (
          <DialogContent className="app-case-import-modal" description="从系统预置库引用到当前应用。" title="引用预置用例">
          <section aria-label="引用系统预置用例">
            <div className="app-case-import-layout">
              <aside className="preset-category-list app-case-import-categories" aria-label="系统预置分类">
                <button
                  aria-pressed={presetCategoryId === 'ALL'}
                  className={presetCategoryId === 'ALL' ? 'is-active' : ''}
                  type="button"
                  onClick={() => setPresetCategoryId('ALL')}
                >
                  <span>
                    <strong>全部预置</strong>
                    <small>所有系统预置用例</small>
                  </span>
                  <em>{presetCases.length}</em>
                </button>
                {categoryOptions.map((category) => (
                  <button
                    aria-pressed={presetCategoryId === category.id}
                    className={presetCategoryId === category.id ? 'is-active' : ''}
                    key={category.id}
                    type="button"
                    onClick={() => setPresetCategoryId(category.id)}
                  >
                    <span>
                      <strong>{category.name}</strong>
                      <small>{category.description}</small>
                    </span>
                    <em>{presetCounts.get(category.id) ?? 0}</em>
                  </button>
                ))}
              </aside>
              <div className="app-case-import-content">
                <div className="app-case-import-actions">
                  <button className="console-button" type="button" disabled={unimportedPresetCodes.length === 0} onClick={() => importPresetSelection(unimportedPresetCodes)}>
                    引用当前分类
                  </button>
                  <button className="console-button console-button-primary" type="button" disabled={allUnimportedPresetCodes.length === 0} onClick={() => importPresetSelection(allUnimportedPresetCodes)}>
                    引用全部未引用
                  </button>
                </div>
                <div className="console-table-wrap preset-admin-table-wrap">
                  <table className="console-table preset-admin-table app-case-table">
                    <thead>
                      <tr>
                        <th>用例名称</th>
                        <th>分类</th>
                        <th>风险</th>
                        <th>期望行为</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePresetCases.map((presetCase) => {
                        const imported = isPresetImported(presetCase);
                        return (
                          <tr key={presetCase.id}>
                            <td>
                              <strong>{presetCase.name}</strong>
                              <small>{presetCase.input}</small>
                            </td>
                            <td>{categoryNameById.get(presetCase.category) ?? presetCase.category}</td>
                            <td>{presetCase.risk}</td>
                            <td>{presetCase.expected}</td>
                            <td>
                              <button className="console-button" disabled={imported} type="button" onClick={() => importPresetSelection([presetCase.code])}>
                                {imported ? '已引用' : '引用'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visiblePresetCases.length === 0 ? <div className="preset-case-empty">当前分类下暂无系统预置用例。</div> : null}
                </div>
              </div>
            </div>
          </section>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={activeModal === 'category'} onOpenChange={(open) => !open && setActiveModal(null)}>
        {activeModal === 'category' ? (
          <DialogContent className="preset-admin-modal preset-admin-category-modal" description="定义当前应用自己的测试分类。" title="新增分类">
          <form className="console-dialog-form" aria-label="新增应用分类表单" onSubmit={submitCategory}>
            <TextInput className="console-form-field" label="分类名称" required value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} />
            <TextArea className="console-form-field" label="分类说明" required value={categoryDraft.description} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} />
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={() => setActiveModal(null)}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit">
                保存分类
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={activeModal === 'case'} onOpenChange={(open) => !open && setActiveModal(null)}>
        {activeModal === 'case' ? (
          <DialogContent className="preset-admin-modal" description="补充当前应用自己的测试用例。" title="新增用例">
          <form className="console-dialog-form" aria-label="新增应用用例表单" onSubmit={submitCase}>
            <div className="console-form-grid">
              <TextInput className="console-form-field" label="用例名称" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <label className="console-form-field">
                <span>分类</span>
                <ConsoleSelect
                  value={draft.category}
                  onValueChange={(value) => setDraft({ ...draft, category: value })}
                  placeholder="请选择分类"
                  options={categoryOptions.map((category) => ({ label: category.name, value: category.id }))}
                />
              </label>
              <label className="console-form-field">
                <span>风险</span>
                <ConsoleSelect
                  value={draft.risk}
                  onValueChange={(value) => setDraft({ ...draft, risk: value })}
                  options={['LOW', 'MEDIUM', 'HIGH'].map((risk) => ({ label: risk, value: risk }))}
                />
              </label>
              <TextArea className="console-form-field is-wide" label="测试输入" required value={draft.input} onChange={(event) => setDraft({ ...draft, input: event.target.value })} />
              <TextArea className="console-form-field is-wide" label="期望行为" required value={draft.expected} onChange={(event) => setDraft({ ...draft, expected: event.target.value })} />
            </div>
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={() => setActiveModal(null)}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit" disabled={!draft.category}>
                保存用例
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>
    </section>
  );
}

function PlanWorkspace({
  cases,
  plans,
  createPlan,
  executePlan,
}: {
  cases: AppCase[];
  plans: TestPlan[];
  createPlan: (plan: TestPlan) => Promise<void>;
  executePlan: (plan: TestPlan) => Promise<void>;
}) {
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>(() => cases.slice(0, 2).map((item) => item.id));
  const [planName, setPlanName] = useState('应用回归检查');
  const [planType, setPlanType] = useState('SMOKE');

  const toggleCase = (caseId: string) => {
    setSelectedCaseIds((currentIds) => (currentIds.includes(caseId) ? currentIds.filter((id) => id !== caseId) : [...currentIds, caseId]));
  };

  const submitPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedCases = cases.filter((item) => selectedCaseIds.includes(item.id));
    const plan: TestPlan = {
      id: `plan-${Date.now()}`,
      code: `PLAN_${Date.now()}`,
      name: planName,
      type: planType,
      scope: `${selectedCaseIds.length} 条测试用例`,
      caseIds: selectedCaseIds,
      caseCodes: selectedCases.map((item) => item.code),
      lastRun: '待执行',
      status: '启用',
    };
    void createPlan(plan);
  };

  return (
    <div className="app-detail-grid">
      <section className="app-detail-section">
        <div className="app-section-heading">
          <div>
            <h2>创建测试计划</h2>
            <p>计划明确用例范围后，可以从计划列表直接触发执行。</p>
          </div>
        </div>
        <form className="plan-create-form" onSubmit={submitPlan}>
          <TextInput className="console-form-field" label="计划名称" required value={planName} onChange={(event) => setPlanName(event.target.value)} />
          <label className="console-form-field">
            <span>计划类型</span>
            <ConsoleSelect
              value={planType}
              onValueChange={setPlanType}
              options={['SMOKE', 'FULL_REGRESSION', 'HIGH_RISK', 'CUSTOM'].map((type) => ({ label: type, value: type }))}
            />
          </label>
          <div className="case-picker">
            {cases.map((item) => (
              <label key={item.id}>
                <input checked={selectedCaseIds.includes(item.id)} type="checkbox" onChange={() => toggleCase(item.id)} />
                <span>{item.code}</span>
                <strong>{item.name}</strong>
              </label>
            ))}
            {cases.length === 0 ? (
              <div className="preset-case-empty">
                <strong>暂无可加入计划的测试用例</strong>
                <span>请先在测试用例模块新增或引用预置用例。</span>
              </div>
            ) : null}
          </div>
          <button className="console-button console-button-primary" type="submit" disabled={selectedCaseIds.length === 0}>
            创建测试计划
          </button>
        </form>
      </section>

      <section className="related-table">
        <header>
          <h2>测试计划队列</h2>
          <p>新建计划会进入队列，点击执行后写入执行历史。</p>
        </header>
        <div className="operation-list">
          {plans.map((plan) => (
            <article className="operation-row" key={plan.id}>
              <div>
                <strong>{plan.name}</strong>
                <span>
                  {plan.code} · {plan.type} · {plan.scope} · 最近执行：{plan.lastRun}
                </span>
              </div>
              <button className="console-button" type="button" onClick={() => void executePlan(plan)}>
                触发执行
              </button>
            </article>
          ))}
          {plans.length === 0 ? (
            <div className="preset-case-empty">
              <strong>暂无测试计划</strong>
              <span>创建计划后会进入队列，并可直接触发执行。</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ExecutionWorkspace({
  executions,
  plans,
  generateReport,
}: {
  executions: ExecutionRun[];
  plans: TestPlan[];
  generateReport: (run: ExecutionRun) => Promise<void>;
}) {
  return (
    <section className="related-table">
      <header>
        <h2>执行历史</h2>
        <p>从测试计划触发的新批次会实时出现在这里，并可继续生成评估报告。</p>
      </header>
      <div className="execution-timeline">
        {executions.map((run) => {
          const plan = plans.find((item) => item.code === run.plan);
          return (
            <article className="execution-item" key={run.id}>
              <div>
                <span className={`console-status-pill console-status-${run.status}`}>{run.status}</span>
                <h3>{run.run}</h3>
                <p>
                  {plan?.name ?? run.plan} · {run.startedAt}
                </p>
              </div>
              <div className="execution-stats">
                <Metric label="用例数" value={run.total} />
                <Metric label="通过" value={run.pass} />
                <Metric label="复核" value={run.review} />
                <Metric label="均分" value={run.score} />
              </div>
              <button className="console-button" type="button" onClick={() => void generateReport(run)}>
                生成评估报告
              </button>
            </article>
          );
        })}
        {executions.length === 0 ? (
          <div className="preset-case-empty">
            <strong>暂无执行历史</strong>
            <span>从测试计划触发执行后，批次状态会展示在这里。</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReportWorkspace({
  executions,
  reports,
  generateReport,
}: {
  executions: ExecutionRun[];
  reports: AppReport[];
  generateReport: (run: ExecutionRun) => Promise<void>;
}) {
  const [selectedRunId, setSelectedRunId] = useState(executions[0]?.id ?? '');
  const selectedRun = executions.find((item) => item.id === selectedRunId) ?? executions[0];

  return (
    <div className="app-detail-grid">
      <section className="app-detail-section">
        <h2>生成评估报告</h2>
        <div className="report-generator">
          <label className="console-form-field">
            <span>执行批次</span>
            <ConsoleSelect
              value={selectedRun?.id ?? ''}
              onValueChange={setSelectedRunId}
              placeholder="请选择执行批次"
              options={executions.map((run) => ({ label: `${run.run} · ${run.plan}`, value: run.id }))}
            />
          </label>
          <button className="console-button console-button-primary" type="button" disabled={!selectedRun} onClick={() => selectedRun && void generateReport(selectedRun)}>
            生成评估报告
          </button>
          {!selectedRun ? (
            <div className="preset-case-empty">
              <strong>暂无可生成报告的执行批次</strong>
              <span>请先执行测试计划，再生成评估报告。</span>
            </div>
          ) : null}
        </div>
      </section>
      <section className="related-table">
        <header>
          <h2>评估报告列表</h2>
          <p>报告保留执行批次统计快照和复核提示。</p>
        </header>
        <div className="report-list">
          {reports.map((report) => (
            <article className="report-card" key={report.id}>
              <div>
                <span>{report.generatedAt}</span>
                <h3>{report.name}</h3>
                <p>{report.summary}</p>
              </div>
              <strong>{report.passRate}</strong>
            </article>
          ))}
          {reports.length === 0 ? (
            <div className="preset-case-empty">
              <strong>暂无评估报告</strong>
              <span>执行批次生成报告后会沉淀统计快照和复核提示。</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function TemplateEditor({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="protocol-code">
      <span>{title}</span>
      <TextArea aria-label={title} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: ManagementConsoleRecord[] }) {
  return (
    <div className="console-table-wrap">
      <table className="console-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{COLUMN_LABELS[column] ?? column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column}>
                  {column === 'status' ? (
                    <span className={`console-status-pill console-status-${row.status}`}>{row.status}</span>
                  ) : (
                    String(row[column] ?? '')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function normalizeCaseCategory(item: AppCaseCategoryView): AppCaseCategoryView {
  const appCode = typeof item.appCode === 'string' && item.appCode.trim() ? item.appCode : undefined;
  return {
    id: item.id,
    code: String(item.code ?? item.id),
    name: String(item.name ?? '未命名分类'),
    description: String(item.description ?? '未配置说明'),
    appCode,
    scope: appCode ? 'APP' : 'SYSTEM',
    status: String(item.status ?? '启用'),
  };
}

function normalizeCase(item: ManagementConsoleRecord): AppCase {
  const code = String(item.code ?? item.caseCode ?? item.id);
  const name = String(item.name ?? item.caseName ?? '未命名用例');
  const category = String(item.category ?? item.categoryCode ?? item.categoryId ?? 'GENERAL');
  return {
    id: String(item.id ?? code),
    code,
    name,
    category,
    risk: String(item.risk ?? item.riskLevel ?? 'MEDIUM'),
    expected: String(item.expected ?? item.expectedBehavior ?? '未配置'),
    source: String(item.source ?? '当前应用'),
    input: String(item.input ?? item.query ?? `请执行 ${name} 场景。`),
    sourcePresetCode: typeof item.sourcePresetCode === 'string' ? item.sourcePresetCode : undefined,
    status: item.enabled === false ? '停用' : String(item.status ?? '启用'),
  };
}

function normalizePlan(item: ManagementConsoleRecord, sourceCases: ManagementConsoleRecord[]): TestPlan {
  const caseFilter = item.caseFilter as { selectedCaseCodes?: unknown } | undefined;
  const selectedCaseCodes = Array.isArray(caseFilter?.selectedCaseCodes)
    ? caseFilter.selectedCaseCodes.filter((caseCode): caseCode is string => typeof caseCode === 'string')
    : [];
  const caseIds =
    selectedCaseCodes.length > 0
      ? sourceCases.filter((sourceCase) => selectedCaseCodes.includes(String(sourceCase.code ?? sourceCase.id))).map((sourceCase) => sourceCase.id)
      : sourceCases.map((sourceCase) => sourceCase.id);

  return {
    id: item.id,
    code: String(item.code ?? item.id),
    name: String(item.name ?? '未命名计划'),
    type: String(item.type ?? 'SMOKE'),
    scope: String(item.scope ?? '全部用例'),
    caseIds,
    caseCodes: selectedCaseCodes.length > 0 ? selectedCaseCodes : sourceCases.map((sourceCase) => String(sourceCase.code ?? sourceCase.id)),
    lastRun: String(item.lastRun ?? '待执行'),
    status: String(item.status ?? '启用'),
  };
}

function normalizeExecution(item: ManagementConsoleRecord): ExecutionRun {
  return {
    id: item.id,
    run: String(item.run ?? item.id),
    plan: String(item.plan ?? '未关联计划'),
    total: String(item.total ?? '0'),
    pass: String(item.pass ?? '0'),
    review: String(item.review ?? '0'),
    score: String(item.score ?? '0'),
    startedAt: String(item.startedAt ?? '历史批次'),
    status: String(item.status ?? '已完成'),
  };
}

function normalizeReport(item: ManagementConsoleRecord): AppReport {
  return {
    id: item.id,
    name: String(item.name ?? '未命名报告'),
    run: String(item.run ?? '未关联批次'),
    passRate: String(item.passRate ?? '0%'),
    generatedAt: String(item.generatedAt ?? '待生成'),
    summary: String(item.summary ?? '报告已生成，可查看批次统计快照。'),
    status: String(item.status ?? '已生成'),
  };
}

function formatDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function mapRunStatus(status: string) {
  if (status === 'RUNNING') return '运行中';
  if (status === 'CANCELLED') return '已取消';
  if (status === 'FAILED') return '失败';
  return '已完成';
}

function renderTemplate(template: string, selectedCase?: AppCase) {
  return template
    .replaceAll('{{case.input.query}}', selectedCase?.input ?? '')
    .replaceAll('{{case.expected}}', selectedCase?.expected ?? '')
    .replaceAll('{{case.code}}', selectedCase?.code ?? '');
}

function readJsonPath(source: unknown, path: string) {
  if (!path.startsWith('$.')) return '';
  return path
    .slice(2)
    .split('.')
    .reduce<unknown>((currentValue, key) => {
      if (currentValue && typeof currentValue === 'object' && key in currentValue) {
        return (currentValue as Record<string, unknown>)[key];
      }
      return '';
    }, source);
}

const COLUMN_LABELS: Record<string, string> = {
  code: '编号',
  name: '名称',
  category: '分类',
  risk: '风险',
  expected: '期望行为',
  source: '来源',
  type: '类型',
  scope: '范围',
  run: '批次',
  plan: '计划',
  total: '用例数',
  pass: '通过',
  review: '复核',
  score: '均分',
  passRate: '通过率',
  generatedAt: '生成时间',
  status: '状态',
};
