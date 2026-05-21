import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GatewayListPage } from './gateway-list-page';

describe('GatewayListPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads list rows through the unified gateway', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({
        list: [{ appName: '网关返回应用', appType: 'CHATBOT', businessDomain: '信用服务', status: 'ENABLED' }],
        page: { totalNum: 1, currentPage: 1, linesPerPage: 10, totalPage: 1 },
      }),
    } as Response);

    render(
      <GatewayListPage
        title="AI 应用"
        description="管理应用"
        service="business"
        path="/app/list.do"
        columns={['应用名称', '类型', '业务领域', '状态']}
        mapRow={(item) => [
          String(item.appName),
          String(item.appType),
          String(item.businessDomain),
          item.status === 'ENABLED' ? '启用' : '停用',
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByText('网关返回应用')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/list.do',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
