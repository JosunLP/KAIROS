import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { BacktestService } from './backtest.service';
import { RiskManagementService } from './risk-management.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { AnalysisEngineModule } from '../analysis-engine/analysis-engine.module';

@Module({
  imports: [PersistenceModule, AnalysisEngineModule],
  providers: [PortfolioService, BacktestService, RiskManagementService],
  exports: [PortfolioService, BacktestService, RiskManagementService],
})
export class PortfolioModule {}
