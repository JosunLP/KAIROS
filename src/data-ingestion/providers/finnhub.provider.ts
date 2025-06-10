import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { DataProvider, MarketDataPoint } from "../data-ingestion.service";

@Injectable()
export class FinnhubProvider implements DataProvider {
  public readonly name = "Finnhub";
  private readonly logger = new Logger(FinnhubProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("FINNHUB_API_KEY", "");
    
    this.httpClient = axios.create({
      baseURL: "https://finnhub.io/api/v1",
      timeout: 30000,
    });

    // Retry-Mechanismus konfigurieren
    axiosRetry(this.httpClient, {
      retries: this.configService.get<number>("API_RETRY_ATTEMPTS", 3),
      retryDelay: (retryCount) => {
        return retryCount * this.configService.get<number>("API_RETRY_DELAY_MS", 1000);
      },
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429
        );
      },
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== "";
  }

  async fetchHistoricalData(
    ticker: string,
    days: number = 365,
  ): Promise<MarketDataPoint[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Finnhub Provider nicht konfiguriert - API-Schlüssel fehlt");
      return [];
    }

    try {
      const toDate = Math.floor(Date.now() / 1000);
      const fromDate = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

      this.logger.debug(`Hole Finnhub-Daten für ${ticker} von ${fromDate} bis ${toDate}`);

      const response = await this.httpClient.get('/stock/candle', {
        params: {
          symbol: ticker,
          resolution: 'D',
          from: fromDate,
          to: toDate,
          token: this.apiKey
        }
      });

      const data = response.data;

      if (data.s !== "ok") {
        this.logger.warn(`Keine Daten für ${ticker} von Finnhub: Status ${data.s}`);
        return [];
      }

      if (!data.c || data.c.length === 0) {
        this.logger.warn(`Keine Daten für ${ticker} von Finnhub erhalten`);
        return [];
      }

      const dataPoints: MarketDataPoint[] = [];
      
      for (let i = 0; i < data.c.length; i++) {
        dataPoints.push({
          timestamp: new Date(data.t[i] * 1000), // Unix timestamp in seconds
          open: data.o[i],
          high: data.h[i],
          low: data.l[i],
          close: data.c[i],
          volume: data.v[i],
        });
      }

      this.logger.debug(`${dataPoints.length} Datenpunkte für ${ticker} von Finnhub abgerufen`);
      return dataPoints;

    } catch (error) {
      this.logger.error(`Fehler beim Abrufen historischer Daten für ${ticker} von Finnhub`, error);
      throw error;
    }
  }

  async fetchLatestData(ticker: string): Promise<MarketDataPoint | null> {
    if (!this.isConfigured()) {
      this.logger.warn("Finnhub Provider nicht konfiguriert - API-Schlüssel fehlt");
      return null;
    }

    try {
      const response = await this.httpClient.get('/quote', {
        params: {
          symbol: ticker,
          token: this.apiKey
        }
      });

      const data = response.data;

      if (!data.c) {
        this.logger.warn(`Keine aktuellen Daten für ${ticker} von Finnhub erhalten`);
        return null;
      }

      const point: MarketDataPoint = {
        timestamp: new Date(data.t * 1000),
        open: data.o,
        high: data.h,
        low: data.l,
        close: data.c,
        volume: 0, // Finnhub quote API liefert kein Volume
      };

      this.logger.debug(`Aktuelle Daten für ${ticker} von Finnhub abgerufen`);
      return point;

    } catch (error) {
      this.logger.error(`Fehler beim Abrufen aktueller Daten für ${ticker} von Finnhub`, error);
      throw error;
    }
  }
}
