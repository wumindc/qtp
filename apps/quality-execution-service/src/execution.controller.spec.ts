import { describe, expect, it } from 'vitest';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

describe('ExecutionController', () => {
  it('starts and lists execution runs', async () => {
    const controller = new ExecutionController(new ExecutionService());
    const response = await controller.start({ planCode: 'SMOKE', appCode: 'credit_assistant', caseCodes: ['1'] });

    expect(response.data.status).toBe('COMPLETED');
    expect(response.data.totalCount).toBe(0);
    expect((await controller.runList({ page: { currentPage: 1, linesPerPage: 10 }, data: {} })).list.length).toBeGreaterThan(0);
  });
});
