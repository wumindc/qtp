import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult } from '@ai-quality-platform/shared-http';

export interface ReviewRecord {
  resultId: string;
  reviewStatus: 'PENDING' | 'REVIEWED';
  manualResult?: string | null;
  problemType?: string;
  reviewComment?: string;
  nextAction?: string;
  reviewer?: string;
}

type ReviewPrismaClient = {
  evalReview: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    create(input: { data: object }): Promise<unknown>;
  };
};

class ReviewDatabase {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads and writes review records through MySQL without demo review rows.
   */
  async list(): Promise<ReviewRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalReview.findMany({ orderBy: { id: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async submit(request: Omit<ReviewRecord, 'reviewStatus'>): Promise<ReviewRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma || !/^\d+$/.test(request.resultId)) return null;
    const saved = await prisma.evalReview.create({
      data: {
        resultId: BigInt(request.resultId),
        reviewStatus: 'REVIEWED',
        manualResult: request.manualResult ?? null,
        problemType: request.problemType,
        reviewComment: request.reviewComment,
        nextAction: request.nextAction,
        reviewer: request.reviewer,
        reviewedAt: new Date(),
      },
    });
    return this.toRecord(saved);
  }

  private async createClient() {
    if (process.env.VITEST) return null;
    return createRuntimePrismaClient<ReviewPrismaClient>();
  }

  private toRecord(row: unknown): ReviewRecord {
    const data = this.asRecord(row);
    return {
      resultId: String(data.resultId),
      reviewStatus: data.reviewStatus === 'REVIEWED' ? 'REVIEWED' : 'PENDING',
      manualResult: typeof data.manualResult === 'string' ? data.manualResult : data.manualResult === null ? null : undefined,
      problemType: typeof data.problemType === 'string' ? data.problemType : undefined,
      reviewComment: typeof data.reviewComment === 'string' ? data.reviewComment : undefined,
      nextAction: typeof data.nextAction === 'string' ? data.nextAction : undefined,
      reviewer: typeof data.reviewer === 'string' ? data.reviewer : undefined,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}

export class ReviewService {
  private readonly database = new ReviewDatabase();
  private readonly reviews = new Map<string, ReviewRecord>();

  /**
   * @author codex
   * Lists manual review work items from the current database state.
   */
  async list(page: { currentPage: number; linesPerPage: number }) {
    const databaseReviews = await this.database.list();
    if (databaseReviews) {
      this.reviews.clear();
      databaseReviews.forEach((review) => this.reviews.set(review.resultId, review));
    }
    const all = databaseReviews ?? Array.from(this.reviews.values());
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async submit(request: Omit<ReviewRecord, 'reviewStatus'>): Promise<ReviewRecord> {
    const saved = await this.database.submit(request);
    const record = saved ?? { ...request, reviewStatus: 'REVIEWED' as const };
    this.reviews.set(record.resultId, record);
    return record;
  }
}
