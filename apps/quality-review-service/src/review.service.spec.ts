import { describe, expect, it } from 'vitest';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  it('starts with no manual review records and can submit one', async () => {
    const service = new ReviewService();

    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).list).toHaveLength(0);
    const submitted = await service.submit({
      resultId: '1',
      manualResult: 'PASS',
      problemType: '无',
      reviewComment: '可接受',
      nextAction: 'NONE',
      reviewer: 'admin',
    });

    expect(submitted.reviewStatus).toBe('REVIEWED');
    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).list).toHaveLength(1);
  });
});
