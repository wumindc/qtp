import { describe, expect, it, vi } from 'vitest';
import { GatewayController } from './gateway.controller';

describe('GatewayController', () => {
  it('forwards health requests to an internal service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { service: 'quality-business-service' } }),
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch);

    const response = await controller.forward('business', 'health.do');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/ai-quality-platform/health.do',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(response.data.service).toBe('quality-business-service');
  });

  it('forwards POST bodies to an internal service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ code: 0, success: true, data: { ok: true } }),
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch);

    await controller.forward('case', 'case/list.do', { keyword: '信用' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3102/ai-quality-platform/case/list.do',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ keyword: '信用' }),
      }),
    );
  });

  it('keeps query strings when forwarding raw HTTP requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ code: 0, success: true }),
      status: 200,
    });
    const controller = new GatewayController(fetchMock as unknown as typeof fetch);
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };

    await controller.forwardHttp(
      'business',
      'app/list.do',
      { method: 'GET', query: { keyword: '风控' } },
      responseMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/ai-quality-platform/app/list.do?keyword=%E9%A3%8E%E6%8E%A7',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(responseMock.status).toHaveBeenCalledWith(200);
    expect(responseMock.json).toHaveBeenCalledWith({ code: 0, success: true });
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
    const controller = new GatewayController(fetchMock as unknown as typeof fetch);
    const responseMock = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      json: vi.fn(),
    };

    await controller.forwardHttp(
      'execution',
      'demo-tested-app/chat.do',
      { method: 'POST', body: { stream: true } },
      responseMock,
    );

    expect(responseMock.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(responseMock.write).toHaveBeenCalledWith('data: {"delta":"你好"}\n\n');
    expect(responseMock.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(responseMock.json).not.toHaveBeenCalled();
    expect(responseMock.end).toHaveBeenCalled();
  });
});
