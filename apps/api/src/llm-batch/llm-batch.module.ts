import { Module } from '@nestjs/common';
import { LlmBatchController } from './llm-batch.controller';
import { BatchSchedulerService } from './services/batch-scheduler.service';
import { ClaudeBatchService } from './services/claude-batch.service';
import { OpenAiBatchService } from './services/openai-batch.service';
import { GeminiBatchService } from './services/gemini-batch.service';

@Module({
  controllers: [LlmBatchController],
  providers: [
    BatchSchedulerService,
    ClaudeBatchService,
    OpenAiBatchService,
    GeminiBatchService,
  ],
})
export class LlmBatchModule {}
