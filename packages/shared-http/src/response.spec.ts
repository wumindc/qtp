import { describe, expect, it } from 'vitest';
import { ok, pageResult } from './index';

describe('shared http response helpers', () => {
  it('wraps a successful response in the platform envelope', () => {
    expect(ok({ id: 1 })).toEqual({
      code: 0,
      success: true,
      message: 'ok',
      data: { id: 1 },
    });
  });

  it('wraps a paged list with platform pagination fields', () => {
    expect(pageResult([{ id: 1 }], 1, 10, 1)).toEqual({
      list: [{ id: 1 }],
      page: {
        totalNum: 1,
        currentPage: 1,
        linesPerPage: 10,
        totalPage: 1,
      },
    });
  });
});
