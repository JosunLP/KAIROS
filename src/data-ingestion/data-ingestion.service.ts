import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import { PolygonProvider } from './providers/polygon.provider';
import { FinnhubProvider } from './providers/finnhub.provider';
import { MockProvider } from './providers/mock.provider';

export interface MarketDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DataProvider {
  name: string;
  isConfigured(): boolean;
  fetchHistoricalData(ticker: string, days?: number): Promise<MarketDataPoint[]>;
  fetchLatestData(ticker: string): Promise<MarketDataPoint | null>;
}

@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);
  private readonly providers: DataProvider[];
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly alphaVantage: AlphaVantageProvider,
    private readonly polygon: PolygonProvider,
    private readonly finnhub: FinnhubProvider,
    private readonly mockProvider: MockProvider,
  ) {
    // Priorisierung: Echte Provider zuerst, dann Mock für Demo
    this.providers = [this.alphaVantage, this.polygon, this.finnhub, this.mockProvider];
  }

  /**
   * Holt aktuelle Daten für alle aktiven Aktien
   */
  async fetchLatestDataForAllTrackedStocks(): Promise<void> {
    try {
      const activeStocks = await this.prisma.stock.findMany({
        where: { isActive: true },
      });

      this.logger.log(`Aktualisiere Daten für ${activeStocks.length} Aktien`);

      for (const stock of activeStocks) {
        try {
          await this.fetchLatestDataForStock(stock.ticker);
          // Rate Limiting - Pause zwischen API-Aufrufen
          await this.delay(this.getDelayBetweenRequests());
        } catch (error) {
          this.logger.error(`Fehler beim Abrufen der Daten für ${stock.ticker}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der aktuellsten Daten', error);
      throw error;
    }
  }

  /**
   * Fügt eine neue Aktie zur Beobachtung hinzu
   */
  async addNewStock(ticker: string, name?: string): Promise<void> {
    try {
      // Prüfen ob bereits vorhanden
      const existing = await this.prisma.stock.findUnique({
        where: { ticker },
      });

      if (existing) {
        this.logger.warn(`Aktie ${ticker} wird bereits verfolgt`);
        return;
      }      // Name automatisch ermitteln falls nicht angegeben
      let stockName = name;
      if (!stockName) {
        try {
          // Versuche über Alpha Vantage die aktuellen Daten zu ermitteln
          const quote = await this.alphaVantage.fetchLatestData(ticker);
          stockName = ticker; // Verwende erstmal den Ticker als Namen
        } catch (error) {
          this.logger.warn(`Name für ${ticker} konnte nicht ermittelt werden, verwende Ticker`);
          stockName = ticker;
        }
      }

      // Aktie in Datenbank hinzufügen
      const stock = await this.prisma.stock.create({
        data: {
          ticker,
          name: stockName || ticker, // Fallback auf ticker wenn Name nicht verfügbar
        },
      });

      this.logger.log(`✅ Neue Aktie hinzugefügt: ${ticker} (${stockName})`);

      // Erste historische Daten abrufen
      await this.fetchLatestDataForStock(ticker);

    } catch (error) {
      this.logger.error(`Fehler beim Hinzufügen der Aktie ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Holt die neuesten Daten für eine spezifische Aktie
   */
  async fetchLatestDataForStock(ticker: string): Promise<void> {
    try {
      this.logger.log(`📡 Hole Daten für ${ticker}...`);

      // Versuche mit verschiedenen Providern
      let data = null;

      try {
        data = await this.alphaVantage.fetchHistoricalData(ticker);
      } catch (error) {
        this.logger.warn(`Alpha Vantage fehlgeschlagen für ${ticker}, versuche Polygon...`);
        
        try {
          data = await this.polygon.fetchHistoricalData(ticker);
        } catch (error2) {
          this.logger.warn(`Polygon fehlgeschlagen für ${ticker}, versuche Finnhub...`);
          data = await this.finnhub.fetchHistoricalData(ticker);
        }
      }

      if (!data || data.length === 0) {
        this.logger.warn(`Keine Daten für ${ticker} erhalten`);
        return;
      }

      // Daten in Datenbank speichern
      await this.saveMarketData(ticker, data);

      this.logger.log(`✅ ${data.length} Datenpunkte für ${ticker} gespeichert`);

    } catch (error) {
      this.logger.error(`Fehler beim Abrufen der Daten für ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Holt historische Daten für eine neue Aktie
   */
  async fetchHistoricalDataForStock(ticker: string, days: number = 365): Promise<void> {
    const provider = this.getAvailableProvider();
    if (!provider) {
      throw new Error('Kein konfigurierter Datenanbieter verfügbar');
    }

    try {
      this.logger.log(`Hole historische Daten für ${ticker} (${days} Tage) von ${provider.name}`);
      
      const historicalData = await provider.fetchHistoricalData(ticker, days);
      if (historicalData.length === 0) {
        this.logger.warn(`Keine historischen Daten für ${ticker} erhalten`);
        return;
      }

      await this.saveMarketData(ticker, historicalData);
      this.logger.log(`${historicalData.length} historische Datenpunkte für ${ticker} gespeichert`);
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen historischer Daten für ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Fügt eine neue Aktie zur Verfolgung hinzu
   */
  async addStockToTracking(ticker: string, name?: string): Promise<void> {
    try {
      // Prüfe ob Aktie bereits existiert
      const existing = await this.prisma.stock.findUnique({
        where: { ticker },
      });

      if (existing) {
        if (!existing.isActive) {
          // Reaktiviere die Aktie
          await this.prisma.stock.update({
            where: { ticker },
            data: { isActive: true },
          });
          this.logger.log(`Aktie ${ticker} reaktiviert`);
        } else {
          this.logger.log(`Aktie ${ticker} wird bereits verfolgt`);
        }
        return;
      }

      // Erstelle neue Aktie
      await this.prisma.stock.create({
        data: {
          ticker,
          name: name || ticker,
          isActive: true,
        },
      });

      this.logger.log(`Aktie ${ticker} zur Verfolgung hinzugefügt`);

      // Hole initiale historische Daten
      await this.fetchHistoricalDataForStock(ticker);
    } catch (error) {
      this.logger.error(`Fehler beim Hinzufügen der Aktie ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Speichert Marktdaten in der Datenbank
   */
  private async saveMarketData(ticker: string, dataPoints: MarketDataPoint[]): Promise<void> {
    try {
      const stock = await this.prisma.stock.findUnique({
        where: { ticker },
      });

      if (!stock) {
        throw new Error(`Aktie ${ticker} nicht in der Datenbank gefunden`);
      }

      // Verwende upsert um Duplikate zu vermeiden
      for (const point of dataPoints) {
        await this.prisma.historicalData.upsert({
          where: {
            stockId_timestamp: {
              stockId: stock.id,
              timestamp: point.timestamp,
            },
          },
          update: {
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
          },
          create: {
            stockId: stock.id,
            timestamp: point.timestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Fehler beim Speichern der Marktdaten für ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Gibt den ersten verfügbaren und konfigurierten Provider zurück
   */
  private getAvailableProvider(): DataProvider | null {
    return this.providers.find(provider => provider.isConfigured()) || null;
  }

  /**
   * Berechnet die Verzögerung zwischen API-Anfragen basierend auf der Konfiguration
   */
  private getDelayBetweenRequests(): number {
    const requestsPerMinute = this.configService.get<number>('API_REQUESTS_PER_MINUTE', 5);
    return Math.ceil(60000 / requestsPerMinute); // Millisekunden
  }

  /**
   * Hilfsfunktion für Verzögerungen
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gibt Statistiken über die verfügbaren Daten zurück
   */
  async getDataStatistics(): Promise<any> {
    try {
      const totalStocks = await this.prisma.stock.count({
        where: { isActive: true },
      });

      const totalDataPoints = await this.prisma.historicalData.count();

      const oldestData = await this.prisma.historicalData.findFirst({
        orderBy: { timestamp: 'asc' },
      });

      const newestData = await this.prisma.historicalData.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      return {
        totalStocks,
        totalDataPoints,
        oldestData: oldestData?.timestamp,
        newestData: newestData?.timestamp,
        availableProviders: this.providers
          .filter(p => p.isConfigured())
          .map(p => p.name),
      };
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der Datenstatistiken', error);
      throw error;
    }
  }
}
