import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppCatalogPage } from './app-catalog-page';
import type { AppView } from './app-data';

const apps: AppView[] = [
  {
    id: 'demo_credit_assistant',
    code: 'demo_credit_assistant',
    name: '演示信用服务助手',
    type: 'CHATBOT',
    domain: '信用服务',
    owner: 'codex',
    endpoint: 'http://127.0.0.1:3104/ai-quality-platform/demo-tested-app/chat.do',
    method: 'POST',
    authType: 'NONE',
    headerTemplate: '{\n  "Content-Type": "application/json"\n}',
    bodyTemplate: '{\n  "query": "{{case.input.query}}"\n}',
    requestSchema: '{\n  "query": "string"\n}',
    responseSchema: '{\n  "data": {\n    "content": "string"\n  }\n}',
    answerPath: '$.data.content',
    successExpression: '$.code == 0',
    protocolReady: '已配置',
    status: '启用',
    protocol: {
      method: 'POST',
      url: 'http://127.0.0.1:3104/ai-quality-platform/demo-tested-app/chat.do',
      authType: 'NONE',
      headerTemplate: '{\n  "Content-Type": "application/json"\n}',
      bodyTemplate: '{\n  "query": "{{case.input.query}}"\n}',
      requestSchema: '{\n  "query": "string"\n}',
      responseSchema: '{\n  "data": {\n    "content": "string"\n  }\n}',
      answerPath: '$.data.content',
      successExpression: '$.code == 0',
      streamEnabled: false,
    },
  },
];

function mockGateway() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: {} }),
  } as Response);
}

describe('AppCatalogPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the whole AI app page as a dedicated card catalog', () => {
    const { container } = render(<AppCatalogPage initialApps={apps} />);

    expect(screen.getByRole('heading', { name: 'AI 应用' })).toBeInTheDocument();
    expect(screen.queryByLabelText('应用概览')).not.toBeInTheDocument();
    expect(screen.queryByText(/个应用 ·/u)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '配置模型' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增应用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑 演示信用服务助手' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('AI 应用卡片列表')).toHaveTextContent('演示信用服务助手');
    expect(screen.getByLabelText('AI 应用卡片列表')).toHaveTextContent('对话应用');
    expect(container.querySelectorAll('.app-catalog-meta-chip')).toHaveLength(3);
    expect(container.querySelector('.app-catalog-domain-chip')).toHaveTextContent('信用服务');
    expect(container.querySelector('.app-catalog-owner-chip')).toHaveTextContent('codex');
    expect(container.querySelector('.app-catalog-card-top')).not.toBeInTheDocument();
    expect(container.querySelector('.app-catalog-tags')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('详情抽屉')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入应用' })).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/demo_credit_assistant',
    );
  });

  it('creates an app from the catalog modal and updates the card grid', async () => {
    const fetchMock = mockGateway();
    render(<AppCatalogPage initialApps={apps} />);

    fireEvent.click(screen.getByRole('button', { name: '新增应用' }));
    const form = screen.getByRole('form', { name: '新增应用表单' });
    fireEvent.change(within(form).getByLabelText('应用编码'), { target: { value: 'policy_bot' } });
    fireEvent.change(within(form).getByLabelText('应用名称'), { target: { value: '政策问答助手' } });
    fireEvent.change(within(form).getByLabelText('业务领域'), { target: { value: '政策服务' } });
    fireEvent.change(within(form).getByLabelText('负责人'), { target: { value: 'qa' } });
    expect(within(form).queryByLabelText('接口地址')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText('Header 模板')).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: '保存应用' }));

    await waitFor(() => expect(screen.getByText('政策问答助手')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"appCode":"policy_bot"'),
        method: 'POST',
      }),
    );
  });

  it('requires a lightweight confirmation before changing app status', async () => {
    const fetchMock = mockGateway();
    render(<AppCatalogPage initialApps={apps} />);

    fireEvent.click(screen.getByRole('button', { name: '停用' }));

    expect(screen.getByRole('dialog', { name: '状态变更确认' })).toHaveTextContent('确认停用这个应用？');
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(screen.getByText('应用已停用')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/change-status.do',
      expect.objectContaining({
        body: expect.stringContaining('"status":"DISABLED"'),
        method: 'POST',
      }),
    );
  });

  it('uses a modal confirmation before deleting an app', () => {
    render(<AppCatalogPage initialApps={apps} />);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(screen.getByRole('dialog', { name: '删除应用确认' })).toHaveTextContent('演示信用服务助手');
    expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument();
  });
});
