import { Module } from '@nestjs/common';
import { DataIngestionService } from './data-ingestion.service';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import { PolygonProvider } from './providers/polygon.provider';
import { FinnhubProvider } from './providers/finnhub.provider';
import { MockProvider } from './providers/mock.provider';

@Module({
  providers: [
    DataIngestionService,
    AlphaVantageProvider,
    PolygonProvider,
    FinnhubProvider,
    MockProvider,
  ],
  exports: [DataIngestionService],
})
export class DataIngestionModule {}
