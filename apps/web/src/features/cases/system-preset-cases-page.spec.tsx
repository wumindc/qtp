import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemPresetCasesPage } from './system-preset-cases-page';

// @author codex: Verifies system preset case creation stays in modal flows instead of expanding inside tables.
const categories = [
  {
    id: 'NORMAL_QA',
    name: '常规问答',
    description: '正常业务咨询问题',
    sortOrder: '10',
    status: '启用',
  },
  {
    id: 'FORMAT_OUTPUT',
    name: '格式输出',
    description: '要求 JSON、Markdown、表格等固定格式输出',
    sortOrder: '20',
    status: '启用',
  },
];

const presetCases = [
  {
    id: 'PRESET_NORMAL_QA_001',
    name: '标准问答',
    categoryId: 'NORMAL_QA',
    risk: 'LOW',
    input: '查询政策',
    expected: '友好提示',
    status: '启用',
  },
  {
    id: 'PRESET_FORMAT_OUTPUT_001',
    name: 'JSON 输出',
    categoryId: 'FORMAT_OUTPUT',
    risk: 'MEDIUM',
    input: '请用 JSON 输出',
    expected: '结构化输出',
    status: '启用',
  },
];

function mockGateway() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { id: 'saved_id' } }),
  } as Response);
}

describe('SystemPresetCasesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters preset cases by the selected category rail item', () => {
    render(<SystemPresetCasesPage initialCategories={categories} initialCases={presetCases} live />);

    expect(screen.getByRole('button', { name: /全部用例/u })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /常规问答/u })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /格式输出/u })).toHaveTextContent('1');
    expect(screen.getByText('标准问答')).toBeInTheDocument();
    expect(screen.getByText('JSON 输出')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /格式输出/u }));

    expect(screen.getByText('JSON 输出')).toBeInTheDocument();
    expect(screen.queryByText('标准问答')).not.toBeInTheDocument();
    expect(screen.getByText(/共 1 条/u)).toBeInTheDocument();
  });

  it('opens the preset case creation form in a modal', async () => {
    const fetchMock = mockGateway();
    render(<SystemPresetCasesPage initialCategories={categories} initialCases={presetCases} live />);

    expect(screen.queryByRole('form', { name: '新增预置用例表单' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新增预置用例' }));

    const form = screen.getByRole('form', { name: '新增预置用例表单' });
    expect(within(form).getByText('维护平台级可复用测试用例')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('用例名称'), { target: { value: '追问澄清' } });
    fireEvent.change(within(form).getByLabelText('测试输入'), { target: { value: '帮我查一下' } });
    fireEvent.change(within(form).getByLabelText('期望行为'), { target: { value: '要求补充条件' } });
    fireEvent.click(within(form).getByRole('button', { name: '保存预置用例' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: '新增预置用例表单' })).not.toBeInTheDocument());
    expect(screen.getByText('追问澄清')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/case/case/preset/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"caseName":"追问澄清"'),
        method: 'POST',
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).not.toContain('caseCode');
  });

  it('opens the category creation form in a modal', async () => {
    const fetchMock = mockGateway();
    render(<SystemPresetCasesPage initialCategories={categories} initialCases={presetCases} live />);

    fireEvent.click(screen.getByRole('tab', { name: /分类列表/u }));
    fireEvent.click(screen.getByRole('button', { name: '新增分类' }));

    const form = screen.getByRole('form', { name: '新增分类表单' });
    expect(within(form).getByText('定义系统预置用例分类')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('分类名称'), { target: { value: '敏感风险' } });
    fireEvent.change(within(form).getByLabelText('分类说明'), { target: { value: '违规、绕规则、虚假材料等高风险问题' } });
    fireEvent.click(within(form).getByRole('button', { name: '保存分类' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: '新增分类表单' })).not.toBeInTheDocument());
    expect(screen.getByText('敏感风险')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/ai-quality-platform/api/case/case/category/create.do',
      expect.objectContaining({
        body: expect.stringContaining('"name":"敏感风险"'),
        method: 'POST',
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).not.toContain('code');
  });
});
