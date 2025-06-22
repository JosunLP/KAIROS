import { Module } from '@nestjs/common';
import { AnalysisEngineModule } from '../analysis-engine/analysis-engine.module';
import { AutomationModule } from '../automation/automation.module';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { HealthModule } from '../health/health.module';
import { MlPredictionModule } from '../ml-prediction/ml-prediction.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SimpleCliService } from './simple-cli.service';

@Module({
  imports: [
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
    SchedulingModule,
    PersistenceModule,
    PortfolioModule,
    AutomationModule,
    CommonModule,
    ConfigModule,
    HealthModule,
  ],
  providers: [SimpleCliService],
  exports: [SimpleCliService],
})
export class CliModule {}
