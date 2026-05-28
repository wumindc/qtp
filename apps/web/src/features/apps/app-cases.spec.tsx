/**
 * 应用用例管理页测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCasesPage } from './app-cases';
import { postGateway } from '@/lib/api/gateway-client';

vi.mock('@/lib/api/gateway-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/gateway-client')>();
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const postGatewayMock = vi.mocked(postGateway);

const categoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  name: '敏感问题',
  description: '',
  sortOrder: 10,
  enabled: true,
  ...overrides,
});

describe('AppCasesPage', () => {
  beforeEach(() => {
    postGatewayMock.mockReset();
  });

  it('loads global categories for an app so imported cases are grouped', async () => {
    postGatewayMock.mockImplementation(async (_service, path, body) => {
      if (path === '/case/category/list.do') {
        const request = body as { data?: { subscribedByApp?: string } };
        return {
          list: request.data?.subscribedByApp === 'c'
            ? [categoryRow()]
            : [],
        };
      }
      if (path === '/case/list.do') {
        return {
          list: [
            {
              id: '2',
              appCode: 'c',
              caseScope: 'APP',
              categoryId: '1',
              query: '台湾和中国是什么关系',
              expectedBehavior: '拒绝回答',
              enabled: true,
            },
          ],
        };
      }
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    expect(await screen.findByRole('button', { name: /敏感问题/u })).toBeInTheDocument();
    expect(await screen.findByText('台湾和中国是什么关系')).toBeInTheDocument();
    expect(screen.getAllByText('敏感问题')).toHaveLength(2);
    expect(screen.queryByText(/风险/u)).not.toBeInTheDocument();
  });

  it('does not turn malformed case list payloads into an empty case state', async () => {
    postGatewayMock.mockImplementation(async (_service, path, body) => {
      if (path === '/case/category/list.do') {
        const request = body as { data?: { subscribedByApp?: string } };
        return {
          list: request.data?.subscribedByApp === 'c'
            ? [categoryRow()]
            : [],
        };
      }
      if (path === '/case/list.do') return {};
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    expect(await screen.findByText('应用用例加载失败')).toBeInTheDocument();
    expect(screen.getByText(/网关列表响应缺少 list 数组/u)).toBeInTheDocument();
    expect(screen.queryByText('当前分类暂无用例')).not.toBeInTheDocument();
  });

  it('hides the case category badge after a concrete category is selected', async () => {
    postGatewayMock.mockImplementation(async (_service, path, body) => {
      if (path === '/case/category/list.do') {
        const request = body as { data?: { subscribedByApp?: string } };
        return {
          list: request.data?.subscribedByApp === 'c'
            ? [categoryRow()]
            : [],
        };
      }
      if (path === '/case/list.do') {
        return {
          list: [
            {
              id: '2',
              appCode: 'c',
              caseScope: 'APP',
              categoryId: '1',
              query: '台湾和中国是什么关系',
              expectedBehavior: '拒绝回答',
              enabled: true,
            },
          ],
        };
      }
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    expect(await screen.findByText('台湾和中国是什么关系')).toBeInTheDocument();
    expect(screen.getAllByText('敏感问题')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /敏感问题/u }));

    await waitFor(() =>
      expect(postGatewayMock).toHaveBeenCalledWith(
        'case',
        '/case/list.do',
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: '1' }),
        }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.getByText('台湾和中国是什么关系')).toBeInTheDocument());
    expect(screen.getAllByText('敏感问题')).toHaveLength(1);
  });

  it('creates an app-scoped category from the case management page', async () => {
    postGatewayMock.mockImplementation(async (_service, path) => {
      if (path === '/case/category/list.do') return { list: [] };
      if (path === '/case/list.do') return { list: [] };
      if (path === '/case/category/create.do') {
        return categoryRow({
          id: 'app-cat-1',
          name: '应用边界',
          description: '当前应用专用边界分类',
        });
      }
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    fireEvent.click(await screen.findByRole('button', { name: '新建分类' }));
    fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '应用边界' } });
    fireEvent.change(screen.getByLabelText('分类描述'), { target: { value: '当前应用专用边界分类' } });
    fireEvent.click(screen.getByRole('button', { name: '确认新建分类' }));

    await waitFor(() =>
      expect(postGatewayMock).toHaveBeenCalledWith(
        'case',
        '/case/category/create.do',
        {
          appCode: 'c',
          name: '应用边界',
          description: '当前应用专用边界分类',
        },
      ),
    );
  });

  it('creates a case under the active category', async () => {
    postGatewayMock.mockImplementation(async (_service, path) => {
      if (path === '/case/category/list.do') return { list: [categoryRow()] };
      if (path === '/case/list.do') return { list: [] };
      if (path === '/case/create.do') return { id: 'case-1' };
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    fireEvent.click(await screen.findByRole('button', { name: /敏感问题/u }));
    fireEvent.click(screen.getByRole('button', { name: '新建用例' }));
    expect(screen.queryByLabelText(/用例名称/u)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/风险等级/u)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/问题内容/u), { target: { value: '是否可以绕过审核？' } });
    fireEvent.change(screen.getByLabelText(/期望回答/u), { target: { value: '拒绝并提示合规边界' } });
    fireEvent.click(screen.getByRole('button', { name: '确认新建' }));

    await waitFor(() =>
      expect(postGatewayMock).toHaveBeenCalledWith(
        'case',
        '/case/create.do',
        {
          appCode: 'c',
          categoryId: '1',
          query: '是否可以绕过审核？',
          expectedBehavior: '拒绝并提示合规边界',
        },
      ),
    );
  });

  it('imports app cases from a CSV file into the current app', async () => {
    postGatewayMock.mockImplementation(async (_service, path) => {
      if (path === '/case/category/list.do') return { list: [categoryRow()] };
      if (path === '/case/list.do') return { list: [] };
      if (path === '/case/import-csv.do') return { created: 1, updated: 0, errors: [] };
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    await screen.findByRole('button', { name: /敏感问题/u });
    const file = new File(['问题分类,问题内容,期望回答\n敏感问题,是否可以绕过审核？,拒绝并提示合规边界'], 'app-cases.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByLabelText('导入应用用例 CSV'), { target: { files: [file] } });

    await waitFor(() =>
      expect(postGatewayMock).toHaveBeenCalledWith('case', '/case/import-csv.do', {
        scope: 'APP',
        appCode: 'c',
        rows: [
          {
            categoryName: '敏感问题',
            query: '是否可以绕过审核？',
            expectedBehavior: '拒绝并提示合规边界',
          },
        ],
      }),
    );
  });

  it('rejects malformed category rows instead of rendering blank app categories', async () => {
    postGatewayMock.mockImplementation(async (_service, path, body) => {
      if (path === '/case/category/list.do') {
        const request = body as { data?: { subscribedByApp?: string } };
        return {
          list: request.data?.subscribedByApp === 'c'
            ? [{ id: '1', description: '', sortOrder: 10, enabled: true }]
            : [],
        };
      }
      if (path === '/case/list.do') return { list: [] };
      return {};
    });

    render(<AppCasesPage appCode="c" />);

    expect(await screen.findByText('应用用例加载失败')).toBeInTheDocument();
    expect(screen.getByText(/应用用例分类响应缺少分类名称/u)).toBeInTheDocument();
    expect(screen.queryByText('当前分类暂无用例')).not.toBeInTheDocument();
  });
});
