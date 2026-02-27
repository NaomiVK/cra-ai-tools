import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  BatchRunStatus,
  BatchResultsResponse,
  BatchResultsQuery,
  BatchQuestion,
  BatchScheduleConfig,
} from '@cra-ai-tools/shared-types';

@Injectable({ providedIn: 'root' })
export class LlmBatchService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<BatchRunStatus> {
    return this.http.get<BatchRunStatus>('/api/llm-batch/status');
  }

  getResults(query: BatchResultsQuery): Observable<BatchResultsResponse> {
    let params = new HttpParams();
    if (query.model) params = params.set('model', query.model);
    if (query.search_enabled !== undefined)
      params = params.set('search_enabled', String(query.search_enabled));
    if (query.question_id) params = params.set('question_id', query.question_id);
    if (query.date_from) params = params.set('date_from', query.date_from);
    if (query.date_to) params = params.set('date_to', query.date_to);
    if (query.limit) params = params.set('limit', String(query.limit));
    if (query.offset) params = params.set('offset', String(query.offset));

    return this.http.get<BatchResultsResponse>('/api/llm-batch/results', {
      params,
    });
  }

  triggerRun(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      '/api/llm-batch/run',
      {}
    );
  }

  stopRun(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      '/api/llm-batch/stop',
      {}
    );
  }

  getQuestions(): Observable<{ success: boolean; data: BatchQuestion[]; is_custom: boolean }> {
    return this.http.get<{ success: boolean; data: BatchQuestion[]; is_custom: boolean }>(
      '/api/llm-batch/questions'
    );
  }

  uploadQuestions(file: File): Observable<{ success: boolean; data: BatchQuestion[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; data: BatchQuestion[] }>(
      '/api/llm-batch/questions/upload',
      formData
    );
  }

  removeCustomQuestions(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      '/api/llm-batch/questions/custom'
    );
  }

  clearResults(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      '/api/llm-batch/results'
    );
  }

  getSchedule(): Observable<BatchScheduleConfig> {
    return this.http.get<BatchScheduleConfig>('/api/llm-batch/schedule');
  }

  updateSchedule(config: BatchScheduleConfig): Observable<BatchScheduleConfig> {
    return this.http.put<BatchScheduleConfig>('/api/llm-batch/schedule', config);
  }

  downloadCsv(): void {
    window.open('/api/llm-batch/results/download', '_blank');
  }
}
