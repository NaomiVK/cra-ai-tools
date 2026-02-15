import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { EvaluationResult } from '@cra-ai-tools/shared-types';

@Injectable({ providedIn: 'root' })
export class EvaluatorService {
  private readonly http = inject(HttpClient);

  analyzeUrl(url: string, includeLlm = false): Observable<EvaluationResult> {
    return this.http.post<EvaluationResult>('/api/analyze-url', {
      url,
      include_llm: includeLlm,
    });
  }
}
