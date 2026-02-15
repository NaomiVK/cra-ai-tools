import { Module } from '@nestjs/common';
import { LlmEvaluatorController } from './llm-evaluator.controller';
import { ScoringService } from './services/scoring.service';
import { HeuristicsService } from './services/heuristics.service';
import { PageFetcherService } from './services/page-fetcher.service';
import { LlmService } from './services/llm.service';

@Module({
  controllers: [LlmEvaluatorController],
  providers: [ScoringService, HeuristicsService, PageFetcherService, LlmService],
})
export class LlmEvaluatorModule {}
