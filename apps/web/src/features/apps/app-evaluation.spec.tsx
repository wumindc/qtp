/**
 * 应用评估配置页测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvaluationPage } from './app-evaluation';
import { loadEvaluationConfig, loadEvaluationModels, saveEvaluationConfig } from './api/app-evaluation-api';
import { toast } from 'sonner';

vi.mock('./api/app-evaluation-api', () => ({
  loadEvaluationConfig: vi.fn(),
  loadEvaluationModels: vi.fn(),
  saveEvaluationConfig: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const loadConfigMock = vi.mocked(loadEvaluationConfig);
const loadModelsMock = vi.mocked(loadEvaluationModels);
const saveConfigMock = vi.mocked(saveEvaluationConfig);
const toastErrorMock = vi.mocked(toast.error);
const toastSuccessMock = vi.mocked(toast.success);

describe('AppEvaluationPage', () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    loadModelsMock.mockReset();
    saveConfigMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it('loads judge model options, shows the default prompt, and saves a custom prompt override', async () => {
    loadConfigMock.mockResolvedValue({
      appCode: 'c',
      configured: true,
      modelId: '4',
      promptOverrideEnabled: false,
      systemPrompt: '你是 AI 应用质量评估裁判。',
      customPrompt: '',
      effectivePrompt: '你是 AI 应用质量评估裁判。',
      evaluationConcurrency: 3,
    });
    loadModelsMock.mockResolvedValue([
      {
        id: '4',
        name: 'qwen3.5-plus',
        modelId: 'qwen3.5-plus',
        providerCode: 'provider-qwen',
        providerName: '通义千问',
      },
    ]);
    saveConfigMock.mockResolvedValue({
      appCode: 'c',
      configured: true,
      modelId: '4',
      promptOverrideEnabled: true,
      systemPrompt: '你是 AI 应用质量评估裁判。',
      customPrompt: '请严格评估回答是否满足期望。',
      effectivePrompt: '请严格评估回答是否满足期望。',
      evaluationConcurrency: 3,
    });

    render(<AppEvaluationPage appCode="c" />);

    expect(await screen.findByRole('heading', { name: '评估配置' })).toBeInTheDocument();
    expect(screen.getAllByText('qwen3.5-plus').length).toBeGreaterThan(0);
    expect(screen.getAllByText('你是 AI 应用质量评估裁判。').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '启用覆盖提示词' }));
    fireEvent.change(screen.getByLabelText('覆盖提示词'), { target: { value: '请严格评估回答是否满足期望。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存评估配置' }));

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith('c', {
        modelId: '4',
        promptOverrideEnabled: true,
        customPrompt: '请严格评估回答是否满足期望。',
        evaluationConcurrency: 3,
      }),
    );
  });

  it('does not auto-select the first model for an unconfigured app', async () => {
    loadConfigMock.mockResolvedValue({
      appCode: 'c',
      configured: false,
      modelId: '',
      promptOverrideEnabled: false,
      systemPrompt: '你是 AI 应用质量评估裁判。',
      customPrompt: '',
      effectivePrompt: '你是 AI 应用质量评估裁判。',
      evaluationConcurrency: 3,
    });
    loadModelsMock.mockResolvedValue([
      {
        id: '4',
        name: 'qwen3.5-plus',
        modelId: 'qwen3.5-plus',
        providerCode: 'provider-qwen',
        providerName: '通义千问',
      },
    ]);

    render(<AppEvaluationPage appCode="c" />);

    expect(await screen.findByRole('heading', { name: '评估配置' })).toBeInTheDocument();
    expect(screen.getByLabelText('评估模型')).toHaveValue('');
    expect(screen.getByText('请选择一个 LLM 评估模型，保存后执行计划才会启动评估。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存评估配置' }));

    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('请先选择评估模型');
  });
});
