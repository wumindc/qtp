/**
 * AI 应用模块类型定义
 * @author Antigravity/Gemini-2.5-Pro
 */

/* ── 应用类型 ── */
export type AppType = 'CHAT' | 'WORKFLOW';
export type AppStatus = 'ENABLED' | 'DISABLED';

/* ── 接口协议配置 ── */
export interface AppProtocol {
  method: 'GET' | 'POST';
  url: string;
  /** JSON 模板，支持 {{variable}} 变量语法 */
  headers: string;
  /** JSON 模板，{{case.query}} 会被用例输入替换 */
  body: string;
  /** JSONPath 提取答案文本，如 $.data.content */
  answerPath: string;
  /** 接口成功条件，如 $.code == 0 */
  successExpr: string;
  streamEnabled: boolean;
}

/* ── AI 应用 ── */
export interface App {
  appCode: string;
  appName: string;
  appType: AppType;
  description?: string;
  owner: string;
  status: AppStatus;
  protocol: AppProtocol;
  /** 默认评估模型 ID（来自模型中心），用于 LLM_JUDGE / SEMANTIC 策略 */
  defaultEvalModelId?: string;
  defaultEvalModelName?: string;
  /** 统计信息（列表页展示用） */
  stats?: {
    caseCount: number;
    planCount: number;
    lastRunAt?: string;
    lastPassRate?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

/* ── 评估策略类型 ── */
export type AssertionType = 'LLM_JUDGE' | 'SEMANTIC' | 'JSONPATH' | 'LATENCY' | 'KEYWORD' | 'REGEX';

/* ── 评估策略 ── */
export interface Assertion {
  id: string;
  type: AssertionType;
  /** 策略参数：评判标准提示词 / 期望答案 / JSONPath / 毫秒上限 / 关键词 / 正则 */
  value: string;
  /**
   * LLM_JUDGE: 通过最低分（0-10）
   * SEMANTIC:  余弦相似度阈值（0-1）
   * LATENCY:   毫秒上限
   */
  threshold?: number;
  /** 不满足时是 FAIL 还是仅 WARNING */
  required: boolean;
  /**
   * SEMANTIC/LLM_JUDGE 专用：指定评估模型 ID
   * 继承链：Assertion.evalModelId → RunPlan.evalModelId → App.defaultEvalModelId
   */
  evalModelId?: string;
  evalModelName?: string;
}

/* ── 应用用例 ── */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AppCase {
  caseCode: string;
  appCode: string;
  caseName: string;
  categoryId?: string;
  categoryName?: string;
  risk: RiskLevel;
  query: string;
  /** 额外变量，填入 body 模板中 */
  variables?: Record<string, string>;
  /** 引用的系统预置用例 code */
  sourcePresetCode?: string;
  assertions: Assertion[];
  status: 'ENABLED' | 'DISABLED';
  createdAt?: string;
}

/* ── 执行计划 ── */
export interface RunPlan {
  planCode: string;
  appCode: string;
  planName: string;
  description?: string;
  caseFilter: {
    type: 'ALL' | 'BY_CATEGORY' | 'BY_RISK' | 'MANUAL';
    categories?: string[];
    risks?: RiskLevel[];
    caseCodes?: string[];
  };
  concurrency: number;
  cronExpr?: string;
  /** 计划级评估模型（覆盖 App.defaultEvalModelId） */
  evalModelId?: string;
  evalModelName?: string;
  status: 'ENABLED' | 'DISABLED';
  createdAt?: string;
}

/* ── 执行记录 ── */
export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type Verdict = 'PASS' | 'FAIL' | 'SKIP' | 'REVIEW';

export interface RunStats {
  total: number;
  pass: number;
  fail: number;
  skip: number;
  review: number;
  passRate: number;
  avgLatencyMs: number;
  avgScore?: number;
}

export interface AssertionResult {
  type: AssertionType;
  passed: boolean;
  detail: string;
  /** LLM_JUDGE 评分（0-10） */
  score?: number;
  /** LLM_JUDGE 评判理由 */
  reason?: string;
}

export interface CaseResult {
  caseCode: string;
  caseName: string;
  query: string;
  httpStatus?: number;
  latencyMs?: number;
  rawResponse?: string;
  answer?: string;
  assertionResults: AssertionResult[];
  verdict: Verdict;
  /** 人工覆盖裁判结果 */
  humanVerdict?: 'PASS' | 'FAIL';
  error?: string;
}

export interface ExecutionRun {
  runCode: string;
  planCode: string;
  planName?: string;
  appCode: string;
  startAt: string;
  endAt?: string;
  status: RunStatus;
  /** 本次执行实际使用的评估模型（快照） */
  evalModelId?: string;
  evalModelName?: string;
  stats: RunStats;
  results?: CaseResult[];
}
