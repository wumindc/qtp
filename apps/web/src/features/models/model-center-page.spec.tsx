import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelCenterPage, type ModelCenterRecord, type ModelProviderRecord } from './model-center-page';

const providers: ModelProviderRecord[] = [
  {
    id: 'openai-compatible-test',
    code: 'openai-compatible-test',
    name: 'OpenAI 兼容测试供应商',
    type: 'OPENAI_COMPATIBLE',
    baseUrl: 'http://127.0.0.1:8080/v1',
    apiKey: 'sk-demo',
    status: '启用',
  },
];

const models: ModelCenterRecord[] = [
  {
    id: '1',
    name: 'OpenAI 兼容评估模型',
    provider: 'openai-compatible-test',
    providerName: 'OpenAI 兼容测试供应商',
    providerType: 'OPENAI_COMPATIBLE',
    modelId: 'gpt-compatible-test',
    modelType: 'LLM',
    protocol: 'OPENAI_CHAT_COMPLETIONS',
    parameters: { temperature: 0.2, maxOutputTokens: 4096, stream: true },
    capabilities: { stream: true, jsonMode: true, toolCalling: true },
    limits: { contextWindow: 128000, maxOutputTokens: 4096 },
    status: '启用',
  },
];

function mockGateway() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, message: '模型连接配置可用', id: '2', enabled: true }),
  } as Response);
}

describe('ModelCenterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps models as the main tab and shows providers in a sibling tab', () => {
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    expect(screen.getByRole('heading', { name: '模型中心' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('OpenAI 兼容评估模型');
    expect(screen.getByRole('table')).toHaveTextContent('128K ctx / 4,096 out');
    expect(screen.getByRole('tab', { name: /模型列表/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /供应商列表/ })).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));

    expect(screen.getByRole('tab', { name: /供应商列表/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: '供应商列表' })).toHaveTextContent('OpenAI 兼容测试供应商');
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    expect(screen.getByRole('form', { name: '添加供应商表单' })).toBeInTheDocument();
  });

  it('adds a provider and then creates an LLM model without user-facing model code', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    const providerForm = screen.getByRole('form', { name: '添加供应商表单' });
    expect(within(providerForm).queryByLabelText('供应商编码')).not.toBeInTheDocument();
    fireEvent.change(within(providerForm).getByLabelText('供应商名称'), { target: { value: 'DeepSeek 生产环境' } });
    fireEvent.change(within(providerForm).getByLabelText('接口地址'), { target: { value: 'https://api.deepseek.com' } });
    fireEvent.change(within(providerForm).getByLabelText('API Key'), { target: { value: 'sk-deepseek' } });
    fireEvent.click(within(providerForm).getByRole('button', { name: '保存供应商' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: '添加供应商表单' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /模型列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加模型' }));

    const modelForm = screen.getByRole('form', { name: '添加模型表单' });
    expect(within(modelForm).queryByLabelText('模型编码')).not.toBeInTheDocument();
    expect(within(modelForm).queryByLabelText('用途')).not.toBeInTheDocument();
    expect(within(modelForm).queryByLabelText('温度 temperature')).not.toBeInTheDocument();
    expect(within(modelForm).queryByLabelText('Top P')).not.toBeInTheDocument();
    expect(within(modelForm).getByLabelText('支持流式响应')).toBeInTheDocument();
    expect(within(modelForm).getByLabelText('支持 JSON 输出')).toBeInTheDocument();
    expect(within(modelForm).getByLabelText('支持工具调用')).toBeInTheDocument();
    fireEvent.change(within(modelForm).getByLabelText('模型名称'), { target: { value: 'DeepSeek Chat' } });
    fireEvent.change(within(modelForm).getByLabelText('供应商模型 ID'), { target: { value: 'deepseek-chat' } });
    fireEvent.click(within(modelForm).getByRole('button', { name: '保存模型' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
        expect.objectContaining({
          body: expect.stringContaining('"modelType":"LLM"'),
          method: 'POST',
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
      expect.objectContaining({
        body: expect.not.stringContaining('modelCode'),
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
      expect.objectContaining({
        body: expect.not.stringContaining('temperature'),
        method: 'POST',
      }),
    );
  });

  it('uses controlled provider validation without native required bubbles', () => {
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    const providerForm = screen.getByRole('form', { name: '添加供应商表单' });
    expect(providerForm).toHaveAttribute('novalidate');
    fireEvent.click(within(providerForm).getByRole('button', { name: '保存供应商' }));

    expect(within(providerForm).getByText('请填写供应商名称。')).toBeInTheDocument();
    expect(within(providerForm).getByText('请填写接口地址。')).toBeInTheDocument();
    expect(within(providerForm).getByText('请填写 API Key。')).toBeInTheDocument();
  });

  it('tests provider form configuration before saving', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    const providerForm = screen.getByRole('form', { name: '添加供应商表单' });
    fireEvent.change(within(providerForm).getByLabelText('供应商名称'), { target: { value: 'DeepSeek 生产环境' } });
    fireEvent.change(within(providerForm).getByLabelText('接口地址'), { target: { value: 'https://api.deepseek.com' } });
    fireEvent.change(within(providerForm).getByLabelText('API Key'), { target: { value: 'sk-deepseek' } });
    fireEvent.click(within(providerForm).getByRole('button', { name: '测试连接' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/test-config.do',
        expect.objectContaining({
          body: expect.stringContaining('"baseUrl":"https://api.deepseek.com"'),
          method: 'POST',
        }),
      ),
    );
  });

  it('tests model form configuration before saving', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('button', { name: '添加模型' }));
    const modelForm = screen.getByRole('form', { name: '添加模型表单' });
    fireEvent.change(within(modelForm).getByLabelText('模型名称'), { target: { value: '临时评估模型' } });
    fireEvent.change(within(modelForm).getByLabelText('供应商模型 ID'), { target: { value: 'gpt-4.1-mini' } });
    fireEvent.click(within(modelForm).getByRole('button', { name: '测试连接' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/test-config.do',
        expect.objectContaining({
          body: expect.stringContaining('"modelId":"gpt-4.1-mini"'),
          method: 'POST',
        }),
      ),
    );
  });

  it('accepts decimal K and M token units while saving numeric token counts', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('button', { name: '添加模型' }));
    const modelForm = screen.getByRole('form', { name: '添加模型表单' });
    fireEvent.change(within(modelForm).getByLabelText('模型名称'), { target: { value: '紧凑单位模型' } });
    fireEvent.change(within(modelForm).getByLabelText('供应商模型 ID'), { target: { value: 'gpt-4.1-mini' } });
    fireEvent.change(within(modelForm).getByLabelText('上下文窗口'), { target: { value: '1m' } });
    fireEvent.change(within(modelForm).getByLabelText('最大输出 Token'), { target: { value: '4k' } });
    fireEvent.click(within(modelForm).getByRole('button', { name: '保存模型' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
        expect.objectContaining({
          body: expect.stringContaining('"contextWindow":1000000'),
          method: 'POST',
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"maxOutputTokens":4000'),
        method: 'POST',
      }),
    );
  });

  it('tests model connection through the gateway row action using id', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => expect(screen.getByText('模型连接配置可用')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/test-connection.do',
      expect.objectContaining({
        body: expect.stringContaining('"id":"1"'),
        method: 'POST',
      }),
    );
  });
});
