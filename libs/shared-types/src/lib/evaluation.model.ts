export interface HeuristicScore {
  score: number; // 0-100
  details: string[];
  issues: string[];
}

export interface LLMEvaluation {
  extractability: { score: number; notes: string };
  citation_worthiness: { score: number; notes: string };
  query_relevance: { score: number; notes: string };
  structure_quality: { score: number; notes: string };
  authority_signals: { score: number; notes: string };
  overall_score: number;
  improvements: string[];
  examples: string[];
}

export interface ActionableItem {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  code_example?: string;
}

export interface HeuristicsResult {
  semantic_html: HeuristicScore;
  structured_data: HeuristicScore;
  content_clarity: HeuristicScore;
  citation_markers: HeuristicScore;
  factual_density: HeuristicScore;
  overall: number;
}

export interface LLMResults {
  claude: LLMEvaluation | null;
  gpt: LLMEvaluation | null;
  gemini: LLMEvaluation | null;
  consensus_score: number | null;
}

export interface EvaluationResult {
  overall_score: number; // 0-100
  heuristics: HeuristicsResult;
  llm_evaluations: LLMResults;
  actionable_items: ActionableItem[];
  metadata: {
    url?: string;
    filename?: string;
    analyzed_at: string;
    analysis_duration_ms: number;
    llm_enabled: boolean;
    llm_models_succeeded?: number;
    score_composition?: 'heuristics_only' | 'blended';
  };
}

export interface ParsedPage {
  html: string;
  title: string;
  headings: { level: number; text: string }[];
  landmarks: { tag: string; role?: string }[];
  semanticElements: { tag: string; count: number }[];
  divCount: number;
  lists: { tag: string; itemCount: number }[];
  tables: { hasHead: boolean; hasBody: boolean; hasScopeHeaders: boolean }[];
  jsonLd: object[];
  microdata: { type: string }[];
  openGraph: Record<string, string>;
  metaTags: Record<string, string>;
  links: { href: string; text: string; isExternal: boolean }[];
  paragraphs: string[];
  sentences: string[];
  textContent: string;
  navTextLength: number;
  mainTextLength: number;
  totalTextLength: number;
}

export interface AnalyzerResult {
  score: HeuristicScore;
  actionableItems: ActionableItem[];
}
