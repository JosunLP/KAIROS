import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataProvider, MarketDataPoint } from '../data-ingestion.service';

@Injectable()
export class FinnhubProvider implements DataProvider {
  public readonly name = 'Finnhub';
  private readonly logger = new Logger(FinnhubProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FINNHUB_API_KEY', '');
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== '';
  }

  async fetchHistoricalData(ticker: string, days: number = 365): Promise<MarketDataPoint[]> {
    // TODO: Implementierung für Finnhub API
    this.logger.warn('Finnhub Provider noch nicht implementiert');
    return [];
  }

  async fetchLatestData(ticker: string): Promise<MarketDataPoint | null> {
    // TODO: Implementierung für Finnhub API
    this.logger.warn('Finnhub Provider noch nicht implementiert');
    return null;
  }
}
