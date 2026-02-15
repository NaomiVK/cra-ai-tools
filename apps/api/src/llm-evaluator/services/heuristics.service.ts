import { Injectable } from '@nestjs/common';
import type { ParsedPage, HeuristicsResult, ActionableItem } from '@cra-ai-tools/shared-types';
import { analyzeSemanticHTML } from '../analyzers/semantic-html.analyzer';
import { analyzeStructuredData } from '../analyzers/structured-data.analyzer';
import { analyzeContentClarity } from '../analyzers/content-clarity.analyzer';
import { analyzeCitationMarkers } from '../analyzers/citation-markers.analyzer';
import { analyzeFactualDensity } from '../analyzers/factual-density.analyzer';

export interface HeuristicsOutput {
  result: HeuristicsResult;
  actionableItems: ActionableItem[];
}

@Injectable()
export class HeuristicsService {
  run(page: ParsedPage): HeuristicsOutput {
    const semantic = analyzeSemanticHTML(page);
    const structured = analyzeStructuredData(page);
    const clarity = analyzeContentClarity(page);
    const citations = analyzeCitationMarkers(page);
    const density = analyzeFactualDensity(page);

    const overall = Math.round(
      (semantic.score.score +
        structured.score.score +
        clarity.score.score +
        citations.score.score +
        density.score.score) / 5
    );

    const allActions = [
      ...semantic.actionableItems,
      ...structured.actionableItems,
      ...clarity.actionableItems,
      ...citations.actionableItems,
      ...density.actionableItems,
    ];

    // Sort: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    allActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      result: {
        semantic_html: semantic.score,
        structured_data: structured.score,
        content_clarity: clarity.score,
        citation_markers: citations.score,
        factual_density: density.score,
        overall,
      },
      actionableItems: allActions,
    };
  }
}
