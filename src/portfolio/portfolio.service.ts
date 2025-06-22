import { Injectable, Logger } from '@nestjs/common';
import {
  Portfolio,
  PortfolioPosition,
  Position,
  RiskAssessment,
} from '../common/types';
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

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  // Temporary in-memory storage for portfolios (would be replaced with proper DB integration)
  private portfolios: Map<string, Portfolio> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Erstellt ein neues Portfolio
   */
  async createPortfolio(
    name: string,
    initialPositions?: PortfolioPosition[],
  ): Promise<Portfolio> {
    const portfolio: Portfolio = {
      id: this.generateId(),
      name,
      totalValue: 0,
      positions: initialPositions || [],
      dailyReturn: 0,
      totalReturn: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (initialPositions?.length) {
      await this.updatePortfolioMetrics(portfolio);
    }

    // Store portfolio in temporary in-memory storage
    this.portfolios.set(portfolio.id, portfolio);

    return portfolio;
  }
  /**
   * Erstellt ein neues Portfolio mit Startkapital
   */
  async createPortfolioWithCapital(
    name: string,
    initialCapital: number,
  ): Promise<Portfolio> {
    const portfolio: Portfolio = {
      id: this.generateId(),
      name,
      totalValue: initialCapital,
      positions: [],
      dailyReturn: 0,
      totalReturn: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      initialValue: initialCapital,
    };

    // Speichere Portfolio im In-Memory-Storage
    this.portfolios.set(portfolio.id, portfolio);
    this.logger.log(`Portfolio erstellt: ${portfolio.name} (${portfolio.id})`);

    return portfolio;
  }

  /**
   * Holt alle Portfolios
   */
  async getAllPortfolios(): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values());
  }

  /**
   * Holt ein spezifisches Portfolio
   */
  async getPortfolio(portfolioId: string): Promise<Portfolio | null> {
    return this.portfolios.get(portfolioId) || null;
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
      const portfolio = this.portfolios.get(portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} nicht gefunden`);
      }

      // Prüfe ob Position bereits existiert
      const existingPosition = portfolio.positions.find(
        p => p.ticker === ticker,
      );

      if (existingPosition) {
        // Aktualisiere existierende Position (Average Cost)
        const totalCost =
          existingPosition.quantity * existingPosition.averagePrice +
          quantity * price;
        const totalQuantity = existingPosition.quantity + quantity;

        existingPosition.quantity = totalQuantity;
        existingPosition.averagePrice = totalCost / totalQuantity;
        existingPosition.lastUpdated = new Date();
      } else {
        // Füge neue Position hinzu
        const newPosition: PortfolioPosition = {
          ticker,
          symbol: ticker, // Beide Felder setzen für Kompatibilität
          quantity,
          averagePrice: price,
          currentPrice: price,
          unrealizedPL: 0,
          unrealizedPnL: 0,
          value: quantity * price,
          weight: 0, // Wird bei Portfolio-Update berechnet
          lastUpdated: new Date(),
        };

        portfolio.positions.push(newPosition);
      }

      // Update Portfolio
      portfolio.updatedAt = new Date();
      await this.updatePortfolioMetrics(portfolio);

      this.logger.log(
        `Position hinzugefügt: ${quantity} x ${ticker} @ ${price}`,
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
      const portfolio = this.portfolios.get(portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} nicht gefunden`);
      }

      const positionIndex = portfolio.positions.findIndex(
        p => p.ticker === ticker,
      );
      if (positionIndex === -1) {
        throw new Error(`Position ${ticker} nicht im Portfolio gefunden`);
      }

      // Entferne Position
      portfolio.positions.splice(positionIndex, 1);
      portfolio.updatedAt = new Date();

      // Update Portfolio-Metriken
      await this.updatePortfolioMetrics(portfolio);

      this.logger.log(
        `Position ${ticker} aus Portfolio ${portfolioId} entfernt`,
      );
    } catch (error) {
      this.logger.error(`Fehler beim Entfernen der Position:`, error);
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
      // Hole aktuelle Preise für alle Positionen
      const currentPrices = await this.getCurrentPrices(
        portfolio.positions.map(p => p.ticker),
      );

      // Berechne Gesamtwert
      let totalValue = 0;
      const updatedPositions: PortfolioPosition[] = portfolio.positions.map(
        position => {
          const currentPrice =
            currentPrices.get(position.ticker) || position.averagePrice;
          const positionValue = position.quantity * currentPrice;
          totalValue += positionValue;

          return {
            ...position,
            currentPrice,
            unrealizedPL:
              positionValue - position.quantity * position.averagePrice,
            unrealizedPnL:
              positionValue - position.quantity * position.averagePrice,
            value: positionValue,
            weight: 0, // Wird später berechnet
          };
        },
      );

      // Berechne Gewichtungen
      updatedPositions.forEach(position => {
        position.weight =
          ((position.quantity *
            (position.currentPrice || position.averagePrice)) /
            totalValue) *
          100;
      });

      // Berechne historische Returns für Sharpe Ratio etc.
      const returns = await this.calculatePortfolioReturns(updatedPositions);
      const sharpeRatio = this.calculateSharpeRatio(returns);
      const maxDrawdown = this.calculateMaxDrawdown(returns);
      const volatility = this.calculateVolatility(returns);

      const metrics: PortfolioMetrics = {
        totalValue,
        dailyReturn: returns.length > 0 ? returns[returns.length - 1] : 0,
        totalReturn: this.calculateTotalReturn(updatedPositions),
        sharpeRatio,
        maxDrawdown,
        volatility,
      };

      return metrics;
    } catch (error) {
      this.logger.error('Fehler bei Portfolio-Metrik-Berechnung:', error);
      throw error;
    }
  }

  /**
   * Führt eine Risikobewertung des Portfolios durch
   */
  async assessPortfolioRisk(portfolio: Portfolio): Promise<RiskAssessment> {
    try {
      const metrics = await this.calculatePortfolioMetrics(portfolio);

      // Berechne Gesamtrisiko-Score
      let riskScore = 0;
      const riskFactors: string[] = [];

      // Volatilitätsrisiko
      if (metrics.volatility > 0.3) {
        riskScore += 30;
        riskFactors.push('Hohe Volatilität');
      } else if (metrics.volatility > 0.2) {
        riskScore += 15;
        riskFactors.push('Mittlere Volatilität');
      }

      // Konzentrations-Risiko
      const totalPortfolioValue = portfolio.totalValue || 1;
      const maxWeight = Math.max(
        ...portfolio.positions.map(p => {
          const positionValue = p.quantity * (p.currentPrice || p.averagePrice);
          return (positionValue / totalPortfolioValue) * 100;
        }),
      );
      if (maxWeight > 30) {
        riskScore += 25;
        riskFactors.push('Hohe Konzentration in Einzelposition');
      } else if (maxWeight > 20) {
        riskScore += 10;
        riskFactors.push('Mittlere Konzentration');
      }

      // Drawdown-Risiko
      if (metrics.maxDrawdown > 0.2) {
        riskScore += 20;
        riskFactors.push('Hohes Drawdown-Risiko');
      }

      // Sharpe Ratio (niedrig = höheres Risiko)
      if (metrics.sharpeRatio < 0.5) {
        riskScore += 15;
        riskFactors.push('Niedrige risikoadjustierte Rendite');
      } // Bestimme Risiko-Level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (riskScore >= 75) {
        riskLevel = 'CRITICAL';
      } else if (riskScore >= 60) {
        riskLevel = 'HIGH';
      } else if (riskScore >= 30) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'LOW';
      }

      const riskAssessment: RiskAssessment = {
        portfolioId: portfolio.id,
        riskScore,
        riskLevel,
        metrics: {
          portfolioRisk: riskScore / 100,
          varDaily: 0, // Vereinfacht für Demo
          varWeekly: 0, // Vereinfacht für Demo
          sharpeRatio: metrics.sharpeRatio,
          sortinoRatio: 0, // Vereinfacht für Demo
          maxDrawdown: metrics.maxDrawdown,
          volatility: metrics.volatility,
          beta: 1, // Vereinfacht für Demo
          correlationMatrix: {}, // Vereinfacht für Demo
          concentrationRisk: 0, // Vereinfacht für Demo
          correlations: {}, // Vereinfacht für Demo
          var: 0, // Vereinfacht für Demo
          cvar: 0, // Vereinfacht für Demo
          liquidityRisk: 0, // Vereinfacht für Demo
          sectorExposure: [], // Vereinfacht für Demo
          liquidity: 0.8,
          leverage: 1.0,
          correlation: 0.6,
        },
        alerts: [],
        recommendations: riskFactors.map(factor => `Überprüfen Sie: ${factor}`),
        timestamp: new Date(),
        compliance: {
          isCompliant: true,
          violations: 0,
          lastCheck: new Date(),
        },
      };

      return riskAssessment;
    } catch (error) {
      this.logger.error('Fehler bei Risikobewertung:', error);
      throw error;
    }
  }

  /**
   * Optimiert Portfolio-Allokation (vereinfachte Mean Reversion)
   */
  async optimizePortfolio(_portfolio: Portfolio): Promise<PortfolioPosition[]> {
    try {
      // Hole historische Daten für alle Positionen
      const positions = _portfolio.positions;
      const optimizedPositions: PortfolioPosition[] = [];

      for (const position of positions) {
        // Berechne optimale Gewichtung basierend auf Risiko-Return-Profil
        const historicalData = await this.getHistoricalReturns(
          position.ticker,
          252,
        ); // 1 Jahr
        const expectedReturn = this.calculateExpectedReturn(historicalData);
        const variance = this.calculateVariance(historicalData);

        // Einfache Markowitz-ähnliche Optimierung
        const riskAdjustedWeight = expectedReturn / variance;

        optimizedPositions.push({
          ...position,
          ticker: position.ticker,
          symbol: position.symbol || position.ticker, // Ensure symbol is defined
          lastUpdated: position.lastUpdated,
          weight: riskAdjustedWeight,
        });
      }

      // Normalisiere Gewichtungen auf 100%
      const totalWeight = optimizedPositions.reduce(
        (sum, pos) => sum + (pos.weight || 0),
        0,
      );
      optimizedPositions.forEach(pos => {
        if (pos.weight && totalWeight > 0) {
          pos.weight = (pos.weight / totalWeight) * 100;
        }
      });

      return optimizedPositions;
    } catch (error) {
      this.logger.error('Fehler bei Portfolio-Optimierung:', error);
      throw error;
    }
  }

  // Hilfsmethoden

  private async getCurrentPrices(
    tickers: string[],
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    for (const ticker of tickers) {
      try {
        const latestData = await this.prisma.historicalData.findFirst({
          where: { stock: { ticker } },
          orderBy: { timestamp: 'desc' },
        });

        if (latestData) {
          prices.set(ticker, latestData.close);
        }
      } catch (error) {
        this.logger.warn(`Kein aktueller Preis für ${ticker} gefunden`);
      }
    }

    return prices;
  }

  private async calculatePortfolioReturns(
    _positions: PortfolioPosition[],
  ): Promise<number[]> {
    // Vereinfachte Implementierung - in Realität würde man historische Portfolio-Werte berechnen
    const returns: number[] = [];

    // Placeholder - echte Implementierung würde historische Daten verwenden
    for (let i = 0; i < 30; i++) {
      returns.push((Math.random() - 0.5) * 0.02); // Random returns für Demo
    }

    return returns;
  }

  private calculateSharpeRatio(
    returns: number[],
    riskFreeRate: number = 0.02,
  ): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length;
    const volatility = Math.sqrt(variance);

    return volatility > 0
      ? (avgReturn * 252 - riskFreeRate) / (volatility * Math.sqrt(252))
      : 0;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = 1;
    let currentValue = 1;

    for (const returnVal of returns) {
      currentValue *= 1 + returnVal;
      if (currentValue > peak) {
        peak = currentValue;
      }
      const drawdown = (peak - currentValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length;

    return Math.sqrt(variance * 252); // Annualisiert
  }

  private calculateTotalReturn(positions: PortfolioPosition[]): number {
    let totalCost = 0;
    let totalValue = 0;

    positions.forEach(position => {
      totalCost += position.quantity * position.averagePrice;
      totalValue +=
        position.quantity * (position.currentPrice || position.averagePrice);
    });

    return totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;
  }

  private async calculatePositionRisks(
    _positions: PortfolioPosition[],
  ): Promise<PositionRisk[]> {
    // Placeholder implementation
    return [];
  }

  private async getHistoricalReturns(
    ticker: string,
    days: number,
  ): Promise<number[]> {
    const data = await this.prisma.historicalData.findMany({
      where: { stock: { ticker } },
      orderBy: { timestamp: 'desc' },
      take: days + 1,
    });

    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const returnVal = (data[i - 1].close - data[i].close) / data[i].close;
      returns.push(returnVal);
    }

    return returns.reverse();
  }

  private calculateExpectedReturn(returns: number[]): number {
    return returns.length > 0
      ? returns.reduce((sum, r) => sum + r, 0) / returns.length
      : 0;
  }

  private calculateVariance(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = this.calculateExpectedReturn(returns);
    return (
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length
    );
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async updatePortfolioMetrics(portfolio: Portfolio): Promise<void> {
    const metrics = await this.calculatePortfolioMetrics(portfolio);
    portfolio.totalValue = metrics.totalValue;
    portfolio.dailyReturn = metrics.dailyReturn;
    portfolio.totalReturn = metrics.totalReturn;
    portfolio.sharpeRatio = metrics.sharpeRatio;
    portfolio.maxDrawdown = metrics.maxDrawdown;
    portfolio.updatedAt = new Date();
  }

  // Type Guards für Position-Interfaces
  private isPortfolioPosition(
    position: Position | PortfolioPosition,
  ): position is PortfolioPosition {
    return 'ticker' in position && 'lastUpdated' in position;
  }

  private isPosition(
    position: Position | PortfolioPosition,
  ): position is Position {
    return 'symbol' in position && !('ticker' in position);
  }
}
