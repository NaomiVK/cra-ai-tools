import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tag } from 'primeng/tag';
import type { EvaluationResult, ActionableItem } from '@cra-ai-tools/shared-types';
import { ScoreCardComponent } from '../score-card/score-card.component';
import { LlmResultsComponent } from '../llm-results/llm-results.component';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, Tag, ScoreCardComponent, LlmResultsComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsComponent {
  result = input.required<EvaluationResult>();

  overallScore = computed(() => this.result().overall_score);

  overallColor = computed(() => {
    const s = this.overallScore();
    if (s >= 70) return '#198754';
    if (s >= 40) return '#ffc107';
    return '#dc3545';
  });

  overallLabel = computed(() => {
    const s = this.overallScore();
    if (s >= 70) return 'Good — LLMs can effectively extract and cite this content';
    if (s >= 40) return 'Fair — LLMs may struggle with some aspects of this content';
    return 'Poor — LLMs will have difficulty using this content';
  });

  categories = computed(() => {
    const h = this.result().heuristics;
    return [
      { label: 'Semantic HTML', key: 'semantic_html' as const, ...h.semantic_html },
      { label: 'Structured Data', key: 'structured_data' as const, ...h.structured_data },
      { label: 'Content Clarity', key: 'content_clarity' as const, ...h.content_clarity },
      { label: 'Citation Markers', key: 'citation_markers' as const, ...h.citation_markers },
      { label: 'Factual Density', key: 'factual_density' as const, ...h.factual_density },
    ];
  });

  sortedItems = computed(() => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...this.result().actionable_items].sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );
  });

  hasLlmResults = computed(() => {
    const llm = this.result().llm_evaluations;
    return !!(llm.claude || llm.gpt || llm.gemini);
  });

  llmEvaluations = computed(() => this.result().llm_evaluations);

  scoreComposition = computed(() => this.result().metadata.score_composition);

  metadata = computed(() => this.result().metadata);

  prioritySeverity(priority: ActionableItem['priority']): 'danger' | 'warn' | 'info' {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warn';
      case 'low': return 'info';
    }
  }
}
