import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { DataProvider, MarketDataPoint } from '../data-ingestion.service';

@Injectable()
export class PolygonProvider implements DataProvider {
  public readonly name = 'Polygon.io';
  private readonly logger = new Logger(PolygonProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('POLYGON_API_KEY', '');

    this.httpClient = axios.create({
      baseURL: 'https://api.polygon.io',
      timeout: 30000,
    });

    // Retry-Mechanismus konfigurieren
    axiosRetry(this.httpClient, {
      retries: this.configService.get<number>('API_RETRY_ATTEMPTS', 3),
      retryDelay: retryCount => {
        return (
          retryCount *
          this.configService.get<number>('API_RETRY_DELAY_MS', 1000)
        );
      },
      retryCondition: error => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429
        );
      },
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== '';
  }

  async fetchHistoricalData(
    ticker: string,
    days: number = 365,
  ): Promise<MarketDataPoint[]> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Polygon.io Provider nicht konfiguriert - API-Schlüssel fehlt',
      );
      return [];
    }

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];

      this.logger.debug(
        `Hole Polygon-Daten für ${ticker} von ${fromDateStr} bis ${toDateStr}`,
      );

      const response = await this.httpClient.get(
        `/v2/aggs/ticker/${ticker}/range/1/day/${fromDateStr}/${toDateStr}`,
        {
          params: {
            apikey: this.apiKey,
            adjusted: true,
            sort: 'asc',
            limit: 50000,
          },
        },
      );

      const data = response.data;

      if (data.status !== 'OK') {
        throw new Error(
          `Polygon API-Fehler: ${data.error || 'Unbekannter Fehler'}`,
        );
      }

      if (!data.results || data.results.length === 0) {
        this.logger.warn(`Keine Daten für ${ticker} von Polygon erhalten`);
        return [];
      }

      const dataPoints: MarketDataPoint[] = data.results.map((item: any) => ({
        timestamp: new Date(item.t), // Unix timestamp in ms
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v,
      }));

      this.logger.debug(
        `${dataPoints.length} Datenpunkte für ${ticker} von Polygon abgerufen`,
      );
      return dataPoints;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen historischer Daten für ${ticker} von Polygon`,
        error,
      );
      throw error;
    }
  }

  async fetchLatestData(ticker: string): Promise<MarketDataPoint | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Polygon.io Provider nicht konfiguriert - API-Schlüssel fehlt',
      );
      return null;
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const response = await this.httpClient.get(
        `/v1/open-close/${ticker}/${dateStr}`,
        {
          params: {
            apikey: this.apiKey,
            adjusted: true,
          },
        },
      );

      const data = response.data;

      if (data.status !== 'OK') {
        this.logger.warn(
          `Keine aktuellen Daten für ${ticker} von Polygon: ${data.error || 'Unbekannter Fehler'}`,
        );
        return null;
      }

      const point: MarketDataPoint = {
        timestamp: new Date(data.from),
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume,
      };

      this.logger.debug(`Aktuelle Daten für ${ticker} von Polygon abgerufen`);
      return point;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen aktueller Daten für ${ticker} von Polygon`,
        error,
      );
      throw error;
    }
  }
}
