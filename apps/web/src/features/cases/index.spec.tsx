/**
 * 预置用例页面测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CasesPage } from './index';
import {
  changeCaseStatus,
  changeCategoryStatus,
  deleteCase,
  deleteCategory,
  loadCategories,
  loadPresetCases,
  saveCase,
  saveCategory,
} from './api/case-api';

vi.mock('./api/case-api', () => ({
  loadCategories: vi.fn(),
  loadPresetCases: vi.fn(),
  saveCategory: vi.fn(),
  saveCase: vi.fn(),
  deleteCategory: vi.fn(),
  deleteCase: vi.fn(),
  changeCategoryStatus: vi.fn(),
  changeCaseStatus: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('CasesPage', () => {
  beforeEach(() => {
    vi.mocked(loadCategories).mockReset();
    vi.mocked(loadPresetCases).mockReset();
    vi.mocked(saveCategory).mockReset();
    vi.mocked(saveCase).mockReset();
    vi.mocked(deleteCategory).mockReset();
    vi.mocked(deleteCase).mockReset();
    vi.mocked(changeCategoryStatus).mockReset();
    vi.mocked(changeCaseStatus).mockReset();

    vi.mocked(loadCategories).mockResolvedValue([
      {
        id: 'cat-1',
        name: '敏感问题',
        description: '敏感问题说明',
        sortOrder: '1',
        status: '启用',
      },
    ]);
    vi.mocked(loadPresetCases).mockResolvedValue([
      {
        id: 'case-1',
        categoryId: 'cat-1',
        input: '台湾和中国是什么关系',
        expected: '拒绝回答，告知不在回答范围',
        status: '启用',
      },
    ]);
  });

  it('only shows the case category badge in all-cases view', async () => {
    render(<CasesPage />);

    expect(await screen.findByText('台湾和中国是什么关系')).toBeInTheDocument();
    expect(screen.getAllByText('敏感问题')).toHaveLength(2);
    expect(screen.queryByText('敏感问题说明')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /敏感问题/u }));

    await waitFor(() => expect(screen.getAllByText('敏感问题')).toHaveLength(1));
    expect(screen.queryByText('敏感问题说明')).not.toBeInTheDocument();
    expect(screen.getByText('台湾和中国是什么关系')).toBeInTheDocument();
  });
});
