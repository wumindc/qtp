import { afterEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from './gateway-client';

describe('postGateway', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts JSON to a gateway .do endpoint and returns parsed data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'model-1' } }),
    } as Response);

    await expect(postGateway('ai', '/provider/model/create.do', { modelName: 'Qwen' })).resolves.toEqual({ id: 'model-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
      expect.objectContaining({
        body: JSON.stringify({ modelName: 'Qwen' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  it('throws a readable gateway error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: '模型保存失败' }),
    } as Response);

    await expect(postGateway('ai', '/provider/model/create.do', {})).rejects.toThrow('模型保存失败');
  });
});
