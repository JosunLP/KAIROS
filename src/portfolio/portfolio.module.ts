import { Module } from '@nestjs/common';
import { AnalysisEngineModule } from '../analysis-engine/analysis-engine.module';
import { CommonModule } from '../common/common.module';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { BacktestService } from './backtest.service';
import { PortfolioService } from './portfolio.service';
import { RiskManagementService } from './risk-management.service';

@Module({
  imports: [
    PersistenceModule,
    AnalysisEngineModule,
    DataIngestionModule,
    CommonModule,
  ],
  providers: [PortfolioService, BacktestService, RiskManagementService],
  exports: [PortfolioService, BacktestService, RiskManagementService],
})
export class PortfolioModule {}
