import { describe, expect, it, vi } from 'vitest';
import { createAuthToken } from '@ai-quality-platform/shared-auth';
import { GatewayController } from './gateway.controller';

const authHeaders = {
  authorization: `Bearer ${createAuthToken(
    { username: 'admin', displayName: '系统管理员', roleCode: 'ADMIN' },
    'unit-test-secret',
  )}`,
};

describe('GatewayController', () => {
  it('forwards health requests to an internal service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { service: 'quality-platform-service' } }),
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');

    const response = await controller.forward('business', 'health.do');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/ai-quality-platform/health.do',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(response.data.service).toBe('quality-platform-service');
  });

  it('forwards POST bodies to an internal service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ code: 0, success: true, data: { ok: true } }),
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');

    await controller.forward('case', 'case/list.do', { keyword: '信用' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/ai-quality-platform/case/list.do',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ keyword: '信用' }),
      }),
    );
  });

  it('does not synthesize an empty JSON body for POST calls without an explicit body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ code: 0, success: true }),
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');

    await controller.forward('case', 'case/list.do', undefined, 'POST');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init)).not.toContain('{}');
  });

  it('keeps query strings when forwarding raw HTTP requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ code: 0, success: true }),
      status: 200,
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };

    await controller.forwardHttp(
      'business',
      'app/list.do',
      { method: 'GET', query: { keyword: '风控' }, headers: authHeaders },
      responseMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/ai-quality-platform/app/list.do?keyword=%E9%A3%8E%E6%8E%A7',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(responseMock.status).toHaveBeenCalledWith(200);
    expect(responseMock.json).toHaveBeenCalledWith({ code: 0, success: true });
  });

  it('preserves authorization headers from the Nest route entrypoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ code: 0, success: true }),
      status: 200,
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };

    await controller.forwardAll(
      'business',
      ['app', 'list.do'],
      { method: 'POST', headers: authHeaders },
      { page: { currentPage: 1, linesPerPage: 1 }, data: {} },
      responseMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/ai-quality-platform/app/list.do',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not synthesize an empty JSON body for raw POST requests without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ code: 0, success: true }),
      status: 200,
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };

    await controller.forwardHttp(
      'business',
      'app/list.do',
      { method: 'POST', headers: authHeaders },
      responseMock,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init)).not.toContain('{}');
  });


  it('streams event-stream responses without JSON parsing', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"delta":"你好"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: stream,
      status: 200,
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      json: vi.fn(),
    };

    await controller.forwardHttp(
      'execution',
      'tested-app/chat.do',
      { method: 'POST', body: { stream: true }, headers: authHeaders },
      responseMock,
    );

    expect(responseMock.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(responseMock.write).toHaveBeenCalledWith('data: {"delta":"你好"}\n\n');
    expect(responseMock.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(responseMock.json).not.toHaveBeenCalled();
    expect(responseMock.end).toHaveBeenCalled();
  });

  it('rejects private gateway calls without a signed token', async () => {
    const fetchMock = vi.fn();
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      json: vi.fn(),
    };

    await controller.forwardHttp(
      'business',
      'app/list.do',
      { method: 'GET' },
      responseMock,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(responseMock.status).toHaveBeenCalledWith(401);
    expect(responseMock.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '未登录或登录已过期',
    }));
  });

  it('keeps login public so users can obtain a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ code: 0, success: true, data: { token: 'signed-token' } }),
      status: 200,
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch, 'unit-test-secret');
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };

    await controller.forwardHttp(
      'system',
      'auth/login.do',
      { method: 'POST', body: { username: 'admin', password: 'secret' } },
      responseMock,
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(responseMock.status).toHaveBeenCalledWith(200);
  });
});
