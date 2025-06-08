import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { AnalysisEngineModule } from '../analysis-engine/analysis-engine.module';
import { MlPredictionModule } from '../ml-prediction/ml-prediction.module';

@Module({
  imports: [
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class SchedulingModule {}
