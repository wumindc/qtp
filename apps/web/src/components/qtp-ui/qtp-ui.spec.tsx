import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { describe, expect, it, vi } from 'vitest';
import {
  QButton,
  QConfirmDialog,
  QDataTable,
  QEmptyState,
  QErrorState,
  QLoadingState,
  QModal,
  QSelectField,
  QTextareaField,
  QTextField,
  QStatusChip,
} from '.';

describe('QTP UI Kit', () => {
  it('renders accessible field wrappers', () => {
    render(
      <>
        <QTextField label="模型名称" value="Qwen" onChange={() => undefined} errorMessage="名称重复" />
        <QTextareaField label="模型说明" value="用于通用问答" onChange={() => undefined} />
        <QSelectField
          label="模型能力"
          selectedKey="LLM"
          onSelectionChange={() => undefined}
          options={[
            { label: 'LLM', value: 'LLM' },
            { label: 'Embedding', value: 'EMBEDDING' },
          ]}
        />
      </>,
    );

    expect(screen.getByLabelText('模型名称')).toHaveValue('Qwen');
    expect(screen.getByLabelText('模型说明')).toHaveValue('用于通用问答');
    expect(screen.getByText('名称重复')).toBeInTheDocument();
    expect(screen.getByLabelText('模型能力')).toBeInTheDocument();
  });

  it('passes hidden text field labels to the React Aria field root', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(<QTextField aria-label="搜索模型" placeholder="搜索模型名称" value="" onChange={() => undefined} />);

    expect(screen.getByLabelText('搜索模型')).toBeInTheDocument();
    await waitFor(() =>
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('If you do not provide a visible label'),
      ),
    );
  });

  it('renders controlled modals without requiring a trigger child', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <QModal isOpen title="添加模型" onOpenChange={() => undefined}>
        <p>模型表单</p>
      </QModal>,
    );

    expect(screen.getByRole('dialog', { name: '添加模型' })).toBeInTheDocument();
    await waitFor(() =>
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('A PressResponder was rendered without a pressable child'),
      ),
    );
  });

  it('renders status, empty, error, and loading states with stable text', () => {
    render(
      <>
        <QStatusChip status="启用" />
        <QStatusChip status="异常" tone="danger" />
        <QEmptyState title="暂无模型" description="添加第一个模型后继续配置测试计划。" />
        <QErrorState title="加载失败" description="请稍后重试。" />
        <QLoadingState label="正在加载模型" />
      </>,
    );

    expect(screen.getByText('启用')).toBeInTheDocument();
    expect(screen.getByText('异常')).toBeInTheDocument();
    expect(screen.getByText('暂无模型')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('加载失败');
    expect(screen.getByRole('status')).toHaveTextContent('正在加载模型');
  });

  it('renders an accessible data table with header and body content', () => {
    render(
      <QDataTable aria-label="模型列表">
        <TableHeader>
          <TableColumn isRowHeader>模型名称</TableColumn>
          <TableColumn>状态</TableColumn>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Qwen Plus</TableCell>
            <TableCell>启用</TableCell>
          </TableRow>
        </TableBody>
      </QDataTable>,
    );

    expect(screen.getByRole('table', { name: '模型列表' })).toBeInTheDocument();
    expect(screen.getByText('Qwen Plus')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '模型名称' })).toBeInTheDocument();
  });

  it('confirms destructive actions from a modal', () => {
    const onConfirm = vi.fn();
    render(
      <QConfirmDialog
        isOpen
        title="删除模型确认"
        description="确认删除 DeepSeek Chat？"
        confirmLabel="确认删除"
        onOpenChange={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(within(screen.getByRole('dialog', { name: '删除模型确认' })).getByRole('button', { name: '确认删除' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders buttons with loading state', () => {
    render(<QButton isLoading>保存模型</QButton>);
    const button = screen.getByRole('button', { name: '保存模型' });

    expect(button).toBeDisabled();
    expect(within(button).getByText('加载中')).toBeInTheDocument();
  });

  it('maps ergonomic button color and variant props to HeroUI v3 variants', () => {
    render(
      <>
        <QButton>新建模型</QButton>
        <QButton color="danger">删除模型</QButton>
        <QButton variant="flat">取消</QButton>
      </>,
    );

    expect(screen.getByRole('button', { name: '新建模型' })).toHaveAttribute('data-qtp-variant', 'primary');
    expect(screen.getByRole('button', { name: '删除模型' })).toHaveAttribute('data-qtp-variant', 'danger');
    expect(screen.getByRole('button', { name: '取消' })).toHaveAttribute('data-qtp-variant', 'secondary');
  });
});
