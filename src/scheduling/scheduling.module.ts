import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CronMonitoringService } from './cron-monitoring.service';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { AnalysisEngineModule } from '../analysis-engine/analysis-engine.module';
import { MlPredictionModule } from '../ml-prediction/ml-prediction.module';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
    CommonModule,
    ConfigModule,
  ],
  providers: [TasksService, CronMonitoringService],
  exports: [TasksService, CronMonitoringService],
})
export class SchedulingModule {}
