/**
 * AI 应用模块类型定义
 * @author codex
 */

export type AppType = 'CHAT';
export type AppStatus = 'ENABLED' | 'DISABLED';

/* ── 应用图标配置 ── */
export interface AppIconConfig {
  iconKey: string;
  themeKey: string;
  variantKey: string;
}

/* ── 接口协议配置 ── */
export interface AppProtocol {
  method: 'GET' | 'POST';
  url: string;
  /** JSON 模板，支持 {{variable}} 变量语法 */
  headers: string;
  /** JSON 模板，{{case.input.query}} 会被用例输入替换 */
  body: string;
  /** JSONPath 提取答案文本，如 $.content */
  answerPath: string;
  /** 接口成功条件，如 $.code == 0 */
  successExpr: string;
  streamEnabled: boolean;
  /** 执行计划批量调用被测应用接口的并发数 */
  appConcurrency: number;
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
  /** 统计信息（列表页展示用） */
  stats?: {
    caseCount: number;
    planCount: number;
    lastRunAt?: string;
    lastPassRate?: number;
  };
  icon: AppIconConfig;
  createdAt?: string;
  updatedAt?: string;
}
