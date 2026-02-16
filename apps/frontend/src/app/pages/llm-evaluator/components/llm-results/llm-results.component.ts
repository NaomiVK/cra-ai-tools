import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LLMResults, LLMEvaluation } from '@cra-ai-tools/shared-types';

interface ModelEntry {
  key: string;
  label: string;
  evaluation: LLMEvaluation | null;
}

@Component({
  selector: 'app-llm-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './llm-results.component.html',
  styleUrl: './llm-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmResultsComponent {
  llmResults = input.required<LLMResults>();

  models = computed<ModelEntry[]>(() => {
    const r = this.llmResults();
    return [
      { key: 'claude', label: 'Claude 4.5 Sonnet', evaluation: r.claude },
      { key: 'gpt', label: 'GPT-5.1 Chat', evaluation: r.gpt },
      { key: 'gemini', label: 'Gemini 3 Flash', evaluation: r.gemini },
    ];
  });

  consensusScore = computed(() => this.llmResults().consensus_score);

  successfulModelCount = computed(() =>
    this.models().filter((m) => m.evaluation !== null).length
  );

  dimensions = ['extractability', 'citation_worthiness', 'query_relevance', 'structure_quality', 'authority_signals'] as const;

  dimensionLabel(dim: string): string {
    return dim.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  scoreColor(score: number): string {
    if (score >= 70) return '#198754';
    if (score >= 40) return '#ffc107';
    return '#dc3545';
  }

  scoreBarWidth(score: number): string {
    return `${score}%`;
  }
}
