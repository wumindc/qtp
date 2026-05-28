import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DashboardPage } from './dashboard';
import { loadApps } from '../apps/api/app-api';
import { listPlans, listRuns } from '../apps/api/plan-execution-api';


vi.mock('../apps/api/app-api', () => ({
  loadApps: vi.fn(),
}));

vi.mock('../apps/api/plan-execution-api', async () => {
  const actual = await vi.importActual<typeof import('../apps/api/plan-execution-api')>('../apps/api/plan-execution-api');
  return {
    ...actual,
    listPlans: vi.fn(),
    listRuns: vi.fn(),
    formatDuration: vi.fn((ms: number) => `${Math.round(ms / 1000)}秒`),
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    // postGateway 期望响应为 { success: true, data: { ... } } envelope
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          appCount: 2,
          caseCount: 146,
          planCount: 4,
          avgPassRate: 26,
          pendingReviewCount: 0,
          failedRunCount: 25,
        },
      }),
    }));
    vi.mocked(loadApps).mockResolvedValue([
      {
        appCode: 'app-mpmk39ii',
        appName: '网站对话助手',
        appType: 'CHAT',
        description: '信用网站问答验证',
        owner: '吴敏',
        status: 'ENABLED',
        icon: { iconKey: 'brain', themeKey: 'emerald', variantKey: 'ring' },
        protocol: {
          method: 'POST',
          url: 'http://example.com/chat.do',
          headers: '{}',
          body: '{}',
          answerPath: '$.content',
          successExpr: '$.code == 0',
          streamEnabled: false,
          appConcurrency: 3,
        },
        stats: {
          caseCount: 143,
          planCount: 1,
          lastPassRate: 20,
          lastRunAt: '2026-05-27T02:38:40.978Z',
        },
      },
    ]);
    vi.mocked(listPlans).mockResolvedValue([
      {
        planCode: 'plan-app-mpmk39ii-1779796368543',
        planName: '全量测试',
        appCode: 'app-mpmk39ii',
        caseFilter: {},
        status: 'ENABLED',
      },
    ]);
    vi.mocked(listRuns).mockResolvedValue([
      {
        runCode: 'run-l3f69esbov',
        planCode: 'plan-app-mpmk39ii-1779796368543',
        appCode: 'app-mpmk39ii',
        status: 'COMPLETED',
        sequenceNo: 10,
        totalCount: 143,
        passCount: 29,
        failCount: 114,
        reviewCount: 0,
        avgScore: 20,
        startAt: '2026-05-27T02:38:40.978Z',
        durationMs: 139831,
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a real platform workbench with readable app and run context', async () => {
    render(<DashboardPage />);

    expect((await screen.findAllByText('AI 应用')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('146').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('26%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未达标批次').length).toBeGreaterThan(0);
    expect(screen.queryByText('风险执行')).not.toBeInTheDocument();
    expect(screen.getAllByText('网站对话助手').length).toBeGreaterThan(0);
    expect(screen.getByText('全量测试')).toBeInTheDocument();
    expect(screen.getByText('第 10 次执行')).toBeInTheDocument();
    expect(screen.getByText('29 / 143 通过')).toBeInTheDocument();
    expect(screen.getByText('114 未达标')).toBeInTheDocument();
    expect(screen.queryByText('plan-app-mpmk39ii-1779796368543')).not.toBeInTheDocument();
  });

  it('does not turn recent run loading failures into an empty workbench', async () => {
    vi.mocked(listRuns).mockRejectedValue(new Error('execution service down'));

    render(<DashboardPage />);

    expect(await screen.findByText('工作台加载失败')).toBeInTheDocument();
    expect(screen.getByText('execution service down')).toBeInTheDocument();
    expect(screen.queryByText('暂无执行记录')).not.toBeInTheDocument();
  });

  it('does not turn malformed dashboard metrics into zero counters', async () => {
    // 缺少 appCount——应该进入加载失败态
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          caseCount: 146,
          planCount: 4,
          avgPassRate: 26,
          pendingReviewCount: 0,
          failedRunCount: 25,
        },
      }),
    }));

    render(<DashboardPage />);

    expect(await screen.findByText('工作台加载失败')).toBeInTheDocument();
    expect(screen.getByText('工作台统计缺少应用数量')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('does not keep local zero fallbacks for dashboard statistics source fields', () => {
    const source = readFileSync(join(process.cwd(), 'src/features/dashboard/dashboard.tsx'), 'utf8');

    expect(source).not.toContain('Number(value ?? 0)');
    expect(source).not.toContain('app.stats?.caseCount ?? 0');
    expect(source).not.toContain('app.stats?.planCount ?? 0');
  });
});
