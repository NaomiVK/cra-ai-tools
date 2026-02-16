import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LLMResults, LLMEvaluation, ParsedPage } from '@cra-ai-tools/shared-types';
import { condensePage } from '../utils/content-condenser.util';
import { LLM_EVAL_SYSTEM_PROMPT, buildUserPrompt } from '../utils/llm-prompt.util';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = {
  claude: 'anthropic/claude-4.5-sonnet',
  gpt: 'openai/gpt-5.1-chat',
  gemini: 'google/gemini-3-flash-preview',
} as const;

type ModelKey = keyof typeof MODELS;

const TIMEOUT_MS = 30_000;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
  }

  async evaluate(page: ParsedPage): Promise<LLMResults> {
    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set — skipping LLM evaluation');
      return { claude: null, gpt: null, gemini: null, consensus_score: null };
    }

    const condensed = condensePage(page);
    const userPrompt = buildUserPrompt(condensed);

    const results = await Promise.allSettled(
      (Object.keys(MODELS) as ModelKey[]).map((key) =>
        this.callModel(MODELS[key], userPrompt).then((eval_) => ({ key, eval_ }))
      )
    );

    const llmResults: LLMResults = {
      claude: null,
      gpt: null,
      gemini: null,
      consensus_score: null,
    };

    const scores: number[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.eval_) {
        const { key, eval_ } = result.value;
        llmResults[key] = eval_;
        scores.push(eval_.overall_score);
      } else if (result.status === 'rejected') {
        this.logger.warn(`LLM model call failed: ${result.reason}`);
      }
    }

    llmResults.consensus_score = this.computeConsensus(scores);

    return llmResults;
  }

  private async callModel(model: string, userPrompt: string): Promise<LLMEvaluation | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: LLM_EVAL_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.warn(`OpenRouter ${model} returned ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn(`OpenRouter ${model}: no content in response`);
        return null;
      }

      return this.parseEvaluation(content, model);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`OpenRouter ${model}: timed out after ${TIMEOUT_MS}ms`);
      } else {
        this.logger.warn(`OpenRouter ${model}: ${(err as Error).message}`);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseEvaluation(content: string, model: string): LLMEvaluation | null {
    try {
      // Strip markdown code fencing if present
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      // Validate required fields exist
      const dimensions = [
        'extractability',
        'citation_worthiness',
        'query_relevance',
        'structure_quality',
        'authority_signals',
      ] as const;

      for (const dim of dimensions) {
        if (!parsed[dim] || typeof parsed[dim].score !== 'number') {
          this.logger.warn(`OpenRouter ${model}: missing or invalid dimension "${dim}"`);
          return null;
        }
        parsed[dim].score = this.clamp(parsed[dim].score);
      }

      if (typeof parsed.overall_score !== 'number') {
        this.logger.warn(`OpenRouter ${model}: missing overall_score`);
        return null;
      }
      parsed.overall_score = this.clamp(parsed.overall_score);

      return {
        extractability: parsed.extractability,
        citation_worthiness: parsed.citation_worthiness,
        query_relevance: parsed.query_relevance,
        structure_quality: parsed.structure_quality,
        authority_signals: parsed.authority_signals,
        overall_score: parsed.overall_score,
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      };
    } catch {
      this.logger.warn(`OpenRouter ${model}: failed to parse JSON response`);
      return null;
    }
  }

  private computeConsensus(scores: number[]): number | null {
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
