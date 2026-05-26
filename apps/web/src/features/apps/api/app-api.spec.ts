/**
 * AI 应用 API 映射测试
 * @author codex
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import { loadApps } from './app-api';

vi.mock('@/lib/api/gateway-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/gateway-client')>();
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

const postGatewayMock = vi.mocked(postGateway);

describe('app api mapping', () => {
  beforeEach(() => {
    postGatewayMock.mockReset();
  });

  it('maps app list protocol and stats from backend top-level fields', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 'c',
          appName: '北京信用小京灵',
          appType: 'CHAT',
          invokeUrl: 'http://example.com/chat.do',
          requestMethod: 'POST',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          adapterConfig: {
            ui: {
              icon: {
                iconKey: 'brain',
                themeKey: 'emerald',
                variantKey: 'ring',
              },
            },
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
          },
          stats: {
            caseCount: 5,
            planCount: 3,
            lastRunAt: '2026-05-26T10:36:50.028Z',
            lastPassRate: 80,
          },
        },
      ],
    });

    const apps = await loadApps();

    expect(apps[0]).toMatchObject({
      appCode: 'c',
      protocol: {
        method: 'POST',
        url: 'http://example.com/chat.do',
        answerPath: '$.content',
        successExpr: '$.code == 0',
      },
      stats: {
        caseCount: 5,
        planCount: 3,
        lastRunAt: '2026-05-26T10:36:50.028Z',
        lastPassRate: 80,
      },
      icon: {
        iconKey: 'brain',
        themeKey: 'emerald',
        variantKey: 'ring',
      },
    });
  });
});
