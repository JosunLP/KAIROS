import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { DataIngestionService } from './data-ingestion.service';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import { FinnhubProvider } from './providers/finnhub.provider';
import { MockProvider } from './providers/mock.provider';
import { PolygonProvider } from './providers/polygon.provider';

@Module({
  imports: [PersistenceModule, ConfigModule, CommonModule],
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
