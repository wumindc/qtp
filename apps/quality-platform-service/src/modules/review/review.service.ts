import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult } from '@ai-quality-platform/shared-http';

export interface ReviewRecord {
  resultId: string;
  reviewStatus: 'REVIEWED';
  manualResult?: string | null;
  reviewComment?: string;
}

export type ReviewSubmission = Omit<ReviewRecord, 'reviewStatus'>;

type ReviewPrismaClient = {
  evalReview: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    create(input: { data: object }): Promise<unknown>;
  };
};

export interface ReviewDataStore {
  list(): Promise<ReviewRecord[]>;
  submit(request: ReviewSubmission): Promise<ReviewRecord>;
}

class ReviewDatabase implements ReviewDataStore {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads and writes review records through MySQL without synthetic review rows.
   */
  async list(): Promise<ReviewRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalReview.findMany({ orderBy: { id: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async submit(request: ReviewSubmission): Promise<ReviewRecord> {
    const prisma = await this.prismaPromise;
    if (!/^\d+$/.test(request.resultId)) throw new Error('人工复核结果 ID 必须来自真实执行结果');
    const saved = await prisma.evalReview.create({
      data: {
        resultId: BigInt(request.resultId),
        manualResult: request.manualResult ?? null,
        reviewComment: request.reviewComment,
      },
    });
    return this.toRecord(saved);
  }

  private async createClient() {
    return createRuntimePrismaClient<ReviewPrismaClient>();
  }

  private toRecord(row: unknown): ReviewRecord {
    const data = this.asRecord(row);
    return {
      resultId: String(data.resultId),
      reviewStatus: 'REVIEWED',
      manualResult: typeof data.manualResult === 'string' ? data.manualResult : data.manualResult === null ? null : undefined,
      reviewComment: typeof data.reviewComment === 'string' ? data.reviewComment : undefined,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}

export class ReviewService {
  constructor(private readonly database: ReviewDataStore = new ReviewDatabase()) {}

  /**
   * @author codex
   * Lists manual review work items from the current database state.
   */
  async list(page: { currentPage: number; linesPerPage: number }) {
    const all = await this.database.list();
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async submit(request: ReviewSubmission): Promise<ReviewRecord> {
    return this.database.submit(request);
  }
}
