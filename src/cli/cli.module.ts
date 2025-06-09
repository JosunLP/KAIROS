import { Module } from "@nestjs/common";
import { SimpleCliService } from "./simple-cli.service";
import { DataIngestionModule } from "../data-ingestion/data-ingestion.module";
import { AnalysisEngineModule } from "../analysis-engine/analysis-engine.module";
import { MlPredictionModule } from "../ml-prediction/ml-prediction.module";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { PortfolioModule } from "../portfolio/portfolio.module";

@Module({
  imports: [
    DataIngestionModule,
    AnalysisEngineModule,
    MlPredictionModule,
    SchedulingModule,
    PersistenceModule,
    PortfolioModule,
  ],
  providers: [SimpleCliService],
  exports: [SimpleCliService],
})
export class CliModule {}
