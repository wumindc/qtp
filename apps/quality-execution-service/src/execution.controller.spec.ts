import { describe, expect, it, vi } from 'vitest';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

/**
 * @author codex
 * Builds the minimum real preconditions required before an execution run can start.
 */
function createJudgeReadyDatabase() {
  return {
    listCases: vi.fn().mockResolvedValue([]),
    findEvaluationConfig: vi.fn().mockResolvedValue({
      appCode: 'credit_assistant',
      modelId: '4',
      promptOverrideEnabled: false,
      customPrompt: '',
      effectivePrompt: '系统默认评估提示词',
    }),
    findJudgeModel: vi.fn().mockResolvedValue({
      id: '4',
      modelName: 'qwen3.5-plus',
      providerCode: 'provider-qwen',
      modelId: 'qwen3.5-plus',
      modelType: 'LLM',
      enabled: true,
      parameters: {},
    }),
    findJudgeProvider: vi.fn().mockResolvedValue({
      providerCode: 'provider-qwen',
      providerName: '通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
      enabled: true,
    }),
    createRun: vi.fn(async (run) => run),
    createResult: vi.fn(async (result) => result),
    listRuns: vi.fn().mockResolvedValue(null),
    findRun: vi.fn().mockResolvedValue(undefined),
    listResults: vi.fn().mockResolvedValue(null),
    findPlan: vi.fn().mockResolvedValue({
      planCode: 'SMOKE',
      planName: '冒烟测试',
      appCode: 'credit_assistant',
      caseFilter: {},
      status: 'ENABLED',
    }),
  };
}

describe('ExecutionController', () => {
  it('starts and lists execution runs', async () => {
    const controller = new ExecutionController(new ExecutionService({ database: createJudgeReadyDatabase() } as never));
    const response = await controller.start({ planCode: 'SMOKE', appCode: 'credit_assistant', caseCodes: ['1'] });

    expect(response.data.status).toBe('COMPLETED');
    expect(response.data.totalCount).toBe(0);
    expect((await controller.runList({ page: { currentPage: 1, linesPerPage: 10 }, data: {} })).data.list.length).toBeGreaterThan(0);
    expect((await controller.resultList({ runCode: response.data.runCode, page: { currentPage: 1, linesPerPage: 10 } })).data.list).toHaveLength(0);
  });

  it('returns readable plan name from run detail', async () => {
    const controller = new ExecutionController(new ExecutionService({ database: createJudgeReadyDatabase() } as never));
    const started = await controller.start({ planCode: 'SMOKE', appCode: 'credit_assistant', caseCodes: [] });

    const detail = await controller.runDetail({ runCode: started.data.runCode });

    expect(detail.data.planName).toBe('冒烟测试');
    expect(detail.data.runCode).toBe(started.data.runCode);
  });

  it('lists lightweight run versions for the selected plan run', async () => {
    const controller = new ExecutionController(new ExecutionService({ database: createJudgeReadyDatabase() } as never));
    const first = await controller.start({ planCode: 'SMOKE', appCode: 'credit_assistant', caseCodes: [] });
    const second = await controller.start({ planCode: 'SMOKE', appCode: 'credit_assistant', caseCodes: [] });

    const versions = await controller.runVersions({ runCode: second.data.runCode });

    expect(versions.data).toEqual([
      expect.objectContaining({
        runCode: second.data.runCode,
        sequenceNo: 2,
        totalCount: 0,
        avgScore: 0,
      }),
      expect.objectContaining({
        runCode: first.data.runCode,
        sequenceNo: 1,
        totalCount: 0,
        avgScore: 0,
      }),
    ]);
  });

  it('returns judge call audit detail for a result', async () => {
    const executionService = {
      judgeCallDetail: vi.fn().mockResolvedValue({
        callCode: 'judge-abc123def0',
        status: 'SUCCEEDED',
        modelId: 'qwen-plus',
        requestJson: { model: 'qwen-plus' },
      }),
    };
    const controller = new ExecutionController(executionService as never);

    const response = await controller.judgeCallDetail({ resultId: '12' });

    expect(executionService.judgeCallDetail).toHaveBeenCalledWith('12');
    expect(response.data).toMatchObject({
      callCode: 'judge-abc123def0',
      modelId: 'qwen-plus',
    });
  });

  it('recalculates cost for an execution run', async () => {
    const executionService = {
      recalculateCost: vi.fn().mockResolvedValue({
        runCode: 'run-abc123def0',
        totalTokens: 2300,
        totalCostAmount: 0.00172,
        costStatus: 'CALCULATED',
      }),
    };
    const controller = new ExecutionController(executionService as never);

    const response = await controller.recalculateCost({ runCode: 'run-abc123def0' });

    expect(executionService.recalculateCost).toHaveBeenCalledWith('run-abc123def0');
    expect(response.data).toMatchObject({
      runCode: 'run-abc123def0',
      totalCostAmount: 0.00172,
    });
  });
});
