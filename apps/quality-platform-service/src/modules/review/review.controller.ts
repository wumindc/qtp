import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { ReviewService, type ReviewSubmission } from './review.service';

@Controller('ai-quality-platform/review')
export class ReviewController {
  constructor(private readonly reviewService = new ReviewService()) {}

  /**
   * @author codex
   * Lists manual review tasks.
   */
  @Post('list.do')
  async list(@Body() request: { page: { currentPage: number; linesPerPage: number } }) {
    return ok(await this.reviewService.list(request.page));
  }

  @Post('submit.do')
  async submit(@Body() request: ReviewSubmission) {
    return ok(await this.reviewService.submit(request));
  }
}
