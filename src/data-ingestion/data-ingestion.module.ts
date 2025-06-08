import { Module } from '@nestjs/common';
import { DataIngestionService } from './data-ingestion.service';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import { PolygonProvider } from './providers/polygon.provider';
import { FinnhubProvider } from './providers/finnhub.provider';

@Module({
  providers: [
    DataIngestionService,
    AlphaVantageProvider,
    PolygonProvider,
    FinnhubProvider,
  ],
  exports: [DataIngestionService],
})
export class DataIngestionModule {}
