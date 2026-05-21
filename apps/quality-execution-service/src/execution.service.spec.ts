import { describe, expect, it } from 'vitest';
import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
  it('starts an empty run when no database cases exist', async () => {
    const service = new ExecutionService();

    const run = await service.start({ planCode: 'SMOKE', appCode: 'credit_assistant' });
    const results = await service.resultList(run.runCode, { currentPage: 1, linesPerPage: 10 });

    expect(run.status).toBe('COMPLETED');
    expect(run.totalCount).toBe(0);
    expect(results.list).toHaveLength(0);
  });

  it('reruns without losing run identity', async () => {
    const service = new ExecutionService();
    const run = await service.start({ planCode: 'HIGH_RISK', appCode: 'credit_assistant' });

    expect((await service.rerun(run.runCode)).runCode).toBe(run.runCode);
  });

  it('cancels an execution run and keeps it visible in the run list', async () => {
    const service = new ExecutionService();
    const run = await service.start({ planCode: 'FULL_REGRESSION', appCode: 'credit_assistant' });

    const cancelled = await service.cancel(run.runCode);

    expect(cancelled.status).toBe('CANCELLED');
    expect((await service.runList({}, { currentPage: 1, linesPerPage: 10 })).list.some((item) => item.runCode === run.runCode)).toBe(true);
  });
});
