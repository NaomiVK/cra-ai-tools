import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openaiClient: OpenAI | null = null;
  private readonly model = 'text-embedding-3-large';

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.openaiClient) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.openaiClient = new OpenAI({ apiKey });
    }
    return this.openaiClient;
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      const client = this.getClient();
      const response = await client.embeddings.create({
        model: this.model,
        input: text.slice(0, 8000),
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Embedding failed: ${(error as Error).message}`);
      return [];
    }
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    try {
      const client = this.getClient();
      const truncatedTexts = texts.map((t) => (t || '').slice(0, 8000));
      const response = await client.embeddings.create({
        model: this.model,
        input: truncatedTexts,
      });
      return response.data.map((d) => d.embedding);
    } catch (error) {
      this.logger.error(`Batch embedding failed: ${(error as Error).message}`);
      return texts.map(() => []);
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (!a?.length || !b?.length || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
