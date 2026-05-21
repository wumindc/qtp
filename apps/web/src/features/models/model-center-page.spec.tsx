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
    defaultModel: 'gpt-compatible-test',
    status: '启用',
  },
];

const models: ModelCenterRecord[] = [
  {
    id: 'gpt-compatible-test-judge',
    code: 'gpt-compatible-test-judge',
    name: 'OpenAI 兼容评估模型',
    provider: 'openai-compatible-test',
    providerName: 'OpenAI 兼容测试供应商',
    providerType: 'OPENAI_COMPATIBLE',
    modelId: 'gpt-compatible-test',
    purpose: 'JUDGE',
    context: '128000',
    temperature: '0.2',
    status: '启用',
  },
];

function mockGateway() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, message: '模型连接配置可用' }),
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
    expect(screen.getByRole('tab', { name: /模型列表/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /供应商列表/ })).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));

    expect(screen.getByRole('tab', { name: /供应商列表/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: '供应商列表' })).toHaveTextContent('OpenAI 兼容测试供应商');
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    expect(screen.getByRole('form', { name: '添加供应商表单' })).toBeInTheDocument();
  });

  it('adds a provider from the panel and then creates a model bound to that provider', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    const providerForm = screen.getByRole('form', { name: '添加供应商表单' });
    expect(within(providerForm).queryByLabelText('供应商编码')).not.toBeInTheDocument();
    fireEvent.change(within(providerForm).getByLabelText('供应商名称'), { target: { value: 'DeepSeek 生产环境' } });
    fireEvent.change(within(providerForm).getByLabelText('接口地址'), { target: { value: 'https://api.deepseek.com/v1' } });
    fireEvent.change(within(providerForm).getByLabelText('API Key'), { target: { value: 'sk-deepseek' } });
    fireEvent.click(within(providerForm).getByRole('button', { name: '保存供应商' }));

    await waitFor(() => expect(screen.getAllByText('DeepSeek 生产环境').length).toBeGreaterThan(0));
    expect(screen.queryByRole('form', { name: '添加供应商表单' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /模型列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加模型' }));

    const modelForm = screen.getByRole('form', { name: '添加模型表单' });
    fireEvent.change(within(modelForm).getByLabelText('模型编码'), { target: { value: 'deepseek-chat-judge' } });
    fireEvent.change(within(modelForm).getByLabelText('模型名称'), { target: { value: 'DeepSeek 评估模型' } });
    fireEvent.change(within(modelForm).getByLabelText('供应商模型 ID'), { target: { value: 'deepseek-chat' } });
    fireEvent.click(within(modelForm).getByRole('button', { name: '保存模型' }));

    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('DeepSeek 评估模型'));
    expect(screen.getByRole('table')).toHaveTextContent('DeepSeek 生产环境');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"enabled":true'),
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/create.do',
      expect.objectContaining({
        body: expect.not.stringContaining('providerCode'),
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"providerCode":"provider-deepseek"'),
        method: 'POST',
      }),
    );
  });

  it('creates providers as enabled by default', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    const providerForm = screen.getByRole('form', { name: '添加供应商表单' });
    fireEvent.change(within(providerForm).getByLabelText('供应商名称'), { target: { value: '停用供应商' } });
    fireEvent.change(within(providerForm).getByLabelText('接口地址'), { target: { value: 'https://api.example.com/v1' } });
    fireEvent.change(within(providerForm).getByLabelText('API Key'), { target: { value: 'sk-disabled' } });
    expect(within(providerForm).queryByLabelText('保存后启用该供应商')).not.toBeInTheDocument();
    fireEvent.click(within(providerForm).getByRole('button', { name: '保存供应商' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/create.do',
        expect.objectContaining({
          body: expect.stringContaining('"enabled":true'),
          method: 'POST',
        }),
      ),
    );
  });

  it('tests provider form configuration before saving', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('tab', { name: /供应商列表/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加供应商' }));
    const providerForm = screen.getByRole('form', { name: '添加供应商表单' });
    fireEvent.change(within(providerForm).getByLabelText('接口地址'), { target: { value: 'https://api.deepseek.com/v1' } });
    fireEvent.change(within(providerForm).getByLabelText('API Key'), { target: { value: 'sk-deepseek' } });
    fireEvent.click(within(providerForm).getByRole('button', { name: '测试连接' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/test-config.do',
        expect.objectContaining({
          body: expect.stringContaining('"baseUrl":"https://api.deepseek.com/v1"'),
          method: 'POST',
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/test-config.do',
      expect.objectContaining({
        body: expect.not.stringContaining('providerCode'),
        method: 'POST',
      }),
    );
  });

  it('tests model connection through the gateway row action', async () => {
    const fetchMock = mockGateway();
    render(<ModelCenterPage initialModels={models} initialProviders={providers} />);

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => expect(screen.getByText('模型连接配置可用')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/ai/provider/model/test-connection.do',
      expect.objectContaining({
        body: expect.stringContaining('"modelCode":"gpt-compatible-test-judge"'),
        method: 'POST',
      }),
    );
  });
});
