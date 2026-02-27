import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Query,
  Res,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import type {
  BatchRunStatus,
  BatchResultsResponse,
  BatchResultsQuery,
  BatchModelName,
  BatchQuestion,
  BatchScheduleConfig,
} from '@cra-ai-tools/shared-types';
import { BatchSchedulerService } from './services/batch-scheduler.service';
import { readCsv, parseQuestionsCsv, saveCustomQuestions } from './utils/csv.util';

@Controller('llm-batch')
export class LlmBatchController {
  constructor(private readonly scheduler: BatchSchedulerService) {}

  @Get('status')
  getStatus(): BatchRunStatus {
    const { questions, isCustom } = this.scheduler.getActiveQuestions();
    const schedule = this.scheduler.getSchedule();
    return {
      last_run_at: this.scheduler.lastRun,
      next_run_at: this.scheduler.getNextRunTime(),
      total_rows: this.scheduler.totalRows,
      is_running: this.scheduler.running,
      questions_count: questions.length,
      is_custom_questions: isCustom,
      schedule_enabled: schedule.enabled,
      schedule_utc_hour: schedule.utc_hour,
    };
  }

  @Get('results')
  getResults(
    @Query('model') model?: string,
    @Query('search_enabled') searchEnabled?: string,
    @Query('question_id') questionId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): BatchResultsResponse {
    const query: BatchResultsQuery = {};
    if (model && ['claude', 'gpt', 'gemini'].includes(model)) {
      query.model = model as BatchModelName;
    }
    if (searchEnabled === 'true') query.search_enabled = true;
    if (searchEnabled === 'false') query.search_enabled = false;
    if (questionId) query.question_id = questionId;
    if (dateFrom) query.date_from = dateFrom;
    if (dateTo) query.date_to = dateTo;
    if (limit) query.limit = parseInt(limit, 10) || 50;
    if (offset) query.offset = parseInt(offset, 10) || 0;

    const result = readCsv(this.scheduler.csvPath, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get('results/download')
  downloadCsv(@Res() res: express.Response): void {
    const csvPath = this.scheduler.csvPath;
    if (!fs.existsSync(csvPath)) {
      throw new HttpException(
        'No CSV file available yet. Run a batch first.',
        HttpStatus.NOT_FOUND
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=batch-results.csv'
    );

    const stream = fs.createReadStream(csvPath);
    stream.pipe(res);
  }

  @Post('run')
  async triggerRun(): Promise<{ success: boolean; message: string }> {
    const result = await this.scheduler.runBatch();
    return { success: result.started, message: result.message };
  }

  @Delete('results')
  clearResults(): { success: boolean; message: string } {
    const csvPath = this.scheduler.csvPath;
    if (fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }
    return { success: true, message: 'Results cleared' };
  }

  @Post('stop')
  stopRun(): { success: boolean; message: string } {
    const stopped = this.scheduler.stopBatch();
    return {
      success: stopped,
      message: stopped ? 'Stop requested' : 'No batch is running',
    };
  }

  @Get('questions')
  getQuestions(): { success: boolean; data: BatchQuestion[]; is_custom: boolean } {
    const { questions, isCustom } = this.scheduler.getActiveQuestions();
    return { success: true, data: questions, is_custom: isCustom };
  }

  @Post('questions/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadQuestions(
    @UploadedFile() file: Express.Multer.File
  ): { success: boolean; data: BatchQuestion[] } {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    if (!file.originalname.endsWith('.csv')) {
      throw new HttpException('File must be a CSV', HttpStatus.BAD_REQUEST);
    }

    const content = file.buffer.toString('utf-8');
    let questions: BatchQuestion[];
    try {
      questions = parseQuestionsCsv(content);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST
      );
    }

    saveCustomQuestions(this.scheduler.customQuestionsPath, questions);
    return { success: true, data: questions };
  }

  @Delete('questions/custom')
  removeCustomQuestions(): { success: boolean; message: string } {
    const filePath = this.scheduler.customQuestionsPath;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true, message: 'Reverted to default questions' };
  }

  @Get('schedule')
  getSchedule(): BatchScheduleConfig {
    return this.scheduler.getSchedule();
  }

  @Put('schedule')
  updateSchedule(@Body() body: BatchScheduleConfig): BatchScheduleConfig {
    return this.scheduler.updateSchedule(body);
  }
}
