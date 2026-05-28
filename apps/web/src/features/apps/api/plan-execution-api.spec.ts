/**
 * 执行 API 映射测试
 * @author codex
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import {
  getRunStatus,
  listPlans,
  listResults,
  listRuns,
  listRunVersions,
  reEvaluateResults,
  submitResultReview,
} from './plan-execution-api';

vi.mock('@/lib/api/gateway-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/gateway-client')>();
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

const postGatewayMock = vi.mocked(postGateway);

describe('plan execution api mapping', () => {
  beforeEach(() => {
    postGatewayMock.mockReset();
  });

  it('submits only real manual review fields without a fake reviewer', async () => {
    postGatewayMock.mockResolvedValue({
      resultId: '100',
      reviewStatus: 'REVIEWED',
      manualResult: 'PASS',
    });

    await submitResultReview({
      resultId: '100',
      manualResult: 'PASS',
      problemType: '接口调用失败',
    } as never);

    expect(postGatewayMock).toHaveBeenCalledWith('review', '/review/submit.do', {
      resultId: '100',
      manualResult: 'PASS',
    });
  });

  it('rejects malformed plan list payloads instead of returning an empty list', async () => {
    postGatewayMock.mockResolvedValue({});

    await expect(listPlans('app-1')).rejects.toThrow('网关列表响应缺少 list 数组');
  });

  it('rejects malformed run list payloads instead of returning an empty list', async () => {
    postGatewayMock.mockResolvedValue({});

    await expect(listRuns('app-1')).rejects.toThrow('网关列表响应缺少 list 数组');
  });

  it('propagates run detail loading failures instead of returning null status', async () => {
    postGatewayMock.mockRejectedValue(new Error('执行服务不可用'));

    await expect(getRunStatus('run-1')).rejects.toThrow('执行服务不可用');
  });

  it('rejects malformed run version payloads instead of returning an empty list', async () => {
    postGatewayMock.mockResolvedValue({ list: [] });

    await expect(listRunVersions('run-1')).rejects.toThrow('执行版本响应必须是数组');
  });

  it('rejects malformed result list payloads instead of returning an empty list', async () => {
    postGatewayMock.mockResolvedValue({});

    await expect(listResults('run-1')).rejects.toThrow('网关列表响应缺少 list 数组');
  });

  it('rejects malformed re-evaluate payloads instead of returning an empty list', async () => {
    postGatewayMock.mockResolvedValue({ list: [] });

    await expect(reEvaluateResults(['result-1'])).rejects.toThrow('重新评估响应必须是数组');
  });
});
