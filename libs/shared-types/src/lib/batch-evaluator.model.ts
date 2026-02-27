export type BatchModelName = 'claude' | 'gpt' | 'gemini';

export interface BatchQuestion {
  id: string;
  text: string;
}

export interface BatchResultRow {
  timestamp: string;
  question_id: string;
  question_text: string;
  model_name: BatchModelName;
  search_enabled: boolean;
  search_actually_used: boolean;
  response_text: string;
  response_tokens: number;
  latency_ms: number;
  error: string;
}

export interface BatchRunStatus {
  last_run_at: string | null;
  next_run_at: string | null;
  total_rows: number;
  is_running: boolean;
  questions_count: number;
  is_custom_questions: boolean;
  schedule_enabled: boolean;
  schedule_utc_hour: number;
}

export interface BatchScheduleConfig {
  enabled: boolean;
  utc_hour: number;
}

export interface BatchResultsResponse {
  success: boolean;
  data: {
    rows: BatchResultRow[];
    total: number;
    filtered_total: number;
  };
  error?: string;
}

export interface BatchResultsQuery {
  model?: BatchModelName;
  search_enabled?: boolean;
  question_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}
