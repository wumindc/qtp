import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ReviewService, type ReviewDataStore, type ReviewRecord, type ReviewSubmission } from './review.service';

function createReviewDataStore(seed: ReviewRecord[] = []): ReviewDataStore {
  const reviews = [...seed];
  return {
    list: async () => [...reviews],
    submit: async (request: ReviewSubmission) => {
      const record: ReviewRecord = {
        resultId: request.resultId,
        manualResult: request.manualResult,
        reviewComment: request.reviewComment,
        reviewStatus: 'REVIEWED',
      };
      reviews.unshift(record);
      return record;
    },
  };
}

describe('ReviewService', () => {
  it('does not keep a production in-memory fallback store', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/review/review.service.ts'), 'utf8');

    expect(source).not.toContain('process.env.VITEST');
    expect(source).not.toContain('new Map<string, ReviewRecord>');
    expect(source).not.toContain('databaseReviews ?? Array.from');
  });

  it('starts with no manual review records and can submit one', async () => {
    const service = new ReviewService(createReviewDataStore());

    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).list).toHaveLength(0);
    const submitted = await service.submit({
      resultId: '1',
      manualResult: 'PASS',
      reviewComment: '可接受',
    });

    expect(submitted.reviewStatus).toBe('REVIEWED');
    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).list).toHaveLength(1);
  });

  it('accepts a null manual result to restore AI evaluation', async () => {
    const service = new ReviewService(createReviewDataStore());

    const submitted = await service.submit({
      resultId: '1',
      manualResult: null,
    });

    expect(submitted.reviewStatus).toBe('REVIEWED');
    expect(submitted.manualResult).toBeNull();
    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).list[0].manualResult).toBeNull();
  });

  it('drops fields that do not have a real review workflow source', async () => {
    const service = new ReviewService(createReviewDataStore());

    const submitted = await service.submit({
      resultId: '2',
      manualResult: 'FAIL',
      problemType: '接口调用失败',
      nextAction: 'NONE',
      reviewer: 'admin',
    } as never);

    expect(submitted).not.toHaveProperty('problemType');
    expect(submitted).not.toHaveProperty('nextAction');
    expect(submitted).not.toHaveProperty('reviewer');
  });
});
