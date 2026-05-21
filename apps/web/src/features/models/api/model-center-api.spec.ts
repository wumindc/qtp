import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import { loadModelCenterData } from './model-center-api';

vi.mock('@/lib/api/gateway-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/gateway-client')>('@/lib/api/gateway-client');
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

describe('loadModelCenterData', () => {
  beforeEach(() => {
    vi.mocked(postGateway).mockReset();
  });

  it('falls back safely when gateway rows contain invalid enum values', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-1',
            providerType: 'BAD_PROVIDER',
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-1',
            modelType: 'BAD_MODEL',
            protocol: 'BAD_PROTOCOL',
          },
        ],
      });

    await expect(loadModelCenterData()).resolves.toEqual({
      providers: [
        {
          id: 'provider-1',
          code: 'provider-1',
          name: '',
          type: 'OPENAI_COMPATIBLE',
          baseUrl: '',
          apiKey: '',
          status: '启用',
        },
      ],
      models: [
        {
          id: '',
          name: '',
          provider: 'provider-1',
          providerName: '',
          providerType: 'OPENAI_COMPATIBLE',
          modelId: '',
          modelType: 'LLM',
          protocol: 'OPENAI_CHAT_COMPLETIONS',
          parameters: {},
          capabilities: {},
          limits: {},
          status: '启用',
        },
      ],
    });
  });
});
