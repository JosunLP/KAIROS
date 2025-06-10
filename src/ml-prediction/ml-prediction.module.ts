import { Module } from "@nestjs/common";
import { MlPredictionService } from "./ml-prediction.service";
import { MLClientService } from "./ml-client.service";
import { AnalysisEngineModule } from "../analysis-engine/analysis-engine.module";
import { DataIngestionModule } from "../data-ingestion/data-ingestion.module";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [AnalysisEngineModule, DataIngestionModule, ConfigModule],
  providers: [MlPredictionService, MLClientService],
  exports: [MlPredictionService, MLClientService],
})
export class MlPredictionModule {}
