import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmEvaluatorModule } from '../llm-evaluator/llm-evaluator.module';
import { SimiTrackModule } from '../simitrack/simitrack.module';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LlmEvaluatorModule,
    SimiTrackModule,
    HealthModule,
  ],
})
export class AppModule {}
