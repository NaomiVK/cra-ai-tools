import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as path from 'path';
import * as fs from 'fs';
import type {
  BatchModelName,
  BatchResultRow,
  BatchScheduleConfig,
} from '@cra-ai-tools/shared-types';
import { ClaudeBatchService } from './claude-batch.service';
import { OpenAiBatchService } from './openai-batch.service';
import { GeminiBatchService } from './gemini-batch.service';
import { appendToCsv, getCsvRowCount, loadCustomQuestions } from '../utils/csv.util';
import type { BatchCallResult } from './claude-batch.service';

const CSV_FILE = path.resolve(process.cwd(), 'data', 'batch-results.csv');
const CUSTOM_QUESTIONS_FILE = path.resolve(process.cwd(), 'data', 'custom-questions.csv');
const SCHEDULE_FILE = path.resolve(process.cwd(), 'data', 'batch-schedule.json');
const DELAY_MS = 2000;
const DEFAULT_SCHEDULE: BatchScheduleConfig = { enabled: false, utc_hour: 6 };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class BatchSchedulerService {
  private readonly logger = new Logger(BatchSchedulerService.name);
  private isRunning = false;
  private abortRequested = false;
  private lastRunAt: string | null = null;

  constructor(
    private readonly claudeService: ClaudeBatchService,
    private readonly openaiService: OpenAiBatchService,
    private readonly geminiService: GeminiBatchService
  ) {}

  get running(): boolean {
    return this.isRunning;
  }

  get lastRun(): string | null {
    return this.lastRunAt;
  }

  get csvPath(): string {
    return CSV_FILE;
  }

  get totalRows(): number {
    return getCsvRowCount(CSV_FILE);
  }

  get customQuestionsPath(): string {
    return CUSTOM_QUESTIONS_FILE;
  }

  getActiveQuestions(): { questions: import('@cra-ai-tools/shared-types').BatchQuestion[]; isCustom: boolean } {
    const custom = loadCustomQuestions(CUSTOM_QUESTIONS_FILE);
    return { questions: custom ?? [], isCustom: custom !== null };
  }

  getSchedule(): BatchScheduleConfig {
    try {
      const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
      return JSON.parse(raw) as BatchScheduleConfig;
    } catch {
      return { ...DEFAULT_SCHEDULE };
    }
  }

  updateSchedule(config: BatchScheduleConfig): BatchScheduleConfig {
    const dir = path.dirname(SCHEDULE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const validated: BatchScheduleConfig = {
      enabled: Boolean(config.enabled),
      utc_hour: Math.max(0, Math.min(23, Math.floor(Number(config.utc_hour) || 0))),
    };
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(validated, null, 2));
    return validated;
  }

  getNextRunTime(): string | null {
    const schedule = this.getSchedule();
    if (!schedule.enabled) return null;
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(schedule.utc_hour, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.toISOString();
  }

  stopBatch(): boolean {
    if (!this.isRunning) return false;
    this.abortRequested = true;
    this.logger.log('Batch stop requested');
    return true;
  }

  @Cron('0 * * * *')
  async handleDailyCron(): Promise<void> {
    const schedule = this.getSchedule();
    if (!schedule.enabled) return;
    const currentHour = new Date().getUTCHours();
    if (currentHour !== schedule.utc_hour) return;
    this.logger.log(`Scheduled cron triggered (UTC hour ${schedule.utc_hour}) — starting batch run`);
    await this.runBatch();
  }

  async runBatch(): Promise<{ started: boolean; message: string }> {
    if (this.isRunning) {
      return { started: false, message: 'Batch is already running' };
    }

    this.isRunning = true;
    this.abortRequested = false;
    const { questions: activeQuestions, isCustom } = this.getActiveQuestions();
    this.logger.log(
      `Starting batch run: ${activeQuestions.length} questions × 3 models × 2 modes (${isCustom ? 'custom' : 'default'})`
    );

    const models: {
      name: BatchModelName;
      callWithout: (q: string) => Promise<BatchCallResult>;
      callWith: (q: string) => Promise<BatchCallResult>;
    }[] = [
      {
        name: 'claude',
        callWithout: (q) => this.claudeService.callWithoutSearch(q),
        callWith: (q) => this.claudeService.callWithSearch(q),
      },
      {
        name: 'gpt',
        callWithout: (q) => this.openaiService.callWithoutSearch(q),
        callWith: (q) => this.openaiService.callWithSearch(q),
      },
      {
        name: 'gemini',
        callWithout: (q) => this.geminiService.callWithoutSearch(q),
        callWith: (q) => this.geminiService.callWithSearch(q),
      },
    ];

    let completed = 0;
    const total = activeQuestions.length * models.length * 2;

    try {
      for (const question of activeQuestions) {
        for (const model of models) {
          for (const searchEnabled of [false, true]) {
            if (this.abortRequested) {
              this.logger.log(`Batch stopped after ${completed} calls`);
              return { started: true, message: `Batch stopped after ${completed} calls` };
            }

            const callFn = searchEnabled ? model.callWith : model.callWithout;
            const timestamp = new Date().toISOString();

            this.logger.log(
              `[${++completed}/${total}] ${model.name} | search=${searchEnabled} | ${question.id}`
            );

            const result = await callFn(question.text);

            const row: BatchResultRow = {
              timestamp,
              question_id: question.id,
              question_text: question.text,
              model_name: model.name,
              search_enabled: searchEnabled,
              search_actually_used: result.search_actually_used,
              response_text: result.response_text,
              response_tokens: result.response_tokens,
              latency_ms: result.latency_ms,
              error: result.error,
            };

            appendToCsv(CSV_FILE, [row]);

            if (completed < total) {
              await delay(DELAY_MS);
            }
          }
        }
      }

      this.lastRunAt = new Date().toISOString();
      this.logger.log(
        `Batch run complete: ${completed} calls, total CSV rows: ${this.totalRows}`
      );
      return { started: true, message: `Batch complete: ${completed} calls` };
    } catch (err) {
      this.logger.error(`Batch run failed: ${(err as Error).message}`);
      return {
        started: true,
        message: `Batch failed after ${completed} calls: ${(err as Error).message}`,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
