import { Module } from "@nestjs/common";
import { MlPredictionService } from "./ml-prediction.service";
import { AnalysisEngineModule } from "../analysis-engine/analysis-engine.module";
import { DataIngestionModule } from "../data-ingestion/data-ingestion.module";

@Module({
  imports: [AnalysisEngineModule, DataIngestionModule],
  providers: [MlPredictionService],
  exports: [MlPredictionService],
})
export class MlPredictionModule {}
