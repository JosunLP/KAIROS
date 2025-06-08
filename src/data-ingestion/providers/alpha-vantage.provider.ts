import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { DataProvider, MarketDataPoint } from "../data-ingestion.service";

@Injectable()
export class AlphaVantageProvider implements DataProvider {
  public readonly name = "Alpha Vantage";
  private readonly logger = new Logger(AlphaVantageProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("ALPHA_VANTAGE_API_KEY", "");

    this.httpClient = axios.create({
      baseURL: "https://www.alphavantage.co",
      timeout: 30000,
    });

    // Retry-Mechanismus konfigurieren
    axiosRetry(this.httpClient, {
      retries: this.configService.get<number>("API_RETRY_ATTEMPTS", 3),
      retryDelay: (retryCount) => {
        return (
          retryCount *
          this.configService.get<number>("API_RETRY_DELAY_MS", 1000)
        );
      },
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429
        ); // Rate limit
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
      throw new Error("Alpha Vantage API-Schlüssel nicht konfiguriert");
    }

    try {
      const response = await this.httpClient.get("/query", {
        params: {
          function: "TIME_SERIES_DAILY",
          symbol: ticker,
          outputsize: days > 100 ? "full" : "compact",
          apikey: this.apiKey,
        },
      });

      const data = response.data;

      if (data["Error Message"]) {
        throw new Error(`Alpha Vantage API-Fehler: ${data["Error Message"]}`);
      }

      if (data["Note"]) {
        throw new Error(`Alpha Vantage Rate Limit erreicht: ${data["Note"]}`);
      }

      const timeSeries = data["Time Series (Daily)"];
      if (!timeSeries) {
        throw new Error("Keine Zeitreihendaten in der API-Antwort gefunden");
      }

      const dataPoints: MarketDataPoint[] = [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      for (const [dateStr, values] of Object.entries(timeSeries)) {
        const timestamp = new Date(dateStr);

        if (timestamp < cutoffDate) {
          continue;
        }

        const point: MarketDataPoint = {
          timestamp,
          open: parseFloat((values as any)["1. open"]),
          high: parseFloat((values as any)["2. high"]),
          low: parseFloat((values as any)["3. low"]),
          close: parseFloat((values as any)["4. close"]),
          volume: parseInt((values as any)["5. volume"]),
        };

        dataPoints.push(point);
      }

      // Sortiere nach Datum (älteste zuerst)
      dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      this.logger.debug(
        `${dataPoints.length} historische Datenpunkte für ${ticker} von Alpha Vantage abgerufen`,
      );
      return dataPoints;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen historischer Daten für ${ticker} von Alpha Vantage`,
        error,
      );
      throw error;
    }
  }

  async fetchLatestData(ticker: string): Promise<MarketDataPoint | null> {
    if (!this.isConfigured()) {
      throw new Error("Alpha Vantage API-Schlüssel nicht konfiguriert");
    }

    try {
      const response = await this.httpClient.get("/query", {
        params: {
          function: "GLOBAL_QUOTE",
          symbol: ticker,
          apikey: this.apiKey,
        },
      });

      const data = response.data;

      if (data["Error Message"]) {
        throw new Error(`Alpha Vantage API-Fehler: ${data["Error Message"]}`);
      }

      if (data["Note"]) {
        throw new Error(`Alpha Vantage Rate Limit erreicht: ${data["Note"]}`);
      }

      const quote = data["Global Quote"];
      if (!quote) {
        this.logger.warn(
          `Keine aktuellen Daten für ${ticker} von Alpha Vantage erhalten`,
        );
        return null;
      }

      const point: MarketDataPoint = {
        timestamp: new Date(quote["07. latest trading day"]),
        open: parseFloat(quote["02. open"]),
        high: parseFloat(quote["03. high"]),
        low: parseFloat(quote["04. low"]),
        close: parseFloat(quote["05. price"]),
        volume: parseInt(quote["06. volume"]),
      };

      this.logger.debug(
        `Aktuelle Daten für ${ticker} von Alpha Vantage abgerufen`,
      );
      return point;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen aktueller Daten für ${ticker} von Alpha Vantage`,
        error,
      );
      throw error;
    }
  }
}
