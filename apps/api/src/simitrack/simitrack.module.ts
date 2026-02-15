import { Module } from '@nestjs/common';
import { SimiTrackController } from './simitrack.controller';
import { ContentSimilarityService } from './services/content-similarity.service';
import { EmbeddingService } from './services/embedding.service';

@Module({
  controllers: [SimiTrackController],
  providers: [ContentSimilarityService, EmbeddingService],
})
export class SimiTrackModule {}
