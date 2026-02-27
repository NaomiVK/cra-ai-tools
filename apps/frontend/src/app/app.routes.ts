import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'llm-evaluator',
    loadComponent: () =>
      import('./pages/llm-evaluator/llm-evaluator.component').then(
        (m) => m.LlmEvaluatorComponent
      ),
  },
  {
    path: 'simi-track',
    loadComponent: () =>
      import('./pages/simi-track/simi-track.component').then(
        (m) => m.SimiTrackComponent
      ),
  },
  {
    path: 'llm-batch',
    loadComponent: () =>
      import('./pages/llm-batch/llm-batch.component').then(
        (m) => m.LlmBatchComponent
      ),
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' },
];
