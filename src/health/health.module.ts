import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { MlPredictionModule } from '../ml-prediction/ml-prediction.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { HealthService } from './health.service';

@Module({
  imports: [
    PersistenceModule,
    ConfigModule,
    CommonModule,
    DataIngestionModule,
    MlPredictionModule,
  ],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
