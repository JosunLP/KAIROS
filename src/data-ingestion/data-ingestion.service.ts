import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../common/cache.service';
import { ErrorHandlingService } from '../common/error-handling.service';
import { ValidationService } from '../common/validation.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../persistence/prisma.service';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import { FinnhubProvider } from './providers/finnhub.provider';
import { MockProvider } from './providers/mock.provider';
import { PolygonProvider } from './providers/polygon.provider';

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
  fetchHistoricalData(
    ticker: string,
    days?: number,
  ): Promise<MarketDataPoint[]>;
  fetchLatestData(ticker: string): Promise<MarketDataPoint | null>;
}

export interface DataIngestionStats {
  totalStocks: number;
  activeStocks: number;
  totalDataPoints: number;
  lastUpdate: Date;
  oldestData?: Date;
  newestData?: Date;
  availableProviders: string[];
  providerStats: Record<
    string,
    {
      requests: number;
      errors: number;
      successRate: number;
    }
  >;
}

@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);
  private readonly providers: DataProvider[];
  private readonly stats = {
    providerStats: {} as Record<
      string,
      { requests: number; errors: number; successRate: number }
    >,
    lastUpdate: new Date(),
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly validation: ValidationService,
    private readonly errorHandling: ErrorHandlingService,
    private readonly cache: CacheService,
    private readonly alphaVantage: AlphaVantageProvider,
    private readonly polygon: PolygonProvider,
    private readonly finnhub: FinnhubProvider,
    private readonly mockProvider: MockProvider,
  ) {
    // Priorisierung: Echte Provider zuerst, dann Mock für Demo
    this.providers = [
      this.alphaVantage,
      this.polygon,
      this.finnhub,
      this.mockProvider,
    ];

    // Initialisiere Statistiken für alle Provider
    this.providers.forEach(provider => {
      this.stats.providerStats[provider.name] = {
        requests: 0,
        errors: 0,
        successRate: 100,
      };
    });
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

      const results = await Promise.allSettled(
        activeStocks.map(stock => this.fetchLatestDataForStock(stock.ticker)),
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.log(
        `✅ ${successful} Aktien erfolgreich aktualisiert, ${failed} fehlgeschlagen`,
      );
      this.stats.lastUpdate = new Date();
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'fetchLatestDataForAllTrackedStocks',
        },
        'high',
      );
      throw error;
    }
  }

  /**
   * Fügt eine neue Aktie zur Beobachtung hinzu
   */
  async addNewStock(ticker: string, name?: string): Promise<void> {
    try {
      // Validierung
      const validation = this.validation.validateTicker(ticker);
      if (!validation.isValid) {
        throw new Error(
          `Invalid ticker: ${validation.errors.map(e => e.message).join(', ')}`,
        );
      }

      const cleanTicker = ticker.trim().toUpperCase();

      // Prüfen ob bereits vorhanden
      const existing = await this.prisma.stock.findUnique({
        where: { ticker: cleanTicker },
      });

      if (existing) {
        this.logger.warn(`Aktie ${cleanTicker} wird bereits verfolgt`);
        return;
      }

      // Name automatisch ermitteln falls nicht angegeben
      let stockName = name;
      if (!stockName) {
        try {
          // Versuche über Alpha Vantage die aktuellen Daten zu ermitteln
          const latestData =
            await this.alphaVantage.fetchLatestData(cleanTicker);
          if (latestData) {
            stockName = cleanTicker; // Verwende erstmal den Ticker als Namen
          }
        } catch (error) {
          this.logger.warn(
            `Name für ${cleanTicker} konnte nicht ermittelt werden, verwende Ticker`,
          );
          stockName = cleanTicker;
        }
      }

      // Aktie in Datenbank hinzufügen
      await this.prisma.stock.create({
        data: {
          ticker: cleanTicker,
          name: stockName || cleanTicker,
        },
      });

      this.logger.log(
        `✅ Neue Aktie hinzugefügt: ${cleanTicker} (${stockName})`,
      );

      // Cache invalidieren
      this.cache.deleteByPrefix(`stock:${cleanTicker}`);

      // Erste historische Daten abrufen
      await this.fetchLatestDataForStock(cleanTicker);
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'addNewStock',
          metadata: { ticker, name },
        },
        'medium',
      );
      throw error;
    }
  }

  /**
   * Fügt eine Aktie zur Verfolgung hinzu (Alias für addNewStock)
   */
  async addStockToTracking(ticker: string, name?: string): Promise<void> {
    return this.addNewStock(ticker, name);
  }

  /**
   * Holt die neuesten Daten für eine spezifische Aktie
   */
  async fetchLatestDataForStock(ticker: string): Promise<void> {
    try {
      // Validierung
      const validation = this.validation.validateTicker(ticker);
      if (!validation.isValid) {
        throw new Error(
          `Invalid ticker: ${validation.errors.map(e => e.message).join(', ')}`,
        );
      }

      const cleanTicker = ticker.trim().toUpperCase();

      // Cache prüfen
      const cacheKey = `latest:${cleanTicker}`;
      const cached = this.cache.get<MarketDataPoint>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit für ${cleanTicker}`);
        return;
      }

      // Provider finden
      const provider = this.getAvailableProvider();
      if (!provider) {
        throw new Error('Kein konfigurierter Datenanbieter verfügbar');
      }

      this.logger.debug(
        `Hole aktuelle Daten für ${cleanTicker} von ${provider.name}`,
      );

      // Statistiken aktualisieren
      this.stats.providerStats[provider.name].requests++;

      const latestData = await provider.fetchLatestData(cleanTicker);
      if (!latestData) {
        this.logger.warn(`Keine aktuellen Daten für ${cleanTicker} erhalten`);
        this.stats.providerStats[provider.name].errors++;
        return;
      }

      // Daten validieren
      const validData = this.validateMarketData([latestData]);
      if (validData.length === 0) {
        this.logger.warn(`Ungültige Daten für ${cleanTicker} nach Validierung`);
        this.stats.providerStats[provider.name].errors++;
        return;
      }

      // Daten speichern
      await this.saveMarketData(cleanTicker, validData);

      // Cache setzen (5 Minuten TTL)
      this.cache.set(cacheKey, latestData, { ttl: 300 });

      // Erfolgsrate aktualisieren
      const stats = this.stats.providerStats[provider.name];
      stats.successRate =
        ((stats.requests - stats.errors) / stats.requests) * 100;

      this.logger.debug(
        `✅ Aktuelle Daten für ${cleanTicker} erfolgreich aktualisiert`,
      );
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'fetchLatestDataForStock',
          metadata: { ticker },
        },
        'medium',
      );
      throw error;
    }
  }

  /**
   * Holt historische Daten für eine neue Aktie
   */
  async fetchHistoricalDataForStock(
    ticker: string,
    days: number = 365,
  ): Promise<void> {
    try {
      // Validierung
      const validation = this.validation.validateTicker(ticker);
      if (!validation.isValid) {
        throw new Error(
          `Invalid ticker: ${validation.errors.map(e => e.message).join(', ')}`,
        );
      }

      if (days < 1 || days > 365 * 5) {
        throw new Error('Days must be between 1 and 1825 (5 years)');
      }

      const cleanTicker = ticker.trim().toUpperCase();
      const provider = this.getAvailableProvider();
      if (!provider) {
        throw new Error('Kein konfigurierter Datenanbieter verfügbar');
      }

      this.logger.log(
        `Hole historische Daten für ${cleanTicker} (${days} Tage) von ${provider.name}`,
      );

      const historicalData = await provider.fetchHistoricalData(
        cleanTicker,
        days,
      );
      if (historicalData.length === 0) {
        this.logger.warn(
          `Keine historischen Daten für ${cleanTicker} erhalten`,
        );
        return;
      }

      // Daten validieren
      const validData = this.validateMarketData(historicalData);
      if (validData.length === 0) {
        this.logger.warn(
          `Keine gültigen historischen Daten für ${cleanTicker} nach Validierung`,
        );
        return;
      }

      await this.saveMarketData(cleanTicker, validData);
      this.logger.log(
        `${validData.length} historische Datenpunkte für ${cleanTicker} gespeichert`,
      );
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'fetchHistoricalDataForStock',
          metadata: { ticker, days },
        },
        'medium',
      );
      throw error;
    }
  }

  /**
   * Validiert Marktdaten
   */
  private validateMarketData(data: MarketDataPoint[]): MarketDataPoint[] {
    return data.filter(point => {
      // Grundlegende Validierung
      if (!point.timestamp || isNaN(point.timestamp.getTime())) {
        return false;
      }

      if (
        point.open <= 0 ||
        point.high <= 0 ||
        point.low <= 0 ||
        point.close <= 0
      ) {
        return false;
      }

      if (point.volume < 0) {
        return false;
      }

      // Logische Validierung
      if (point.high < point.low) {
        return false;
      }

      if (point.open < point.low || point.open > point.high) {
        return false;
      }

      if (point.close < point.low || point.close > point.high) {
        return false;
      }

      return true;
    });
  }

  /**
   * Speichert Marktdaten in der Datenbank
   */
  private async saveMarketData(
    ticker: string,
    dataPoints: MarketDataPoint[],
  ): Promise<void> {
    try {
      // Aktie finden oder erstellen
      const stock = await this.prisma.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });

      if (!stock) {
        throw new Error(`Stock ${ticker} not found`);
      }

      // Daten in Batches speichern
      const batchSize = 100;
      for (let i = 0; i < dataPoints.length; i += batchSize) {
        const batch = dataPoints.slice(i, i + batchSize);

        await this.prisma.historicalData.createMany({
          data: batch.map(dataPoint => ({
            stockId: stock.id,
            timestamp: dataPoint.timestamp,
            open: dataPoint.open,
            high: dataPoint.high,
            low: dataPoint.low,
            close: dataPoint.close,
            volume: BigInt(dataPoint.volume),
          })),
        });
      }

      this.logger.debug(
        `✅ ${dataPoints.length} Datenpunkte für ${ticker} gespeichert`,
      );
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'saveMarketData',
          metadata: { ticker, dataPointsCount: dataPoints.length },
        },
        'high',
      );
      throw error;
    }
  }

  /**
   * Holt einen verfügbaren Provider
   */
  private getAvailableProvider(): DataProvider | null {
    return this.providers.find(provider => provider.isConfigured()) || null;
  }

  /**
   * Holt Verzögerung zwischen API-Aufrufen
   */
  private getDelayBetweenRequests(): number {
    // Dynamische Verzögerung basierend auf Provider-Limits
    const configuredProviders = this.providers.filter(p =>
      p.isConfigured(),
    ).length;
    return Math.max(1000, 5000 / configuredProviders); // Mindestens 1 Sekunde
  }

  /**
   * Verzögerung
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gibt erweiterte Datenstatistiken zurück
   */
  async getDataStatistics(): Promise<DataIngestionStats> {
    try {
      const totalStocks = await this.prisma.stock.count();
      const activeStocks = await this.prisma.stock.count({
        where: { isActive: true },
      });
      const totalDataPoints = await this.prisma.historicalData.count();

      // Älteste und neueste Daten
      const oldestData = await this.prisma.historicalData.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      });

      const newestData = await this.prisma.historicalData.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      // Verfügbare Provider
      const availableProviders = this.providers
        .filter(provider => provider.isConfigured())
        .map(provider => provider.name);

      return {
        totalStocks,
        activeStocks,
        totalDataPoints,
        lastUpdate: this.stats.lastUpdate,
        oldestData: oldestData?.timestamp,
        newestData: newestData?.timestamp,
        availableProviders,
        providerStats: this.stats.providerStats,
      };
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'getDataStatistics',
        },
        'medium',
      );
      throw error;
    }
  }

  /**
   * Bereinigt alte Daten
   */
  async cleanupOldData(daysToKeep: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.historicalData.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Bereinigung abgeschlossen: ${result.count} alte Datenpunkte gelöscht`,
      );
    } catch (error) {
      await this.errorHandling.handleError(
        error as Error,
        {
          component: 'DATA_INGESTION',
          operation: 'cleanupOldData',
          metadata: { daysToKeep },
        },
        'medium',
      );
      throw error;
    }
  }
}
