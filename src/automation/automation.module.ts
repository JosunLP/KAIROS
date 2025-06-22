import { Module } from '@nestjs/common';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { AnalysisEngineModule } from '../analysis-engine/analysis-engine.module';
import { MlPredictionModule } from '../ml-prediction/ml-prediction.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { CommonModule } from '../common/common.module';
import { AutomationService } from './automation.service';

@Module({
  imports: [
    CommonModule,
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
    PortfolioModule,
    PersistenceModule,
    SchedulingModule,
  ],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
