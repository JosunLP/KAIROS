import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

// Eigene Module
import { PersistenceModule } from "./persistence/persistence.module";
import { DataIngestionModule } from "./data-ingestion/data-ingestion.module";
import { AnalysisEngineModule } from "./analysis-engine/analysis-engine.module";
import { MlPredictionModule } from "./ml-prediction/ml-prediction.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { CliModule } from "./cli/cli.module";

@Module({
  imports: [
    // Globale Konfiguration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // Scheduling aktivieren
    ScheduleModule.forRoot(),

    // Eigene Module
    PersistenceModule,
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
    SchedulingModule,
    CliModule,
  ],
})
export class AppModule {}
