import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { BatchCallResult } from './claude-batch.service';

@Injectable()
export class OpenAiBatchService {
  private readonly logger = new Logger(OpenAiBatchService.name);
  private client: OpenAI | null = null;
  private readonly model = 'gpt-4.1';

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async callWithoutSearch(question: string): Promise<BatchCallResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const response = await client.responses.create({
        model: this.model,
        input: question,
      });

      const textItems = response.output.filter(
        (item): item is OpenAI.Responses.ResponseOutputMessage =>
          item.type === 'message'
      );
      const responseText = textItems
        .flatMap((m) =>
          m.content
            .filter(
              (c): c is OpenAI.Responses.ResponseOutputText =>
                c.type === 'output_text'
            )
            .map((c) => c.text)
        )
        .join('\n');

      return {
        response_text: responseText,
        response_tokens: response.usage?.output_tokens ?? 0,
        latency_ms: Date.now() - start,
        search_actually_used: false,
        error: '',
      };
    } catch (err) {
      this.logger.error(`GPT (no search) failed: ${(err as Error).message}`);
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
      const response = await client.responses.create({
        model: this.model,
        input: question,
        tools: [{ type: 'web_search_preview' }],
      });

      const textItems = response.output.filter(
        (item): item is OpenAI.Responses.ResponseOutputMessage =>
          item.type === 'message'
      );
      const responseText = textItems
        .flatMap((m) =>
          m.content
            .filter(
              (c): c is OpenAI.Responses.ResponseOutputText =>
                c.type === 'output_text'
            )
            .map((c) => c.text)
        )
        .join('\n');

      // Detect if web search was actually used
      const searchUsed = response.output.some(
        (item) => item.type === 'web_search_call'
      );

      return {
        response_text: responseText,
        response_tokens: response.usage?.output_tokens ?? 0,
        latency_ms: Date.now() - start,
        search_actually_used: searchUsed,
        error: '',
      };
    } catch (err) {
      this.logger.error(`GPT (with search) failed: ${(err as Error).message}`);
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
