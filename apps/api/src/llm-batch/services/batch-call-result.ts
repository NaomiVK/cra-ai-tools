export interface BatchCallResult {
  response_text: string;
  response_tokens: number;
  latency_ms: number;
  search_actually_used: boolean;
  error: string;
}
