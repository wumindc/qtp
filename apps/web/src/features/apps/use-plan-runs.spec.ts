/**
 * 执行计划 Hook 数据辅助函数测试
 * @author codex
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import { loadPlanCategories } from './use-plan-runs';

vi.mock('@/lib/api/gateway-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/gateway-client')>();
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

describe('loadPlanCategories', () => {
  beforeEach(() => {
    vi.mocked(postGateway).mockReset();
  });

  it('rejects malformed category list payloads instead of returning empty categories', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ list: [] });

    await expect(loadPlanCategories('app-1')).rejects.toThrow('网关列表响应缺少 list 数组');
  });
});
