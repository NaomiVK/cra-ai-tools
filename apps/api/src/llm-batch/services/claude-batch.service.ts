import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface BatchCallResult {
  response_text: string;
  response_tokens: number;
  latency_ms: number;
  search_actually_used: boolean;
  error: string;
}

@Injectable()
export class ClaudeBatchService {
  private readonly logger = new Logger(ClaudeBatchService.name);
  private client: Anthropic | null = null;
  private readonly model = 'claude-opus-4-6';

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async callWithoutSearch(question: string): Promise<BatchCallResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: question }],
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );
      const responseText = textBlocks.map((b) => b.text).join('\n');

      return {
        response_text: responseText,
        response_tokens: response.usage.output_tokens,
        latency_ms: Date.now() - start,
        search_actually_used: false,
        error: '',
      };
    } catch (err) {
      this.logger.error(
        `Claude (no search) failed: ${(err as Error).message}`
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
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system:
          'You MUST use the web_search tool before answering. Always search the web first to get the most current information.',
        tools: [
          { type: 'web_search_20260209', name: 'web_search' } as never,
        ],
        messages: [{ role: 'user', content: question }],
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );
      const responseText = textBlocks.map((b) => b.text).join('\n');

      // Detect if web search was actually used
      const searchUsed = response.content.some(
        (b) => b.type === 'server_tool_use' || b.type === 'web_search_tool_result'
      );

      return {
        response_text: responseText,
        response_tokens: response.usage.output_tokens,
        latency_ms: Date.now() - start,
        search_actually_used: searchUsed,
        error: '',
      };
    } catch (err) {
      this.logger.error(
        `Claude (with search) failed: ${(err as Error).message}`
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
