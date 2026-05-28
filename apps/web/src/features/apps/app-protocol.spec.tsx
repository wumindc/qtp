/**
 * 应用接口配置页测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProtocolPage } from './app-protocol';
import { loadApp, loadAppProtocol, saveAppProtocol, testAppProtocol } from './api/app-api';

vi.mock('./api/app-api', () => ({
  loadApp: vi.fn(),
  loadAppProtocol: vi.fn(),
  saveAppProtocol: vi.fn(),
  testAppProtocol: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const loadAppMock = vi.mocked(loadApp);
const loadProtocolMock = vi.mocked(loadAppProtocol);
const saveProtocolMock = vi.mocked(saveAppProtocol);
const testProtocolMock = vi.mocked(testAppProtocol);

describe('AppProtocolPage', () => {
  beforeEach(() => {
    loadAppMock.mockReset();
    loadProtocolMock.mockReset();
    saveProtocolMock.mockReset();
    testProtocolMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders case.input.query before sending a protocol test request', async () => {
    loadAppMock.mockResolvedValue({
      appCode: 'c',
      appName: '测试应用',
      appType: 'CHAT',
      description: '',
      owner: 'qa',
      status: 'ENABLED',
      protocol: null,
      createdAt: '',
      updatedAt: '',
    } as never);
    loadProtocolMock.mockResolvedValue({
      method: 'POST',
      url: 'http://127.0.0.1:3999/chat',
      headers: '{"Content-Type":"application/json"}',
      body: '{"query":"{{case.input.query}}"}',
      answerPath: '$.content',
      successExpr: '$.code == 0',
      streamEnabled: false,
      appConcurrency: 3,
    });
    testProtocolMock.mockResolvedValue({
      success: true,
      appCode: 'c',
      requestMethod: 'POST',
      invokeUrl: 'http://127.0.0.1:3999/chat',
      sampleInput: { query: '台湾和中国是什么关系' },
      resolvedHeaders: '{"Content-Type":"application/json"}',
      resolvedBody: '{"query":"台湾和中国是什么关系"}',
      rawResponse: { content: 'ok' },
      rawResponseText: '{"content":"ok"}',
      parsedAnswer: 'ok',
      assertion: '$.code == 0',
      message: '协议真实调用通过',
      elapsedMs: 12,
    });

    render(<AppProtocolPage appCode="c" />);

    await screen.findByRole('heading', { name: '接口配置' });
    fireEvent.change(screen.getByPlaceholderText('输入测试 query...'), {
      target: { value: '台湾和中国是什么关系' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送测试' }));

    await waitFor(() => expect(testProtocolMock).toHaveBeenCalledWith(
      'c',
      expect.objectContaining({
        body: '{"query":"{{case.input.query}}"}',
      }),
      '台湾和中国是什么关系',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(await screen.findByText('ok')).toBeInTheDocument();
  });
});
