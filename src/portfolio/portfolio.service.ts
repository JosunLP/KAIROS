import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../common/cache.service';
import {
  Portfolio,
  PortfolioPosition,
  Position,
  RiskAssessment,
  RiskMetrics,
} from '../common/types';
import { DataIngestionService } from '../data-ingestion/data-ingestion.service';
import { PrismaService } from '../persistence/prisma.service';

export interface PortfolioMetrics {
  totalValue: number;
  dailyReturn: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta?: number;
  alpha?: number;
}

export interface PositionRisk {
  ticker: string;
  weight: number;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
  correlation: number;
  beta: number;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  totalValue: number;
  totalReturn: number;
  dailyReturn: number;
  positionCount: number;
  lastUpdated: Date;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataIngestion: DataIngestionService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Erstellt ein neues Portfolio
   */
  async createPortfolio(
    name: string,
    description?: string,
    initialCapital: number = 0,
  ): Promise<Portfolio> {
    try {
      const portfolio = await this.prisma.portfolio.create({
        data: {
          name,
          description,
          initialValue: initialCapital,
          currentValue: initialCapital,
          cash: initialCapital,
        },
        include: {
          positions: true,
          trades: true,
        },
      });

      this.logger.log(`Portfolio erstellt: ${name} (${portfolio.id})`);

      // Cache invalidieren
      this.cache.deleteByPrefix('portfolio');

      return this.mapToPortfolioInterface(portfolio);
    } catch (error) {
      this.logger.error(`Fehler beim Erstellen des Portfolios:`, error);
      throw error;
    }
  }

  /**
   * Holt alle Portfolios
   */
  async getAllPortfolios(): Promise<Portfolio[]> {
    try {
      const portfolios = await this.prisma.portfolio.findMany({
        where: { isActive: true },
        include: {
          positions: {
            include: {
              stock: true,
            },
          },
          trades: {
            orderBy: { timestamp: 'desc' },
            take: 10, // Letzte 10 Trades
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return portfolios.map(p => this.mapToPortfolioInterface(p));
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der Portfolios:', error);
      throw error;
    }
  }

  /**
   * Holt Portfolio-Summaries für Dashboard
   */
  async getPortfolioSummaries(): Promise<PortfolioSummary[]> {
    try {
      const portfolios = await this.prisma.portfolio.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          currentValue: true,
          totalReturn: true,
          dailyReturn: true,
          updatedAt: true,
          _count: {
            select: { positions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return portfolios.map(p => ({
        id: p.id,
        name: p.name,
        totalValue: p.currentValue,
        totalReturn: p.totalReturn,
        dailyReturn: p.dailyReturn,
        positionCount: p._count.positions,
        lastUpdated: p.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der Portfolio-Summaries:', error);
      throw error;
    }
  }

  /**
   * Holt ein spezifisches Portfolio
   */
  async getPortfolio(portfolioId: string): Promise<Portfolio | null> {
    try {
      const cacheKey = `portfolio:${portfolioId}`;
      const cached = this.cache.get<Portfolio>(cacheKey);
      if (cached) {
        return cached;
      }

      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          positions: {
            include: {
              stock: true,
            },
          },
          trades: {
            orderBy: { timestamp: 'desc' },
            take: 50,
          },
          riskAssessments: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (!portfolio) {
        return null;
      }

      const mappedPortfolio = this.mapToPortfolioInterface(portfolio);

      // Cache für 5 Minuten
      this.cache.set(cacheKey, mappedPortfolio, { ttl: 300 });

      return mappedPortfolio;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen des Portfolios ${portfolioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fügt eine Position zum Portfolio hinzu
   */
  async addPosition(
    portfolioId: string,
    ticker: string,
    quantity: number,
    price: number,
  ): Promise<void> {
    try {
      // Aktie zur Datenbank hinzufügen falls nicht vorhanden
      let stock = await this.prisma.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });

      if (!stock) {
        await this.dataIngestion.addNewStock(ticker.toUpperCase());
        stock = await this.prisma.stock.findUnique({
          where: { ticker: ticker.toUpperCase() },
        });
      }

      if (!stock) {
        throw new Error(
          `Aktie ${ticker} konnte nicht gefunden oder hinzugefügt werden`,
        );
      }

      // Portfolio abrufen
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: { positions: true },
      });

      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} nicht gefunden`);
      }

      // Prüfe ob Position bereits existiert
      const existingPosition = portfolio.positions.find(
        p => p.ticker === ticker.toUpperCase(),
      );

      if (existingPosition) {
        // Aktualisiere existierende Position (Average Cost)
        const totalCost =
          existingPosition.quantity * existingPosition.averagePrice +
          quantity * price;
        const totalQuantity = existingPosition.quantity + quantity;

        await this.prisma.portfolioPosition.update({
          where: { id: existingPosition.id },
          data: {
            quantity: totalQuantity,
            averagePrice: totalCost / totalQuantity,
            lastUpdated: new Date(),
          },
        });
      } else {
        // Füge neue Position hinzu
        await this.prisma.portfolioPosition.create({
          data: {
            portfolioId,
            stockId: stock.id,
            ticker: ticker.toUpperCase(),
            quantity,
            averagePrice: price,
            currentPrice: price,
            value: quantity * price,
            sector: stock.sector,
          },
        });
      }

      // Trade aufzeichnen
      await this.prisma.portfolioTrade.create({
        data: {
          portfolioId,
          ticker: ticker.toUpperCase(),
          type: 'BUY',
          quantity,
          price,
          timestamp: new Date(),
        },
      });

      // Portfolio-Metriken aktualisieren
      await this.updatePortfolioMetrics(portfolioId);

      // Cache invalidieren
      this.cache.deleteByPrefix('portfolio');

      this.logger.log(
        `Position hinzugefügt: ${quantity} x ${ticker} @ ${price} zu Portfolio ${portfolioId}`,
      );
    } catch (error) {
      this.logger.error(`Fehler beim Hinzufügen der Position:`, error);
      throw error;
    }
  }

  /**
   * Entfernt eine Position aus dem Portfolio
   */
  async removePosition(portfolioId: string, ticker: string): Promise<void> {
    try {
      const position = await this.prisma.portfolioPosition.findFirst({
        where: {
          portfolioId,
          ticker: ticker.toUpperCase(),
        },
      });

      if (!position) {
        throw new Error(
          `Position ${ticker} nicht im Portfolio ${portfolioId} gefunden`,
        );
      }

      // Trade aufzeichnen (Verkauf)
      await this.prisma.portfolioTrade.create({
        data: {
          portfolioId,
          ticker: ticker.toUpperCase(),
          type: 'SELL',
          quantity: position.quantity,
          price: position.currentPrice || position.averagePrice,
          timestamp: new Date(),
        },
      });

      // Position löschen
      await this.prisma.portfolioPosition.delete({
        where: { id: position.id },
      });

      // Portfolio-Metriken aktualisieren
      await this.updatePortfolioMetrics(portfolioId);

      // Cache invalidieren
      this.cache.deleteByPrefix('portfolio');

      this.logger.log(
        `Position ${ticker} aus Portfolio ${portfolioId} entfernt`,
      );
    } catch (error) {
      this.logger.error(`Fehler beim Entfernen der Position:`, error);
      throw error;
    }
  }

  /**
   * Aktualisiert Portfolio-Metriken
   */
  async updatePortfolioMetrics(portfolioId: string): Promise<void> {
    try {
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          positions: true,
          trades: true,
        },
      });

      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} nicht gefunden`);
      }

      // Aktuelle Preise für alle Positionen abrufen
      const updatedPositions = await Promise.all(
        portfolio.positions.map(async position => {
          try {
            // Hole aktuellen Preis aus der Datenbank
            const latestData = await this.prisma.historicalData.findFirst({
              where: { stock: { ticker: position.ticker } },
              orderBy: { timestamp: 'desc' },
            });

            const currentPrice = latestData?.close || position.averagePrice;

            const value = position.quantity * currentPrice;
            const unrealizedPnL =
              value - position.quantity * position.averagePrice;

            return {
              ...position,
              currentPrice,
              value,
              unrealizedPnL,
            };
          } catch (error) {
            this.logger.warn(
              `Fehler beim Abrufen aktueller Preise für ${position.ticker}:`,
              error,
            );
            return position;
          }
        }),
      );

      // Portfolio-Gesamtwert berechnen
      const totalValue =
        updatedPositions.reduce((sum, pos) => sum + pos.value, 0) +
        (portfolio.cash || 0);
      const initialValue =
        portfolio.initialValue !== undefined ? portfolio.initialValue : 0;
      const totalReturn =
        initialValue && initialValue > 0
          ? ((totalValue - initialValue) / initialValue) * 100
          : 0;

      // Positionen mit aktualisierten Werten speichern
      for (const position of updatedPositions) {
        await this.prisma.portfolioPosition.update({
          where: { id: position.id },
          data: {
            currentPrice: position.currentPrice,
            value: position.value,
            unrealizedPnL: position.unrealizedPnL,
            weight: totalValue > 0 ? (position.value / totalValue) * 100 : 0,
            lastUpdated: new Date(),
          },
        });
      }

      // Portfolio aktualisieren
      await this.prisma.portfolio.update({
        where: { id: portfolioId },
        data: {
          currentValue: totalValue,
          totalReturn,
          updatedAt: new Date(),
        },
      });

      this.logger.debug(`Portfolio-Metriken für ${portfolioId} aktualisiert`);
    } catch (error) {
      this.logger.error(
        `Fehler beim Aktualisieren der Portfolio-Metriken:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Berechnet Portfolio-Metriken
   */
  async calculatePortfolioMetrics(
    portfolio: Portfolio,
  ): Promise<PortfolioMetrics> {
    try {
      const positions = portfolio.positions;
      const totalValue =
        positions.reduce((sum, pos) => sum + (pos.value || 0), 0) +
        (portfolio.cash || 0);

      // Einfache Metriken berechnen
      const totalReturn =
        portfolio.initialValue && portfolio.initialValue > 0
          ? ((totalValue - portfolio.initialValue) / portfolio.initialValue) *
            100
          : 0;

      // Volatilität und andere Metriken würden hier berechnet werden
      const volatility = await this.calculateVolatility(positions);
      const sharpeRatio = await this.calculateSharpeRatio(positions);
      const maxDrawdown = await this.calculateMaxDrawdown(positions);

      return {
        totalValue,
        dailyReturn: portfolio.dailyReturn || 0,
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        volatility,
      };
    } catch (error) {
      this.logger.error(
        'Fehler bei der Berechnung der Portfolio-Metriken:',
        error,
      );
      throw error;
    }
  }

  /**
   * Bewertet Portfolio-Risiko
   */
  async assessPortfolioRisk(portfolio: Portfolio): Promise<RiskAssessment> {
    try {
      const metrics = await this.calculateRiskMetrics(portfolio);
      const riskScore = this.calculateRiskScore(metrics);
      const riskLevel = this.determineRiskLevel(riskScore);

      const assessment: RiskAssessment = {
        portfolioId: portfolio.id,
        riskScore,
        riskLevel,
        metrics,
        alerts: [], // Würde basierend auf Limits generiert
        recommendations: this.generateRecommendations(metrics),
        timestamp: new Date(),
        compliance: {
          isCompliant: true,
          violations: 0,
          lastCheck: new Date(),
        },
      };

      // Risk Assessment in Datenbank speichern
      await this.prisma.riskAssessment.create({
        data: {
          portfolioId: portfolio.id,
          riskScore,
          riskLevel,
          metrics: JSON.stringify(metrics),
          isCompliant: assessment.compliance.isCompliant,
          violations: assessment.compliance.violations,
        },
      });

      return assessment;
    } catch (error) {
      this.logger.error('Fehler bei der Risikobewertung:', error);
      throw error;
    }
  }

  /**
   * Optimiert Portfolio
   */
  async optimizePortfolio(_portfolio: Portfolio): Promise<PortfolioPosition[]> {
    // Placeholder für Portfolio-Optimierung
    // Würde moderne Portfolio-Theorie implementieren
    return [];
  }

  /**
   * Holt aktuelle Preise für alle Positionen
   */
  private async getCurrentPrices(
    tickers: string[],
  ): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    for (const ticker of tickers) {
      try {
        // Hole aktuellen Preis aus der Datenbank
        const latestData = await this.prisma.historicalData.findFirst({
          where: { stock: { ticker } },
          orderBy: { timestamp: 'desc' },
        });

        if (latestData) {
          priceMap.set(ticker, latestData.close);
        }
      } catch (error) {
        this.logger.warn(
          `Fehler beim Abrufen des Preises für ${ticker}:`,
          error,
        );
      }
    }

    return priceMap;
  }

  /**
   * Berechnet Volatilität
   */
  private async calculateVolatility(
    _positions: PortfolioPosition[],
  ): Promise<number> {
    // Placeholder - würde historische Returns verwenden
    return 0.15;
  }

  /**
   * Berechnet Sharpe Ratio
   */
  private async calculateSharpeRatio(
    _positions: PortfolioPosition[],
  ): Promise<number> {
    // Placeholder - würde historische Returns verwenden
    return 1.2;
  }

  /**
   * Berechnet Maximum Drawdown
   */
  private async calculateMaxDrawdown(
    _positions: PortfolioPosition[],
  ): Promise<number> {
    // Placeholder - würde historische Returns verwenden
    return 0.08;
  }

  /**
   * Berechnet Risiko-Metriken
   */
  private async calculateRiskMetrics(
    portfolio: Portfolio,
  ): Promise<RiskMetrics> {
    const positions = portfolio.positions;
    const volatility = await this.calculateVolatility(positions);
    const sharpeRatio = await this.calculateSharpeRatio(positions);
    const maxDrawdown = await this.calculateMaxDrawdown(positions);

    return {
      volatility,
      sharpeRatio,
      maxDrawdown,
      beta: 1.0, // Placeholder
      var: 0.05, // Placeholder
      cvar: 0.07, // Placeholder
      correlations: {},
      sectorExposure: [],
      concentrationRisk: 0.3, // Placeholder
      liquidity: 0.85,
      leverage: 1.0,
      correlation: 0.6,
    };
  }

  /**
   * Berechnet Risiko-Score
   */
  private calculateRiskScore(metrics: RiskMetrics): number {
    let score = 50; // Base score

    // Adjust based on volatility
    score += (metrics.volatility - 0.2) * 100;

    // Adjust based on max drawdown
    score += metrics.maxDrawdown * 100;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Bestimmt Risiko-Level
   */
  private determineRiskLevel(
    riskScore: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskScore < 25) return 'LOW';
    if (riskScore < 50) return 'MEDIUM';
    if (riskScore < 75) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Generiert Empfehlungen
   */
  private generateRecommendations(metrics: RiskMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.volatility > 0.25) {
      recommendations.push('Hohe Volatilität - Diversifikation erhöhen');
    }

    if (metrics.maxDrawdown > 0.15) {
      recommendations.push('Hoher Drawdown - Risikomanagement überprüfen');
    }

    if (metrics.sharpeRatio < 1.0) {
      recommendations.push(
        'Niedrige Sharpe Ratio - Portfolio-Optimierung erwägen',
      );
    }

    return recommendations;
  }

  /**
   * Mappt Datenbank-Portfolio zu Interface
   */
  private mapToPortfolioInterface(dbPortfolio: any): Portfolio {
    return {
      id: dbPortfolio.id,
      name: dbPortfolio.name,
      totalValue: dbPortfolio.currentValue,
      cash: dbPortfolio.cash,
      positions: dbPortfolio.positions.map((pos: any) => ({
        ticker: pos.ticker,
        symbol: pos.ticker,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentPrice: pos.currentPrice,
        unrealizedPL: pos.unrealizedPnL,
        unrealizedPnL: pos.unrealizedPnL,
        value: pos.value,
        weight: pos.weight,
        lastUpdated: pos.lastUpdated,
        sector: pos.sector,
      })),
      dailyReturn: dbPortfolio.dailyReturn,
      totalReturn: dbPortfolio.totalReturn,
      createdAt: dbPortfolio.createdAt,
      updatedAt: dbPortfolio.updatedAt,
      initialValue: dbPortfolio.initialValue,
      sharpeRatio: dbPortfolio.sharpeRatio,
      maxDrawdown: dbPortfolio.maxDrawdown,
    };
  }

  /**
   * Generiert eindeutige ID
   */
  private generateId(): string {
    return `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Type Guards
   */
  private isPortfolioPosition(
    position: Position | PortfolioPosition,
  ): position is PortfolioPosition {
    return (
      position &&
      'ticker' in position &&
      typeof position.ticker === 'string' &&
      typeof position.quantity === 'number' &&
      typeof position.averagePrice === 'number'
    );
  }

  private isPosition(
    position: Position | PortfolioPosition,
  ): position is Position {
    return (
      position &&
      'symbol' in position &&
      typeof position.symbol === 'string' &&
      typeof position.quantity === 'number' &&
      typeof position.averagePrice === 'number'
    );
  }
}
