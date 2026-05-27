/**
 * 应用概览页测试
 * @author codex
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppOverviewPage } from './app-overview';
import { loadApp } from './api/app-api';
import { listPlans, listRuns } from './api/plan-execution-api';

vi.mock('./api/app-api', () => ({
  loadApp: vi.fn(),
}));

vi.mock('./api/plan-execution-api', async () => {
  const actual = await vi.importActual<typeof import('./api/plan-execution-api')>('./api/plan-execution-api');
  return {
    ...actual,
    listPlans: vi.fn(),
    listRuns: vi.fn(),
    formatDuration: vi.fn((ms: number) => `${Math.round(ms / 1000)}秒`),
  };
});

describe('AppOverviewPage', () => {
  beforeEach(() => {
    vi.mocked(loadApp).mockReset();
    vi.mocked(listPlans).mockReset();
    vi.mocked(listRuns).mockReset();
  });

  it('shows detail stats and readable recent run context', async () => {
    vi.mocked(loadApp).mockResolvedValue({
      appCode: 'app-mpmk39ii',
      appName: '网站对话助手',
      appType: 'CHAT',
      description: '信用网站问答验证',
      owner: '吴敏',
      status: 'ENABLED',
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
    });
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

    render(<AppOverviewPage appCode="app-mpmk39ii" />);

    expect(await screen.findByText('143')).toBeInTheDocument();
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0);
    expect(screen.getByText('全量测试')).toBeInTheDocument();
    expect(screen.getByText('第 10 次执行')).toBeInTheDocument();
    expect(screen.getByText('29 / 143 通过')).toBeInTheDocument();
    expect(screen.getByText('114 未达标')).toBeInTheDocument();
    expect(screen.queryByText('plan-app-mpmk39ii-1779796368543')).not.toBeInTheDocument();
  });
});
