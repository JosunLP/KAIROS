import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Eigene Module
import { AnalysisEngineModule } from './analysis-engine/analysis-engine.module';
import { AutomationModule } from './automation/automation.module';
import { CliModule } from './cli/cli.module';
import { CommonModule } from './common/common.module';
import { DataIngestionModule } from './data-ingestion/data-ingestion.module';
import { HealthModule } from './health/health.module';
import { MlPredictionModule } from './ml-prediction/ml-prediction.module';
import { PersistenceModule } from './persistence/persistence.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { SchedulingModule } from './scheduling/scheduling.module';

@Module({
  imports: [
    // Globale Konfiguration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduling aktivieren
    ScheduleModule.forRoot(), // Eigene Module
    CommonModule,
    PersistenceModule,
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
    SchedulingModule,
    PortfolioModule,
    CliModule,
    AutomationModule,
    HealthModule,
  ],
})
export class AppModule {}
