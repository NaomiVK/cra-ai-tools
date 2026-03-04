import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentSimilarityService } from './services/content-similarity.service';
import type {
  AnalyzeUrlsRequest,
  ContentSimilarityResult,
  SimiTrackApiResponse,
} from '@cra-ai-tools/shared-types';

@Controller('simitrack')
export class SimiTrackController {
  constructor(
    private readonly contentSimilarityService: ContentSimilarityService,
    private readonly configService: ConfigService
  ) {}

  @Post('analyze')
  async analyzeUrls(
    @Body() body: AnalyzeUrlsRequest
  ): Promise<SimiTrackApiResponse<ContentSimilarityResult>> {
    if (!body.urls || !Array.isArray(body.urls) || body.urls.length < 2) {
      throw new HttpException(
        'At least 2 URLs are required',
        HttpStatus.BAD_REQUEST
      );
    }

    if (body.urls.length > 50) {
      throw new HttpException(
        'Maximum 50 URLs per request',
        HttpStatus.BAD_REQUEST
      );
    }

    const validUrls = [
      ...new Set(body.urls.filter((url) => url.startsWith('http'))),
    ];
    if (validUrls.length < 2) {
      throw new HttpException(
        'At least 2 valid unique URLs (starting with http) are required',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const result =
        await this.contentSimilarityService.analyzeUrls(validUrls);
      return { success: true, data: result };
    } catch (error) {
      throw new HttpException(
        `Analysis failed: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  getStatus(): SimiTrackApiResponse<{ ready: boolean; message: string }> {
    const hasGemini = !!this.configService.get<string>('GEMINI_API_KEY');
    const hasOpenAI = !!this.configService.get<string>('OPENAI_API_KEY');
    const ready = hasGemini && hasOpenAI;

    return {
      success: true,
      data: {
        ready,
        message: ready
          ? 'SimiTrack content similarity service is ready'
          : `Missing API keys: ${[!hasGemini && 'GEMINI_API_KEY', !hasOpenAI && 'OPENAI_API_KEY'].filter(Boolean).join(', ')}`,
      },
    };
  }
}
