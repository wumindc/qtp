import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QButton, QConfirmDialog, QEmptyState, QSelectField, QTextField, QStatusChip } from '.';

describe('QTP UI Kit', () => {
  it('renders accessible field wrappers', () => {
    render(
      <>
        <QTextField label="模型名称" value="Qwen" onChange={() => undefined} errorMessage="名称重复" />
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
    expect(screen.getByText('名称重复')).toBeInTheDocument();
    expect(screen.getByLabelText('模型能力')).toBeInTheDocument();
  });

  it('renders status and empty states with stable text', () => {
    render(
      <>
        <QStatusChip status="启用" />
        <QEmptyState title="暂无模型" description="添加第一个模型后继续配置测试计划。" />
      </>,
    );

    expect(screen.getByText('启用')).toBeInTheDocument();
    expect(screen.getByText('暂无模型')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '保存模型' })).toBeDisabled();
  });
});
