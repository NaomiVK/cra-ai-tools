import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { LlmBatchService } from '../../services/llm-batch.service';
import type {
  BatchResultRow,
  BatchRunStatus,
  BatchQuestion,
  BatchModelName,
  BatchScheduleConfig,
} from '@cra-ai-tools/shared-types';

@Component({
  selector: 'app-llm-batch',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, NgClass],
  templateUrl: './llm-batch.component.html',
  styleUrl: './llm-batch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmBatchComponent implements OnInit, OnDestroy {
  private readonly batchService = inject(LlmBatchService);
  private statusPollTimer: ReturnType<typeof setInterval> | null = null;
  readonly Math = Math;

  // Status
  status = signal<BatchRunStatus | null>(null);
  questions = signal<BatchQuestion[]>([]);
  showQuestions = signal(false);

  // Filters
  filterModel = signal<string>('');
  filterSearch = signal<string>('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  // Results
  rows = signal<BatchResultRow[]>([]);
  total = signal(0);
  filteredTotal = signal(0);
  currentPage = signal(1);
  pageSize = 20;

  // Schedule
  scheduleEnabled = signal(false);
  scheduleHour = signal(6);
  scheduleLoading = signal(false);
  utcHours = Array.from({ length: 24 }, (_, i) => i);

  // Upload
  uploadLoading = signal(false);
  uploadError = signal<string | null>(null);
  isCustomQuestions = signal(false);
  selectedFile = signal<File | null>(null);

  // State
  loading = signal(false);
  runLoading = signal(false);
  error = signal<string | null>(null);

  totalPages = computed(() => Math.ceil(this.filteredTotal() / this.pageSize) || 1);

  ngOnInit(): void {
    this.loadStatus();
    this.loadQuestions();
    this.loadResults();
  }

  ngOnDestroy(): void {
    this.stopStatusPolling();
  }

  loadStatus(): void {
    this.batchService.getStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        this.scheduleEnabled.set(s.schedule_enabled);
        this.scheduleHour.set(s.schedule_utc_hour);
        if (s.is_running) {
          this.startStatusPolling();
        } else {
          this.stopStatusPolling();
        }
      },
      error: (err) =>
        this.error.set(err?.error?.message || 'Failed to load status'),
    });
  }

  private startStatusPolling(): void {
    if (this.statusPollTimer) return;
    this.statusPollTimer = setInterval(() => {
      this.batchService.getStatus().subscribe({
        next: (s) => {
          this.status.set(s);
          this.scheduleEnabled.set(s.schedule_enabled);
          this.scheduleHour.set(s.schedule_utc_hour);
          if (!s.is_running) {
            this.stopStatusPolling();
            this.runLoading.set(false);
            this.loadResults();
          }
        },
      });
    }, 5000);
  }

  private stopStatusPolling(): void {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  }

  loadQuestions(): void {
    this.batchService.getQuestions().subscribe({
      next: (res) => {
        if (res.success) {
          this.questions.set(res.data);
          this.isCustomQuestions.set(res.is_custom);
        }
      },
    });
  }

  loadResults(): void {
    this.loading.set(true);
    this.error.set(null);

    const query: Record<string, unknown> = {
      limit: this.pageSize,
      offset: (this.currentPage() - 1) * this.pageSize,
    };
    if (this.filterModel()) query['model'] = this.filterModel();
    if (this.filterSearch() !== '') {
      query['search_enabled'] = this.filterSearch() === 'true';
    }
    if (this.filterDateFrom()) query['date_from'] = this.filterDateFrom();
    if (this.filterDateTo()) query['date_to'] = this.filterDateTo();

    this.batchService.getResults(query as never).subscribe({
      next: (res) => {
        if (res.success) {
          this.rows.set(res.data.rows);
          this.total.set(res.data.total);
          this.filteredTotal.set(res.data.filtered_total);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load results');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadResults();
  }

  clearFilters(): void {
    this.filterModel.set('');
    this.filterSearch.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilters();
  }

  clearResults(): void {
    this.batchService.clearResults().subscribe({
      next: () => {
        this.loadStatus();
        this.loadResults();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to clear results');
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadResults();
  }

  triggerRun(): void {
    this.runLoading.set(true);
    this.startStatusPolling();
    this.batchService.triggerRun().subscribe({
      next: () => {
        this.runLoading.set(false);
        this.stopStatusPolling();
        this.loadStatus();
        this.loadResults();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to trigger run');
        this.runLoading.set(false);
        this.stopStatusPolling();
        this.loadStatus();
      },
    });
  }

  stopRun(): void {
    this.batchService.stopRun().subscribe({
      next: () => {
        this.loadStatus();
        this.loadResults();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to stop run');
      },
    });
  }

  downloadCsv(): void {
    this.batchService.downloadCsv();
  }

  toggleQuestions(): void {
    this.showQuestions.set(!this.showQuestions());
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
    this.uploadError.set(null);
  }

  uploadCsv(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploadLoading.set(true);
    this.uploadError.set(null);
    this.batchService.uploadQuestions(file).subscribe({
      next: (res) => {
        if (res.success) {
          this.questions.set(res.data);
          this.isCustomQuestions.set(true);
          this.selectedFile.set(null);
          this.loadStatus();
        }
        this.uploadLoading.set(false);
      },
      error: (err) => {
        this.uploadError.set(err?.error?.message || 'Upload failed');
        this.uploadLoading.set(false);
      },
    });
  }

  removeCustomQuestions(): void {
    this.uploadLoading.set(true);
    this.batchService.removeCustomQuestions().subscribe({
      next: () => {
        this.isCustomQuestions.set(false);
        this.loadQuestions();
        this.loadStatus();
        this.uploadLoading.set(false);
      },
      error: (err) => {
        this.uploadError.set(err?.error?.message || 'Failed to revert');
        this.uploadLoading.set(false);
      },
    });
  }

  toggleSchedule(): void {
    const newEnabled = !this.scheduleEnabled();
    this.scheduleEnabled.set(newEnabled);
    this.saveSchedule({ enabled: newEnabled, utc_hour: this.scheduleHour() });
  }

  updateScheduleHour(hour: number): void {
    this.scheduleHour.set(hour);
    this.saveSchedule({ enabled: this.scheduleEnabled(), utc_hour: hour });
  }

  private saveSchedule(config: BatchScheduleConfig): void {
    this.scheduleLoading.set(true);
    this.batchService.updateSchedule(config).subscribe({
      next: () => {
        this.scheduleLoading.set(false);
        this.loadStatus();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to update schedule');
        this.scheduleLoading.set(false);
      },
    });
  }

  getModelBadgeClass(model: BatchModelName): string {
    switch (model) {
      case 'claude':
        return 'badge-claude';
      case 'gpt':
        return 'badge-gpt';
      case 'gemini':
        return 'badge-gemini';
      default:
        return 'bg-secondary';
    }
  }

  truncate(text: string, max = 120): string {
    if (text.length <= max) return text;
    return text.substring(0, max) + '...';
  }
}
