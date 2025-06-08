import { Module } from "@nestjs/common";
import { MlPredictionService } from "./ml-prediction.service";
import { AnalysisEngineModule } from "../analysis-engine/analysis-engine.module";

@Module({
  imports: [AnalysisEngineModule],
  providers: [MlPredictionService],
  exports: [MlPredictionService],
})
export class MlPredictionModule {}
