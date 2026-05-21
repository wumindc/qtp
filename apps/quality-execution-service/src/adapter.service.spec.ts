import { describe, expect, it } from 'vitest';
import { AdapterService } from './adapter.service';

describe('AdapterService', () => {
  it('extracts an answer from a JSON response by simple JSON path', () => {
    const service = new AdapterService();

    expect(service.extractJson({ data: { content: '信用修复回答' } }, '$.data.content')).toBe('信用修复回答');
  });

  it('aggregates SSE answer deltas and detects errors', () => {
    const service = new AdapterService();
    const result = service.parseSse(
      ['data: {"data":{"answer":"信用"}}', 'data: {"data":{"answer":"修复"}}', 'data: [DONE]'].join('\n'),
      {
        deltaPath: '$.data.answer',
        doneMarker: '[DONE]',
        errorPath: '$.error.message',
      },
    );

    expect(result.answer).toBe('信用修复');
    expect(result.error).toBeUndefined();
  });

  it('returns SSE error messages', () => {
    const service = new AdapterService();
    const result = service.parseSse('data: {"error":{"message":"timeout"}}', {
      deltaPath: '$.data.answer',
      doneMarker: '[DONE]',
      errorPath: '$.error.message',
    });

    expect(result.error).toBe('timeout');
  });
});
