import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../persistence/prisma.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import {
  Portfolio,
  PortfolioPosition,
  RiskAssessment,
  MarketSentiment,
  SystemHealth,
  TechnicalIndicators,
} from "../common/types";

export interface RiskMetrics {
  portfolioRisk: number;
  varDaily: number; // Value at Risk (1 Tag, 95% Konfidenz)
  varWeekly: number; // Value at Risk (1 Woche, 95% Konfidenz)
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta: number; // Beta zum Markt (S&P 500 als Proxy)
  correlationMatrix: { [ticker: string]: { [ticker: string]: number } };
  concentrationRisk: number;
  liquidityRisk: number;
}

export interface RiskLimits {
  maxPositionSize: number; // % des Portfolios
  maxSectorExposure: number; // % des Portfolios
  maxDrawdown: number; // %
  minLiquidity: number; // Mindest-Cash-Anteil
  maxLeverage: number; // Maximum Leverage Ratio
  maxCorrelation: number; // Max Korrelation zwischen Positionen
  stopLossLevel: number; // % für automatische Stop-Loss
}

export interface RiskAlert {
  id: string;
  type:
    | "POSITION_SIZE"
    | "CONCENTRATION"
    | "DRAWDOWN"
    | "CORRELATION"
    | "VOLATILITY"
    | "LIQUIDITY";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  portfolioId?: string;
  ticker?: string;
}

@Injectable()
export class RiskManagementService {
  private readonly logger = new Logger(RiskManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysisEngine: AnalysisEngineService,
  ) {}

  /**
   * Berechnet umfassende Risikometriken für ein Portfolio
   */
  async calculateRiskMetrics(portfolio: Portfolio): Promise<RiskMetrics> {
    try {
      this.logger.log(
        `📊 Berechne Risikometriken für Portfolio ${portfolio.name}...`,
      );

      // Hole historische Daten für alle Positionen
      const historicalDataMap = await this.getHistoricalDataForPositions(
        portfolio.positions,
      );

      // Berechne einzelne Risikometriken
      const portfolioReturns = await this.calculatePortfolioReturns(
        portfolio,
        historicalDataMap,
      );
      const volatility = this.calculateVolatility(portfolioReturns);
      const varDaily = this.calculateVaR(portfolioReturns, 1);
      const varWeekly = this.calculateVaR(portfolioReturns, 5);
      const sharpeRatio = this.calculateSharpeRatio(portfolioReturns);
      const sortinoRatio = this.calculateSortinoRatio(portfolioReturns);
      const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);
      const beta = await this.calculatePortfolioBeta(
        portfolio,
        historicalDataMap,
      );
      const correlationMatrix =
        this.calculateCorrelationMatrix(historicalDataMap);
      const concentrationRisk = this.calculateConcentrationRisk(portfolio);
      const liquidityRisk = this.calculateLiquidityRisk(portfolio);

      const portfolioRisk = this.calculateOverallRisk({
        volatility,
        maxDrawdown,
        concentrationRisk,
        liquidityRisk,
      });

      const metrics: RiskMetrics = {
        portfolioRisk,
        varDaily,
        varWeekly,
        sharpeRatio,
        sortinoRatio,
        maxDrawdown,
        volatility,
        beta,
        correlationMatrix,
        concentrationRisk,
        liquidityRisk,
      };

      this.logger.log(
        `✅ Risikometriken berechnet - Portfolio Risk: ${portfolioRisk.toFixed(2)}`,
      );
      return metrics;
    } catch (error) {
      this.logger.error(`Fehler bei der Risikoberechnung:`, error);
      throw error;
    }
  }

  /**
   * Erstellt eine Risikobewertung für ein Portfolio
   */
  async assessPortfolioRisk(
    portfolio: Portfolio,
    riskLimits: RiskLimits,
  ): Promise<RiskAssessment> {
    try {
      const metrics = await this.calculateRiskMetrics(portfolio);
      const alerts = await this.checkRiskLimits(portfolio, metrics, riskLimits);

      // Berechne Gesamt-Risiko-Score (0-100)
      let riskScore = 0;

      // Volatilität (0-40 Punkte)
      riskScore += Math.min(40, metrics.volatility * 200);

      // Konzentration (0-30 Punkte)
      riskScore += Math.min(30, metrics.concentrationRisk * 100);

      // Liquidität (0-20 Punkte)
      riskScore += Math.min(20, metrics.liquidityRisk * 50);

      // Drawdown (0-10 Punkte)
      riskScore += Math.min(10, metrics.maxDrawdown * 50);

      // Bestimme Risiko-Level
      let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      if (riskScore < 25) riskLevel = "LOW";
      else if (riskScore < 50) riskLevel = "MEDIUM";
      else if (riskScore < 75) riskLevel = "HIGH";
      else riskLevel = "CRITICAL";

      const recommendations = this.generateRiskRecommendations(
        metrics,
        alerts,
        riskLimits,
      );

      return {
        portfolioId: portfolio.id,
        riskScore,
        riskLevel,
        metrics,
        alerts,
        recommendations,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Fehler bei der Risikobewertung:`, error);
      throw error;
    }
  }

  /**
   * Prüft Risikogrenzen und erstellt Alerts
   */
  private async checkRiskLimits(
    portfolio: Portfolio,
    metrics: RiskMetrics,
    limits: RiskLimits,
  ): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];

    // Positionsgrößen prüfen
    for (const position of portfolio.positions) {
      const positionWeight = (position.weight || 0) * 100;
      if (positionWeight > limits.maxPositionSize) {
        alerts.push({
          id: `pos_${position.ticker}_${Date.now()}`,
          type: "POSITION_SIZE",
          severity:
            positionWeight > limits.maxPositionSize * 1.5 ? "CRITICAL" : "HIGH",
          message: `Position ${position.ticker} überschreitet Größenlimit`,
          value: positionWeight,
          threshold: limits.maxPositionSize,
          timestamp: new Date(),
          portfolioId: portfolio.id,
          ticker: position.ticker,
        });
      }
    }

    // Konzentration prüfen
    if (metrics.concentrationRisk > limits.maxSectorExposure / 100) {
      alerts.push({
        id: `conc_${Date.now()}`,
        type: "CONCENTRATION",
        severity:
          metrics.concentrationRisk > (limits.maxSectorExposure / 100) * 1.5
            ? "CRITICAL"
            : "HIGH",
        message: "Portfolio-Konzentration überschreitet Limit",
        value: metrics.concentrationRisk * 100,
        threshold: limits.maxSectorExposure,
        timestamp: new Date(),
        portfolioId: portfolio.id,
      });
    }

    // Drawdown prüfen
    if (metrics.maxDrawdown > limits.maxDrawdown / 100) {
      alerts.push({
        id: `dd_${Date.now()}`,
        type: "DRAWDOWN",
        severity:
          metrics.maxDrawdown > (limits.maxDrawdown / 100) * 1.5
            ? "CRITICAL"
            : "HIGH",
        message: "Maximum Drawdown überschritten",
        value: metrics.maxDrawdown * 100,
        threshold: limits.maxDrawdown,
        timestamp: new Date(),
        portfolioId: portfolio.id,
      });
    }

    // Volatilität prüfen
    if (metrics.volatility > 0.3) {
      // 30% annualisiert
      alerts.push({
        id: `vol_${Date.now()}`,
        type: "VOLATILITY",
        severity: metrics.volatility > 0.5 ? "CRITICAL" : "HIGH",
        message: "Portfolio-Volatilität sehr hoch",
        value: metrics.volatility * 100,
        threshold: 30,
        timestamp: new Date(),
        portfolioId: portfolio.id,
      });
    }

    return alerts;
  }

  /**
   * Generiert Risiko-Empfehlungen
   */
  private generateRiskRecommendations(
    metrics: RiskMetrics,
    alerts: RiskAlert[],
    limits: RiskLimits,
  ): string[] {
    const recommendations: string[] = [];

    // Konzentrations-Empfehlungen
    if (metrics.concentrationRisk > 0.3) {
      recommendations.push(
        "Diversifizierung erhöhen - Portfolio ist zu konzentriert",
      );
    }

    // Korrelations-Empfehlungen
    const highCorrelations = Object.values(metrics.correlationMatrix)
      .flatMap((correlations) => Object.values(correlations))
      .filter((corr) => Math.abs(corr) > 0.8);

    if (highCorrelations.length > 0) {
      recommendations.push("Korrelation zwischen Positionen reduzieren");
    }

    // Volatilitäts-Empfehlungen
    if (metrics.volatility > 0.25) {
      recommendations.push(
        "Portfolio-Volatilität durch defensive Positionen reduzieren",
      );
    }

    // Sharpe Ratio Empfehlungen
    if (metrics.sharpeRatio < 0.5) {
      recommendations.push(
        "Risiko-Rendite-Verhältnis durch Optimierung verbessern",
      );
    }

    // Liquiditäts-Empfehlungen
    if (metrics.liquidityRisk > 0.3) {
      recommendations.push("Liquiditätsreserven erhöhen");
    }

    // Alert-basierte Empfehlungen
    const criticalAlerts = alerts.filter(
      (alert) => alert.severity === "CRITICAL",
    );
    if (criticalAlerts.length > 0) {
      recommendations.push(
        "Sofortige Maßnahmen erforderlich - kritische Risikogrenzen überschritten",
      );
    }

    return recommendations;
  }

  /**
   * Berechnet Portfolio-Returns basierend auf historischen Daten
   */
  private async calculatePortfolioReturns(
    portfolio: Portfolio,
    historicalDataMap: Map<string, any[]>,
  ): Promise<number[]> {
    const allDates = new Set<string>();

    // Sammle alle verfügbaren Datumsangaben
    for (const [ticker, data] of historicalDataMap.entries()) {
      data.forEach((point) =>
        allDates.add(point.timestamp.toISOString().split("T")[0]),
      );
    }

    const sortedDates = Array.from(allDates).sort();
    const returns: number[] = [];

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currentDate = sortedDates[i];

      let portfolioReturn = 0;
      let totalWeight = 0;

      for (const position of portfolio.positions) {
        const data = historicalDataMap.get(position.ticker);
        if (!data) continue;

        const prevPrice = data.find(
          (d) => d.timestamp.toISOString().split("T")[0] === prevDate,
        )?.close;
        const currentPrice = data.find(
          (d) => d.timestamp.toISOString().split("T")[0] === currentDate,
        )?.close;

        if (prevPrice && currentPrice) {
          const positionReturn = (currentPrice - prevPrice) / prevPrice;
          const weight = position.weight || 1 / portfolio.positions.length;
          portfolioReturn += positionReturn * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight > 0) {
        returns.push(portfolioReturn / totalWeight);
      }
    }

    return returns;
  }

  /**
   * Hole historische Daten für alle Portfolio-Positionen
   */
  private async getHistoricalDataForPositions(
    positions: PortfolioPosition[],
  ): Promise<Map<string, any[]>> {
    const dataMap = new Map<string, any[]>();

    for (const position of positions) {
      try {
        const data = await this.prisma.historicalData.findMany({
          where: {
            stock: { ticker: position.ticker },
          },
          orderBy: { timestamp: "desc" },
          take: 252, // 1 Jahr tägliche Daten
        });

        if (data.length > 0) {
          dataMap.set(position.ticker, data.reverse()); // Chronologisch sortieren
        }
      } catch (error) {
        this.logger.warn(`Keine Daten für ${position.ticker} gefunden`);
      }
    }

    return dataMap;
  }

  /**
   * Berechnet die Volatilität (annualisiert)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) /
      (returns.length - 1);

    return Math.sqrt(variance * 252); // Annualisiert (252 Handelstage)
  }

  /**
   * Berechnet Value at Risk (VaR)
   */
  private calculateVaR(
    returns: number[],
    timeHorizon: number,
    confidence: number = 0.95,
  ): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    const var95 = sortedReturns[index] || 0;

    return Math.abs(var95) * Math.sqrt(timeHorizon);
  }

  /**
   * Berechnet die Sharpe Ratio
   */
  private calculateSharpeRatio(
    returns: number[],
    riskFreeRate: number = 0.02,
  ): number {
    if (returns.length === 0) return 0;

    const meanReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const annualizedReturn = meanReturn * 252;
    const volatility = this.calculateVolatility(returns);

    return volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
  }

  /**
   * Berechnet die Sortino Ratio
   */
  private calculateSortinoRatio(
    returns: number[],
    riskFreeRate: number = 0.02,
  ): number {
    if (returns.length === 0) return 0;

    const meanReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const annualizedReturn = meanReturn * 252;

    const negativeReturns = returns.filter((ret) => ret < 0);
    if (negativeReturns.length === 0) return Infinity;

    const meanNegativeReturn =
      negativeReturns.reduce((sum, ret) => sum + ret, 0) /
      negativeReturns.length;
    const downwardDeviation =
      Math.sqrt(
        negativeReturns.reduce(
          (sum, ret) => sum + Math.pow(ret - meanNegativeReturn, 2),
          0,
        ) / negativeReturns.length,
      ) * Math.sqrt(252);

    return downwardDeviation > 0
      ? (annualizedReturn - riskFreeRate) / downwardDeviation
      : 0;
  }

  /**
   * Berechnet Maximum Drawdown
   */
  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let peak = 1;
    let maxDrawdown = 0;
    let portfolioValue = 1;

    for (const ret of returns) {
      portfolioValue *= 1 + ret;

      if (portfolioValue > peak) {
        peak = portfolioValue;
      }

      const drawdown = (peak - portfolioValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Berechnet Portfolio Beta
   */
  private async calculatePortfolioBeta(
    portfolio: Portfolio,
    historicalDataMap: Map<string, any[]>,
  ): Promise<number> {
    // Vereinfachte Beta-Berechnung
    // In einer realen Implementierung würde man einen Marktindex verwenden
    return 1.0; // Placeholder
  }

  /**
   * Berechnet Korrelationsmatrix
   */
  private calculateCorrelationMatrix(historicalDataMap: Map<string, any[]>): {
    [ticker: string]: { [ticker: string]: number };
  } {
    const tickers = Array.from(historicalDataMap.keys());
    const matrix: { [ticker: string]: { [ticker: string]: number } } = {};

    for (const ticker1 of tickers) {
      matrix[ticker1] = {};
      for (const ticker2 of tickers) {
        if (ticker1 === ticker2) {
          matrix[ticker1][ticker2] = 1.0;
        } else {
          matrix[ticker1][ticker2] = this.calculateCorrelation(
            historicalDataMap.get(ticker1) || [],
            historicalDataMap.get(ticker2) || [],
          );
        }
      }
    }

    return matrix;
  }

  /**
   * Berechnet Korrelation zwischen zwei Zeitreihen
   */
  private calculateCorrelation(data1: any[], data2: any[]): number {
    if (data1.length !== data2.length || data1.length < 2) return 0;

    const returns1 = this.calculateReturns(data1.map((d) => d.close));
    const returns2 = this.calculateReturns(data2.map((d) => d.close));

    if (returns1.length !== returns2.length || returns1.length < 2) return 0;

    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;

      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Berechnet Returns aus Preisdaten
   */
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    return returns;
  }

  /**
   * Berechnet Konzentrationsrisiko
   */
  private calculateConcentrationRisk(portfolio: Portfolio): number {
    if (portfolio.positions.length === 0) return 0;

    const weights = portfolio.positions.map(
      (pos) => pos.weight || 1 / portfolio.positions.length,
    );
    const herfindahlIndex = weights.reduce(
      (sum, weight) => sum + weight * weight,
      0,
    );

    return herfindahlIndex;
  }

  /**
   * Berechnet Liquiditätsrisiko
   */
  private calculateLiquidityRisk(portfolio: Portfolio): number {
    // Vereinfachte Berechnung basierend auf Portfolio-Größe
    // In einer realen Implementierung würde man Handelsvolumen und Spreads berücksichtigen
    const avgPositionSize =
      portfolio.positions.length > 0
        ? portfolio.totalValue / portfolio.positions.length
        : 0;

    // Normalisiere auf 0-1 Skala (größere Positionen = höheres Liquiditätsrisiko)
    return Math.min(1, avgPositionSize / 100000); // 100k als Referenz
  }

  /**
   * Berechnet Gesamt-Risiko-Score
   */
  private calculateOverallRisk(components: {
    volatility: number;
    maxDrawdown: number;
    concentrationRisk: number;
    liquidityRisk: number;
  }): number {
    const weights = {
      volatility: 0.3,
      maxDrawdown: 0.3,
      concentrationRisk: 0.25,
      liquidityRisk: 0.15,
    };

    return (
      components.volatility * weights.volatility +
      components.maxDrawdown * weights.maxDrawdown +
      components.concentrationRisk * weights.concentrationRisk +
      components.liquidityRisk * weights.liquidityRisk
    );
  }

  /**
   * Standard-Risikogrenzen
   */
  static getDefaultRiskLimits(): RiskLimits {
    return {
      maxPositionSize: 15, // 15% des Portfolios
      maxSectorExposure: 30, // 30% des Portfolios
      maxDrawdown: 20, // 20%
      minLiquidity: 5, // 5% Cash
      maxLeverage: 1.5, // 1.5x Leverage
      maxCorrelation: 0.7, // 70% Korrelation
      stopLossLevel: 10, // 10% Stop-Loss
    };
  }

  /**
   * Konservative Risikogrenzen
   */
  static getConservativeRiskLimits(): RiskLimits {
    return {
      maxPositionSize: 10,
      maxSectorExposure: 20,
      maxDrawdown: 15,
      minLiquidity: 10,
      maxLeverage: 1.2,
      maxCorrelation: 0.5,
      stopLossLevel: 8,
    };
  }

  /**
   * Aggressive Risikogrenzen
   */
  static getAggressiveRiskLimits(): RiskLimits {
    return {
      maxPositionSize: 25,
      maxSectorExposure: 50,
      maxDrawdown: 30,
      minLiquidity: 2,
      maxLeverage: 2.0,
      maxCorrelation: 0.8,
      stopLossLevel: 15,
    };
  }
}
