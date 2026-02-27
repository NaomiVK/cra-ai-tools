import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type { BatchCallResult } from './claude-batch.service';

@Injectable()
export class GeminiBatchService {
  private readonly logger = new Logger(GeminiBatchService.name);
  private client: GoogleGenAI | null = null;
  private readonly model = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {}

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async callWithoutSearch(question: string): Promise<BatchCallResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: this.model,
        contents: question,
      });

      const responseText = response.text ?? '';

      return {
        response_text: responseText,
        response_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latency_ms: Date.now() - start,
        search_actually_used: false,
        error: '',
      };
    } catch (err) {
      this.logger.error(
        `Gemini (no search) failed: ${(err as Error).message}`
      );
      return {
        response_text: '',
        response_tokens: 0,
        latency_ms: Date.now() - start,
        search_actually_used: false,
        error: (err as Error).message,
      };
    }
  }

  async callWithSearch(question: string): Promise<BatchCallResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: this.model,
        contents: question,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = response.text ?? '';

      // Detect if Google Search grounding was actually used
      const candidate = response.candidates?.[0];
      const searchUsed =
        !!candidate?.groundingMetadata?.groundingChunks?.length;

      return {
        response_text: responseText,
        response_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latency_ms: Date.now() - start,
        search_actually_used: searchUsed,
        error: '',
      };
    } catch (err) {
      this.logger.error(
        `Gemini (with search) failed: ${(err as Error).message}`
      );
      return {
        response_text: '',
        response_tokens: 0,
        latency_ms: Date.now() - start,
        search_actually_used: false,
        error: (err as Error).message,
      };
    }
  }
}
