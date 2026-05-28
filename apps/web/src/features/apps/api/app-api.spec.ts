/**
 * AI 应用 API 映射测试
 * @author codex
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { postGateway } from '@/lib/api/gateway-client';
import { loadAppProtocol, loadApps, saveApp, testAppProtocol } from './app-api';

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
          status: 'ENABLED',
          invokeUrl: 'http://example.com/chat.do',
          requestMethod: 'POST',
          icon: {
            iconKey: 'brain',
            themeKey: 'emerald',
            variantKey: 'ring',
          },
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          streamEnabled: false,
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 6,
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
        appConcurrency: 6,
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

  it('keeps missing app owners empty instead of inventing a system owner', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 'ownerless',
          appName: '无负责人应用',
          appType: 'CHAT',
          status: 'ENABLED',
          invokeUrl: '',
          requestMethod: 'POST',
          icon: {
            iconKey: 'brain',
            themeKey: 'emerald',
            variantKey: 'ring',
          },
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          streamEnabled: false,
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
          stats: {
            caseCount: 0,
            planCount: 0,
          },
        },
      ],
    });

    const apps = await loadApps();

    expect(apps[0].owner).toBe('');
  });

  it('rejects missing icon config instead of synthesizing a stable frontend icon', async () => {
    const iconConfigSource = readFileSync(join(process.cwd(), 'src/features/apps/app-icon-config.ts'), 'utf8');
    expect(iconConfigSource).not.toContain('hashSeed');
    expect(iconConfigSource).not.toContain('selectByIndex(hashSeed');

    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 'missing-icon',
          appName: '缺图标应用',
          appType: 'CHAT',
          status: 'ENABLED',
          invokeUrl: 'http://example.com/chat.do',
          requestMethod: 'POST',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          streamEnabled: false,
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
          stats: {
            caseCount: 0,
            planCount: 0,
          },
        },
      ],
    });

    await expect(loadApps()).rejects.toThrow('应用列表响应缺少图标配置');
  });

  it('rejects app rows with invalid enum values instead of defaulting them', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 'bad-app',
          appName: '坏应用',
          appType: 'WORKFLOW',
          status: 'UNKNOWN',
          requestMethod: 'TRACE',
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
          stats: {
            caseCount: 0,
            planCount: 0,
          },
        },
      ],
    });

    await expect(loadApps()).rejects.toThrow('应用列表响应包含不支持的应用类型：WORKFLOW');
  });

  it('rejects app rows missing required fields instead of creating blank app records', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appType: 'CHAT',
          status: 'ENABLED',
          requestMethod: 'POST',
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
          stats: {
            caseCount: 0,
            planCount: 0,
          },
        },
      ],
    });

    await expect(loadApps()).rejects.toThrow('应用列表响应缺少应用编码');
  });

  it('rejects non-string app fields instead of stringifying them', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 123,
          appName: '数字编码应用',
          appType: 'CHAT',
          status: 'ENABLED',
          invokeUrl: '',
          requestMethod: 'POST',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          streamEnabled: false,
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
          stats: {
            caseCount: 0,
            planCount: 0,
          },
        },
      ],
    });

    await expect(loadApps()).rejects.toThrow('应用列表响应缺少应用编码');
  });

  it('rejects non-string optional timestamps instead of stringifying them', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 'bad-time',
          appName: '坏时间应用',
          appType: 'CHAT',
          status: 'ENABLED',
          invokeUrl: '',
          requestMethod: 'POST',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          streamEnabled: false,
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
          stats: {
            caseCount: 0,
            planCount: 0,
            lastRunAt: 1779900000000,
          },
        },
      ],
    });

    await expect(loadApps()).rejects.toThrow('应用列表响应最近执行时间必须是字符串');
  });

  it('rejects app rows missing aggregate stats instead of rendering zero metrics', async () => {
    postGatewayMock.mockResolvedValue({
      list: [
        {
          appCode: 'nostats',
          appName: '缺少统计应用',
          appType: 'CHAT',
          status: 'ENABLED',
          invokeUrl: '',
          requestMethod: 'POST',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          streamEnabled: false,
          adapterConfig: {
            response: {
              answerPath: '$.content',
              successExpression: '$.code == 0',
            },
            execution: {
              appConcurrency: 3,
            },
          },
        },
      ],
    });

    await expect(loadApps()).rejects.toThrow('应用列表响应缺少统计信息');
  });

  it('saves blank owners as blank values instead of system defaults', async () => {
    postGatewayMock.mockResolvedValue({});

    await saveApp({
      appName: '无负责人应用',
      appType: 'CHAT',
      owner: '',
      status: 'ENABLED',
    });

    expect(postGatewayMock).toHaveBeenCalledWith('business', '/app/create.do', {
      appName: '无负责人应用',
      appType: 'CHAT',
      description: undefined,
      owner: '',
      status: 'ENABLED',
    });
  });

  it('sends protocol tests through the backend gateway instead of a browser proxy', async () => {
    postGatewayMock.mockResolvedValue({
      success: true,
      rawResponseText: '{"content":"ok"}',
      parsedAnswer: 'ok',
      elapsedMs: 9,
    });

    await testAppProtocol(
      'app-1',
      {
        method: 'POST',
        url: 'http://internal-app/chat.do',
        headers: '{"Content-Type":"application/json"}',
        body: '{"query":"{{case.input.query}}"}',
        answerPath: '$.content',
        successExpr: '$.code == 0',
        streamEnabled: false,
        appConcurrency: 3,
      },
      '信用修复',
    );

    expect(postGatewayMock).toHaveBeenCalledWith(
      'business',
      '/app/protocol/test.do',
      {
        appCode: 'app-1',
        data: {
          requestMethod: 'POST',
          invokeUrl: 'http://internal-app/chat.do',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          answerPath: '$.content',
          successExpression: '$.code == 0',
          streamEnabled: false,
          appConcurrency: 3,
        },
        sampleInput: { query: '信用修复' },
      },
      { cache: 'no-store' },
    );
  });

  it('rejects malformed protocol detail instead of applying local defaults', async () => {
    postGatewayMock.mockResolvedValue({
      appCode: 'app-1',
      requestMethod: 'TRACE',
      invokeUrl: 'http://example.com/chat.do',
      headerTemplate: '{"Content-Type":"application/json"}',
      bodyTemplate: '{"query":"{{case.input.query}}"}',
      answerPath: '$.content',
      successExpression: '$.code == 0',
      streamEnabled: false,
      appConcurrency: 3,
    });

    await expect(loadAppProtocol('app-1')).rejects.toThrow('应用协议响应包含不支持的请求方法：TRACE');
  });
});
