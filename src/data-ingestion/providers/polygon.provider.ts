import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataProvider, MarketDataPoint } from '../data-ingestion.service';

@Injectable()
export class PolygonProvider implements DataProvider {
  public readonly name = 'Polygon.io';
  private readonly logger = new Logger(PolygonProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('POLYGON_API_KEY', '');
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== '';
  }

  async fetchHistoricalData(ticker: string, days: number = 365): Promise<MarketDataPoint[]> {
    // TODO: Implementierung für Polygon.io API
    this.logger.warn('Polygon.io Provider noch nicht implementiert');
    return [];
  }

  async fetchLatestData(ticker: string): Promise<MarketDataPoint | null> {
    // TODO: Implementierung für Polygon.io API
    this.logger.warn('Polygon.io Provider noch nicht implementiert');
    return null;
  }
}
