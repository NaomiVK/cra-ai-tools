import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Tag } from 'primeng/tag';
import { SimiTrackService } from '../../services/simitrack.service';
import type {
  ContentSimilarityResult,
  SimilarityClassification,
} from '@cra-ai-tools/shared-types';

@Component({
  selector: 'app-simi-track',
  standalone: true,
  imports: [FormsModule, ProgressSpinner, Tag],
  templateUrl: './simi-track.component.html',
  styleUrl: './simi-track.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimiTrackComponent {
  private readonly simiTrackService = inject(SimiTrackService);

  urlInput = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<ContentSimilarityResult | null>(null);
  activeTab = signal<'relationships' | 'clusters'>('relationships');

  relationships = computed(() => this.result()?.relationships ?? []);
  clusters = computed(() => this.result()?.intent_collision_clusters ?? []);

  duplicates = computed(() =>
    this.relationships().filter(
      (r) =>
        r.classification === 'Definite Duplicate' ||
        r.classification === 'Near Duplicate'
    )
  );
  collisions = computed(() =>
    this.relationships().filter((r) => r.classification === 'Intent Collision')
  );
  cannibalization = computed(() =>
    this.relationships().filter(
      (r) => r.classification === 'Potential Cannibalization'
    )
  );
  templateOverlaps = computed(() =>
    this.relationships().filter(
      (r) => r.classification === 'Template Overlap'
    )
  );
  unique = computed(() =>
    this.relationships().filter((r) => r.classification === 'Unique')
  );

  analyze(): void {
    const urls = this.urlInput()
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    if (urls.length < 2) {
      this.error.set(
        'Please enter at least 2 valid URLs (starting with http), one per line.'
      );
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.simiTrackService.analyzeUrls(urls).subscribe({
      next: (response) => {
        if (response.success) {
          this.result.set(response.data);
        } else {
          this.error.set(response.error || 'Analysis failed');
        }
        this.loading.set(false);
      },
      error: (err) => {
        const msg =
          err?.error?.message || err?.message || 'Analysis failed. Please try again.';
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  loadExample(): void {
    this.urlInput.set(
      `https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit.html\nhttps://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4114/canada-child-benefit.html\nhttps://www.canada.ca/en/services/taxes/child-and-family-benefits.html`
    );
  }

  clear(): void {
    this.urlInput.set('');
    this.result.set(null);
    this.error.set(null);
  }

  getTagSeverity(
    classification: SimilarityClassification
  ): 'danger' | 'warn' | 'info' | 'success' | 'secondary' | 'contrast' {
    switch (classification) {
      case 'Definite Duplicate':
        return 'danger';
      case 'Near Duplicate':
        return 'warn';
      case 'Intent Collision':
        return 'info';
      case 'Potential Cannibalization':
        return 'warn';
      case 'Template Overlap':
        return 'secondary';
      default:
        return 'success';
    }
  }

  truncateUrl(url: string, maxLength = 60): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }
}
