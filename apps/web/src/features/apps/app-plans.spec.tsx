/**
 * 应用执行计划页测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppPlansPage } from './app-plans';
import { postGateway } from '@/lib/api/gateway-client';
import { listPlans, createPlan, deletePlan, startPlan, listRuns, updatePlan } from './api/plan-execution-api';
import { toast } from 'sonner';

const navigationMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navigationMock.push,
  }),
}));

vi.mock('@/lib/api/gateway-client', () => ({
  postGateway: vi.fn(),
}));

vi.mock('./api/plan-execution-api', () => ({
  listPlans: vi.fn(),
  listRuns: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  startPlan: vi.fn(),
  parseRunStartTime: vi.fn((runCode: string) => {
    const ts = Number(runCode.split('_RUN_')[1] ?? 0);
    return Number.isFinite(ts) && ts > 0 ? new Date(ts) : null;
  }),
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const listPlansMock = vi.mocked(listPlans);
const listRunsMock = vi.mocked(listRuns);
const postGatewayMock = vi.mocked(postGateway);
const toastErrorMock = vi.mocked(toast.error);
const toastSuccessMock = vi.mocked(toast.success);
const startPlanMock = vi.mocked(startPlan);
const updatePlanMock = vi.mocked(updatePlan);

describe('AppPlansPage', () => {
  beforeEach(() => {
    listPlansMock.mockReset();
    listRunsMock.mockReset();
    vi.mocked(createPlan).mockReset();
    updatePlanMock.mockReset();
    vi.mocked(deletePlan).mockReset();
    vi.mocked(startPlan).mockReset();
    postGatewayMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    navigationMock.push.mockReset();
  });

  it('keeps plan list visible when category loading fails', async () => {
    listPlansMock.mockResolvedValue([
      {
        planCode: 'plan-c-1',
        planName: 'JOB01',
        appCode: 'c',
        caseFilter: {},
        status: 'ENABLED',
      },
    ]);
    listRunsMock.mockResolvedValue([]);
    postGatewayMock.mockRejectedValue(new Error('case service down'));

    render(<AppPlansPage appCode="c" />);

    expect(await screen.findByText('JOB01')).toBeInTheDocument();
    expect(screen.getByText('共 1 个计划')).toBeInTheDocument();
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(screen.getByText('从未执行 · 点击「立即执行」触发首次测试')).toBeInTheDocument();
  });

  it('inserts the server running run immediately and shows real progress from completed case count', async () => {
    const completedRun = {
      runCode: 'plan-c-1_RUN_1779780000000',
      planCode: 'plan-c-1',
      appCode: 'c',
      status: 'COMPLETED' as const,
      totalCount: 3,
      passCount: 1,
      failCount: 2,
      reviewCount: 0,
      avgScore: 66,
      sequenceNo: 1,
      startAt: '2026-05-26T09:00:00.000Z',
      endAt: '2026-05-26T09:01:00.000Z',
      durationMs: 60000,
    };
    const runningRun = {
      runCode: 'plan-c-1_RUN_1779781000000',
      planCode: 'plan-c-1',
      appCode: 'c',
      status: 'RUNNING' as const,
      totalCount: 3,
      passCount: 0,
      failCount: 0,
      reviewCount: 0,
      avgScore: 0,
      sequenceNo: 2,
      startAt: '2026-05-26T09:02:00.000Z',
    };
    listPlansMock.mockResolvedValue([
      {
        planCode: 'plan-c-1',
        planName: 'JOB01',
        appCode: 'c',
        caseFilter: {},
        status: 'ENABLED',
      },
    ]);
    listRunsMock
      .mockResolvedValueOnce([completedRun])
      .mockResolvedValueOnce([completedRun])
      .mockResolvedValueOnce([runningRun, completedRun]);
    postGatewayMock.mockResolvedValue({ list: [] });
    startPlanMock.mockResolvedValue(runningRun);

    render(<AppPlansPage appCode="c" />);

    expect(await screen.findByText('第 1 次执行 · 点击查看详情')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.queryByText('plan-c-1')).not.toBeInTheDocument();
    expect(screen.queryByText('共执行 1 次')).not.toBeInTheDocument();
    expect(screen.queryByText('2✗')).not.toBeInTheDocument();
    expect(screen.getByText('2 未达标')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /立即执行/u }));
    fireEvent.click(await screen.findByRole('button', { name: '确认执行' }));

    await waitFor(() => expect(startPlanMock).toHaveBeenCalled());
    expect(await screen.findByText('接口执行中')).toBeInTheDocument();
    expect(screen.getAllByText('接口执行中')).toHaveLength(1);
    expect(await screen.findByText('0 / 3')).toBeInTheDocument();
    expect(await screen.findByText('第 2 次')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /执行中|立即执行/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除计划' })).not.toBeInTheDocument();
  });

  it('shows a single success toast when starting a running execution', async () => {
    listPlansMock.mockResolvedValue([
      {
        planCode: 'plan-c-1',
        planName: '全量测试',
        appCode: 'c',
        caseFilter: {},
        status: 'ENABLED',
      },
    ]);
    listRunsMock.mockResolvedValue([]);
    postGatewayMock.mockResolvedValue({ list: [] });
    startPlanMock.mockResolvedValue({
      runCode: 'run-started',
      planCode: 'plan-c-1',
      appCode: 'c',
      status: 'RUNNING',
      totalCount: 143,
      passCount: 0,
      failCount: 0,
      reviewCount: 0,
      avgScore: 0,
      sequenceNo: 10,
      startAt: '2026-05-27T02:38:40.000Z',
    });

    render(<AppPlansPage appCode="c" />);

    expect(await screen.findByText('全量测试')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /立即执行/u }));
    fireEvent.click(await screen.findByRole('button', { name: '确认执行' }));

    await waitFor(() => expect(startPlanMock).toHaveBeenCalledWith('plan-c-1', 'c'));
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith('执行批次已创建，共 143 条用例，正在执行...');
    });
  });

  it('creates a plan without exposing or submitting plan type', async () => {
    listPlansMock.mockResolvedValue([]);
    listRunsMock.mockResolvedValue([]);
    postGatewayMock.mockResolvedValue({ list: [] });
    vi.mocked(createPlan).mockResolvedValue({
      planCode: 'plan-c-created',
      planName: '每日回归',
      appCode: 'c',
      caseFilter: {},
      status: 'ENABLED',
    });

    render(<AppPlansPage appCode="c" />);

    fireEvent.click(await screen.findByRole('button', { name: '新建计划' }));

    expect(screen.queryByText('计划类型')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '每日回归' } });
    fireEvent.click(screen.getByRole('button', { name: '确认创建' }));

    await waitFor(() => {
      expect(createPlan).toHaveBeenCalledWith(expect.not.objectContaining({ planType: expect.anything() }));
      expect(createPlan).toHaveBeenCalledWith(expect.not.objectContaining({ planCode: expect.anything() }));
    });
  });

  it('only offers app-owned and subscribed categories when selecting categories manually', async () => {
    listPlansMock.mockResolvedValue([]);
    listRunsMock.mockResolvedValue([]);
    postGatewayMock.mockImplementation(async (_service, _path, body) => {
      const data = (body as { data?: Record<string, unknown> }).data ?? {};
      if (data.subscribedByApp === 'c') {
        return { list: [{ id: '1', name: '敏感问题' }] };
      }
      if (data.appCode === 'c' && data.includeGlobal === false) {
        return { list: [] };
      }
      return { list: [{ id: '1', name: '敏感问题' }, { id: '2', name: '22' }] };
    });

    render(<AppPlansPage appCode="c" />);

    fireEvent.click(await screen.findByRole('button', { name: '新建计划' }));
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('按分类执行'));

    expect(await screen.findByText('敏感问题')).toBeInTheDocument();
    expect(screen.queryByText('22')).not.toBeInTheDocument();
  });

  it('does not expose plan enable status and edits an existing plan', async () => {
    listPlansMock.mockResolvedValue([
      {
        planCode: 'plan-c-1',
        planName: '旧计划',
        appCode: 'c',
        caseFilter: {},
        status: 'DISABLED',
      },
    ]);
    listRunsMock.mockResolvedValue([]);
    postGatewayMock.mockResolvedValue({ list: [] });
    updatePlanMock.mockResolvedValue({
      planCode: 'plan-c-1',
      planName: '新计划',
      appCode: 'c',
      caseFilter: {},
      status: 'ENABLED',
    });

    render(<AppPlansPage appCode="c" />);

    expect(await screen.findByText('旧计划')).toBeInTheDocument();
    expect(screen.queryByText('启用')).not.toBeInTheDocument();
    expect(screen.queryByText('禁用')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即执行/u })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '编辑计划' }));
    expect(await screen.findByText('编辑执行计划')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '新计划' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        'plan-c-1',
        expect.objectContaining({
          planName: '新计划',
          caseFilter: expect.objectContaining({
            categoryCodes: [],
          }),
        }),
      );
    });
  });

  it('shows refresh feedback and reloads the plan list when clicking refresh', async () => {
    listPlansMock.mockResolvedValue([
      {
        planCode: 'plan-c-1',
        planName: 'JOB01',
        appCode: 'c',
        caseFilter: {},
        status: 'ENABLED',
      },
    ]);
    listRunsMock.mockResolvedValue([]);
    postGatewayMock.mockResolvedValue({ list: [] });

    render(<AppPlansPage appCode="c" />);

    expect(await screen.findByText('JOB01')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(listPlansMock).toHaveBeenCalledTimes(2);
      expect(listRunsMock).toHaveBeenCalledTimes(2);
      expect(toastSuccessMock).toHaveBeenCalledWith('已刷新');
    });
  });

  it('navigates to a stable run detail URL when selecting an execution record', async () => {
    listPlansMock.mockResolvedValue([
      {
        planCode: 'plan-c-1',
        planName: 'JOB01',
        appCode: 'c',
        caseFilter: {},
        status: 'ENABLED',
      },
    ]);
    listRunsMock.mockResolvedValue([
      {
        runCode: 'plan-c-1_RUN_1779780000000',
        planCode: 'plan-c-1',
        appCode: 'c',
        status: 'COMPLETED',
        totalCount: 3,
        passCount: 1,
        failCount: 2,
        reviewCount: 0,
        avgScore: 66,
        startAt: '2026-05-26T09:00:00.000Z',
      },
    ]);
    postGatewayMock.mockResolvedValue({ list: [] });

    render(<AppPlansPage appCode="c" />);

    fireEvent.click(await screen.findByRole('button', { name: /最近一次/u }));

    expect(navigationMock.push).toHaveBeenCalledWith(
      '/ai-quality-platform/apps/c/plans/runs/plan-c-1_RUN_1779780000000',
    );
  });
});
