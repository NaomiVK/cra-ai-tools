export interface ContentPage {
  url: string;
  title: string;
  h1: string;
  intro_text: string;
  body_text: string;
  embeddings?: {
    title: number[];
    intro: number[];
    body: number[];
    full: number[];
  };
  fetchError?: string;
}

export interface SimilarityScore {
  url_a: string;
  url_b: string;
  title_similarity: number;
  intro_similarity: number;
  body_similarity: number;
  full_similarity: number;
}

export type SimilarityClassification =
  | 'Definite Duplicate'
  | 'Near Duplicate'
  | 'Intent Collision'
  | 'Potential Cannibalization'
  | 'Template Overlap'
  | 'Unique';

export interface ContentRelationship {
  url_a: string;
  url_b: string;
  classification: SimilarityClassification;
  confidence: number;
  similarity_summary: {
    title: number;
    intro: number;
    body: number;
    full: number;
  };
  recommended_action: string;
  reasoning: string;
}

export interface IntentCluster {
  primary_url: string;
  cluster_urls: string[];
  reasoning: string;
}

export interface ContentSimilarityResult {
  relationships: ContentRelationship[];
  intent_collision_clusters: IntentCluster[];
  pages_analyzed: number;
  pages_failed: number;
  failed_urls?: string[];
}

export interface AnalyzeUrlsRequest {
  urls: string[];
}

export interface SimiTrackApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
