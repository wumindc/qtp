/**
 * 应用表单弹窗测试
 * @author codex
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppFormDialog } from './app-form-dialog';

describe('AppFormDialog', () => {
  it('only exposes the currently supported CHAT application type', () => {
    const onSubmit = vi.fn();

    render(
      <AppFormDialog
        open
        editingApp={null}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('CHAT - 对话问答')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/WORKFLOW/u)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/应用名称/u), { target: { value: '网站对话助手' } });
    fireEvent.click(screen.getByRole('button', { name: '创建应用' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ appType: 'CHAT' }));
  });
});
