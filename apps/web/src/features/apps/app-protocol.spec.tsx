/**
 * 应用接口配置页测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProtocolPage } from './app-protocol';
import { loadApp, loadAppProtocol, saveAppProtocol } from './api/app-api';

vi.mock('./api/app-api', () => ({
  loadApp: vi.fn(),
  loadAppProtocol: vi.fn(),
  saveAppProtocol: vi.fn(),
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

describe('AppProtocolPage', () => {
  beforeEach(() => {
    loadAppMock.mockReset();
    loadProtocolMock.mockReset();
    saveProtocolMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders case.input.query before sending a protocol test request', async () => {
    loadAppMock.mockResolvedValue({
      appCode: 'c',
      appName: '测试应用',
      appType: 'CHATBOT',
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
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<AppProtocolPage appCode="c" />);

    await screen.findByRole('heading', { name: '接口配置' });
    fireEvent.change(screen.getByPlaceholderText('输入测试 query...'), {
      target: { value: '台湾和中国是什么关系' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送测试' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/proxy', expect.any(Object)));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      body: {
        query: '台湾和中国是什么关系',
      },
    });
  });
});
