import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LlmEvaluatorModule } from '../llm-evaluator/llm-evaluator.module';
import { SimiTrackModule } from '../simitrack/simitrack.module';
import { HealthModule } from '../health/health.module';
import { LlmBatchModule } from '../llm-batch/llm-batch.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LlmEvaluatorModule,
    SimiTrackModule,
    HealthModule,
    LlmBatchModule,
  ],
})
export class AppModule {}
