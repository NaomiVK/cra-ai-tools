import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { parseHTML } from './utils/html-parser.util';
import { PageFetcherService } from './services/page-fetcher.service';
import { ScoringService } from './services/scoring.service';
import type { EvaluationResult } from '@cra-ai-tools/shared-types';

@Controller()
export class LlmEvaluatorController {
  constructor(
    private readonly pageFetcherService: PageFetcherService,
    private readonly scoringService: ScoringService,
  ) {}

  @Post('analyze-url')
  async analyzeUrl(
    @Body() body: { url?: string; include_llm?: boolean },
  ): Promise<EvaluationResult> {
    const { url, include_llm } = body;
    if (!url || typeof url !== 'string') {
      throw new BadRequestException('Missing or invalid "url" in request body');
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    const html = await this.pageFetcherService.fetch(url);
    const page = parseHTML(html, url);
    return this.scoringService.evaluate(page, { url, includeLlm: !!include_llm });
  }

  @Post('analyze-html')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async analyzeHtml(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { include_llm?: string },
  ): Promise<EvaluationResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded. Use form field "file".');
    }

    const includeLlm = body?.include_llm === 'true';
    const html = file.buffer.toString('utf-8');
    const page = parseHTML(html);
    return this.scoringService.evaluate(page, {
      filename: file.originalname,
      includeLlm,
    });
  }
}
