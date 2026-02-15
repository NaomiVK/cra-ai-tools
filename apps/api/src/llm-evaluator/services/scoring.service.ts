import { Injectable } from '@nestjs/common';
import type { EvaluationResult, ParsedPage } from '@cra-ai-tools/shared-types';
import { HeuristicsService } from './heuristics.service';
import { LlmService } from './llm.service';

export interface ScoringOptions {
  url?: string;
  filename?: string;
  includeLlm?: boolean;
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly heuristicsService: HeuristicsService,
    private readonly llmService: LlmService,
  ) {}

  async evaluate(page: ParsedPage, options: ScoringOptions): Promise<EvaluationResult> {
    const startTime = Date.now();

    // Phase 1: heuristics (synchronous)
    const heuristics = this.heuristicsService.run(page);

    // Phase 2: LLM evaluations (only when requested)
    const llmResults = options.includeLlm
      ? await this.llmService.evaluate(page)
      : { claude: null, gpt: null, gemini: null, consensus_score: null };

    // Score blending: 50/50 when LLM consensus is available
    const heuristicScore = heuristics.result.overall;
    const consensus = llmResults.consensus_score;
    const overallScore =
      options.includeLlm && consensus !== null
        ? Math.round(heuristicScore * 0.5 + consensus * 0.5)
        : heuristicScore;

    // Count successful LLM models
    const modelsSucceeded = options.includeLlm
      ? [llmResults.claude, llmResults.gpt, llmResults.gemini].filter(Boolean).length
      : 0;

    const scoreComposition: 'heuristics_only' | 'blended' =
      options.includeLlm && consensus !== null ? 'blended' : 'heuristics_only';

    return {
      overall_score: overallScore,
      heuristics: heuristics.result,
      llm_evaluations: llmResults,
      actionable_items: heuristics.actionableItems,
      metadata: {
        url: options.url,
        filename: options.filename,
        analyzed_at: new Date().toISOString(),
        analysis_duration_ms: Date.now() - startTime,
        llm_enabled: !!options.includeLlm,
        llm_models_succeeded: modelsSucceeded,
        score_composition: scoreComposition,
      },
    };
  }
}
