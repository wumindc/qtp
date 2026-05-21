import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManagementConsolePage, type ManagementConsolePageProps } from './management-console-page';

const baseProps: ManagementConsolePageProps = {
  title: '应用管理',
  description: '管理 AI 应用配置',
  createLabel: '新建应用',
  statusOptions: ['启用', '停用'],
  columns: [
    { key: 'name', label: '名称' },
    { key: 'owner', label: '负责人' },
    { key: 'status', label: '状态' },
  ],
  fields: [
    { key: 'name', label: '名称', required: true, placeholder: '输入应用名称' },
    { key: 'owner', label: '负责人', required: true },
    { key: 'category', label: '类型', type: 'select', options: ['问答', '评测'] },
    { key: 'note', label: '备注', type: 'textarea' },
  ],
  initialRows: [
    { id: 'app-1', name: '信用助手', owner: '张三', category: '问答', note: '已接入', status: '启用' },
    { id: 'app-2', name: '政策评测', owner: '李四', category: '评测', note: '待确认', status: '停用' },
  ],
};

function renderConsole(props: Partial<ManagementConsolePageProps> = {}) {
  return render(<ManagementConsolePage {...baseProps} {...props} />);
}

function getDataRowByText(text: string) {
  const row = screen
    .getAllByRole('row')
    .find((currentRow) => currentRow.querySelector('td') && currentRow.textContent?.includes(text));
  expect(row).toBeDefined();
  return row as HTMLTableRowElement;
}

describe('ManagementConsolePage', () => {
  it('filters rows by search text and status', () => {
    renderConsole();

    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: '政策' } });
    expect(getDataRowByText('政策评测')).toBeInTheDocument();
    expect(screen.getAllByRole('row').some((row) => row.querySelector('td') && row.textContent?.includes('信用助手'))).toBe(
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: '启用' }));
    expect(screen.getByText('暂无匹配数据')).toBeInTheDocument();
  });

  it('selects rows and opens a detail drawer', () => {
    renderConsole();

    fireEvent.click(screen.getByLabelText('选择 信用助手'));
    expect(screen.getByText('已选择 1 项')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '详情' })[1]);
    const drawer = screen.getByLabelText('详情抽屉');
    expect(within(drawer).getAllByText('政策评测')).toHaveLength(2);
    expect(within(drawer).getByText('李四')).toBeInTheDocument();
  });

  it('can render row detail as an application detail link', () => {
    renderConsole({ getDetailHref: (row) => `/ai-quality-platform/apps/${row.id}` });

    const firstRow = getDataRowByText('信用助手');
    expect(within(firstRow).getByRole('link', { name: '进入' })).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/app-1',
    );
  });

  it('renders records as cards while keeping the primary detail action', () => {
    renderConsole({
      viewMode: 'cards',
      detailHrefBase: '/ai-quality-platform/apps',
      cardLayout: {
        titleKey: 'name',
        subtitleKey: 'owner',
        metaKeys: ['category', 'status'],
        descriptionKeys: ['owner'],
        primaryActionLabel: '进入应用',
      },
    });

    const cardList = screen.getByLabelText('应用管理卡片列表');
    expect(within(cardList).getByText('信用助手')).toBeInTheDocument();
    expect(within(cardList).getAllByRole('link', { name: '进入应用' })[0]).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/app-1',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('creates and edits rows through the modal form', async () => {
    renderConsole();

    fireEvent.click(screen.getByRole('button', { name: '新建应用' }));
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新建质检' } });
    fireEvent.change(screen.getByLabelText('负责人'), { target: { value: '王五' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(getDataRowByText('新建质检')).toBeInTheDocument());

    const newRow = getDataRowByText('新建质检');
    fireEvent.click(within(newRow).getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByLabelText('负责人'), { target: { value: '赵六' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(getDataRowByText('赵六')).toBeInTheDocument());
  });

  it('changes row status and deletes rows locally', async () => {
    renderConsole();

    const firstRow = getDataRowByText('信用助手');
    fireEvent.click(within(firstRow).getByRole('button', { name: '切换状态' }));
    await waitFor(() => expect(within(firstRow).getByText('停用')).toBeInTheDocument());

    fireEvent.click(within(firstRow).getByRole('button', { name: '删除' }));
    expect(screen.getByRole('dialog', { name: '删除确认' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() =>
      expect(screen.getAllByRole('row').some((row) => row.querySelector('td') && row.textContent?.includes('信用助手'))).toBe(
        false,
      ),
    );
  });
});
