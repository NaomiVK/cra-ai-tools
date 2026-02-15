import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProgressSpinner } from 'primeng/progressspinner';
import type { EvaluationResult } from '@cra-ai-tools/shared-types';
import { EvaluatorService } from '../../services/evaluator.service';
import { ResultsComponent } from './components/results/results.component';

@Component({
  selector: 'app-llm-evaluator',
  standalone: true,
  imports: [FormsModule, ProgressSpinner, ResultsComponent],
  templateUrl: './llm-evaluator.component.html',
  styleUrl: './llm-evaluator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmEvaluatorComponent {
  private readonly evaluator = inject(EvaluatorService);

  url = signal('');
  includeLlm = signal(false);
  loading = signal(false);
  result = signal<EvaluationResult | null>(null);
  error = signal<string | null>(null);

  evaluate(): void {
    const urlValue = this.url().trim();
    if (!urlValue) return;

    // Basic URL validation
    try {
      new URL(urlValue);
    } catch {
      this.error.set('Please enter a valid URL (e.g. https://www.canada.ca/en.html)');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.evaluator.analyzeUrl(urlValue, this.includeLlm()).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Analysis failed. Please try again.';
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }
}
