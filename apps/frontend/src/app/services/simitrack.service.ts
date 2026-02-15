import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  ContentSimilarityResult,
  SimiTrackApiResponse,
} from '@cra-ai-tools/shared-types';

@Injectable({ providedIn: 'root' })
export class SimiTrackService {
  private readonly http = inject(HttpClient);

  analyzeUrls(
    urls: string[]
  ): Observable<SimiTrackApiResponse<ContentSimilarityResult>> {
    return this.http.post<SimiTrackApiResponse<ContentSimilarityResult>>(
      '/api/simitrack/analyze',
      { urls }
    );
  }

  getStatus(): Observable<
    SimiTrackApiResponse<{ ready: boolean; message: string }>
  > {
    return this.http.get<
      SimiTrackApiResponse<{ ready: boolean; message: string }>
    >('/api/simitrack/status');
  }
}
