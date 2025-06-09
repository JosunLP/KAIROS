import { Injectable } from "@nestjs/common";
import { PrismaService } from "../persistence/prisma.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import {
  Portfolio,
  PortfolioPosition,
  RiskAssessment,
  RiskLimits,
  RiskAlert,
  RiskMetrics,
  SectorExposure,
  StockData,
} from "../common/types";

@Injectable()
export class RiskManagementService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly analysisEngineService: AnalysisEngineService,
  ) {}

  // Type Guards
  private isPortfolioPosition(position: any): position is PortfolioPosition {
    return (
      position &&
      typeof position.ticker === "string" &&
      typeof position.quantity === "number" &&
      typeof position.averagePrice === "number"
    );
  }

  async assessPortfolioRisk(
    portfolio: Portfolio,
    riskLimits: RiskLimits,
  ): Promise<RiskAssessment> {
    const riskMetrics = await this.calculateRiskMetrics(portfolio);
    const alerts = await this.checkRiskLimits(portfolio, riskLimits);

    return {
      portfolioId: portfolio.id,
      timestamp: new Date(),
      riskScore: this.calculateRiskScore(riskMetrics),
      riskLevel: this.determineRiskLevel(riskMetrics, riskLimits) as
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "CRITICAL",
      metrics: riskMetrics,
      alerts,
      recommendations: this.generateRecommendations(riskMetrics, alerts),
      compliance: {
        isCompliant: alerts.length === 0,
        violations: alerts.length,
        lastCheck: new Date(),
      },
    };
  }

  async calculateRiskMetrics(portfolio: Portfolio): Promise<RiskMetrics> {
    const positions = portfolio.positions.filter(this.isPortfolioPosition);

    const volatility = await this.calculatePortfolioVolatility(positions);
    const sharpeRatio = await this.calculateSharpeRatio(portfolio);
    const maxDrawdown = await this.calculateMaxDrawdown(positions);
    const beta = await this.calculatePortfolioBeta(positions);
    const var95 = await this.calculateVaR(positions, 0.95);
    const sectorExposure = await this.calculateSectorExposure(positions);
    const concentrationRisk = this.calculateConcentrationRisk(positions);

    return {
      volatility,
      sharpeRatio,
      maxDrawdown,
      beta,
      var: var95,
      sectorExposure,
      concentrationRisk,
      liquidity: 0.85, // Placeholder
      leverage: 1.0, // Placeholder
      correlation: 0.6, // Placeholder
    };
  }
  async calculateSectorExposure(
    positions: PortfolioPosition[],
  ): Promise<SectorExposure[]> {
    const sectorMap = new Map<string, number>();
    const sectorTickers = new Map<string, string[]>();
    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.quantity * (pos.currentPrice || 0),
      0,
    );

    // Mock sector assignment based on ticker
    positions.forEach((position) => {
      let sector = "Other";
      const ticker = position.ticker.toUpperCase();

      if (["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"].includes(ticker)) {
        sector = "Technology";
      } else if (["JPM", "BAC", "WFC", "GS"].includes(ticker)) {
        sector = "Banking";
      } else if (["JNJ", "PFE", "UNH", "ABBV"].includes(ticker)) {
        sector = "Healthcare";
      }

      const positionValue = position.quantity * (position.currentPrice || 0);
      const currentValue = sectorMap.get(sector) || 0;
      sectorMap.set(sector, currentValue + positionValue);

      const currentTickers = sectorTickers.get(sector) || [];
      currentTickers.push(position.ticker);
      sectorTickers.set(sector, currentTickers);
    });

    return Array.from(sectorMap.entries()).map(([sector, value]) => ({
      sector,
      value,
      exposure: value / totalValue,
      percentage: (value / totalValue) * 100,
      tickers: sectorTickers.get(sector) || [],
    }));
  }
  calculateConcentrationRisk(positions: PortfolioPosition[]): number {
    if (positions.length === 0) return 0;

    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.quantity * (pos.currentPrice || 0),
      0,
    );
    const weights = positions.map(
      (pos) => (pos.quantity * (pos.currentPrice || 0)) / totalValue,
    );

    // Herfindahl-Hirschman Index
    return weights.reduce((sum, weight) => sum + weight * weight, 0);
  }

  async checkRiskLimits(
    portfolio: Portfolio,
    riskLimits: RiskLimits,
  ): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    const positions = portfolio.positions.filter(this.isPortfolioPosition);
    const sectorExposure = await this.calculateSectorExposure(positions);
    const concentrationRisk = this.calculateConcentrationRisk(positions);

    // Position size checks
    positions.forEach((position) => {
      const positionWeight = position.weight || 0;
      if (positionWeight > riskLimits.maxPositionSize / 100) {
        alerts.push({
          id: `pos-${position.ticker}`,
          type: "POSITION_SIZE",
          severity: "HIGH",
          metric: "Position Size",
          currentValue: positionWeight * 100,
          value: positionWeight,
          threshold: riskLimits.maxPositionSize,
          message: `Position ${position.ticker} exceeds maximum size limit`,
          timestamp: new Date(),
          portfolioId: portfolio.id,
        });
      }
    });

    // Sector exposure checks
    sectorExposure.forEach((sector) => {
      if (sector.percentage > riskLimits.maxSectorExposure) {
        alerts.push({
          id: `sector-${sector.sector}`,
          type: "CONCENTRATION",
          severity: "MEDIUM",
          metric: "Sector Exposure",
          currentValue: sector.percentage,
          value: sector.percentage / 100,
          threshold: riskLimits.maxSectorExposure,
          message: `${sector.sector} sector exposure exceeds limit`,
          timestamp: new Date(),
          portfolioId: portfolio.id,
        });
      }
    });

    return alerts;
  }

  private calculateRiskScore(metrics: RiskMetrics): number {
    let score = 50; // Base score

    // Adjust based on volatility
    score += (metrics.volatility - 0.2) * 100;

    // Adjust based on concentration
    score += metrics.concentrationRisk * 50;

    // Adjust based on max drawdown
    score += metrics.maxDrawdown * 100;

    return Math.max(0, Math.min(100, score));
  }
  private determineRiskLevel(
    metrics: RiskMetrics,
    limits: RiskLimits,
  ): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    const score = this.calculateRiskScore(metrics);

    if (score < 30) return "LOW";
    if (score < 70) return "MEDIUM";
    return "HIGH";
  }

  private generateRecommendations(
    metrics: RiskMetrics,
    alerts: RiskAlert[],
  ): string[] {
    const recommendations: string[] = [];

    if (alerts.length > 0) {
      recommendations.push(
        "Review risk limit violations and consider rebalancing",
      );
    }

    if (metrics.concentrationRisk > 0.5) {
      recommendations.push(
        "Consider diversifying portfolio to reduce concentration risk",
      );
    }

    if (metrics.volatility > 0.3) {
      recommendations.push(
        "High volatility detected - consider reducing position sizes",
      );
    }

    return recommendations;
  }

  // Placeholder implementations for complex calculations
  private async calculatePortfolioVolatility(
    positions: PortfolioPosition[],
  ): Promise<number> {
    // Simple mock implementation
    return 0.15 + Math.random() * 0.1;
  }

  private async calculateSharpeRatio(portfolio: Portfolio): Promise<number> {
    // Mock implementation
    return 1.2 + Math.random() * 0.5;
  }

  private async calculateMaxDrawdown(
    positions: PortfolioPosition[],
  ): Promise<number> {
    // Mock implementation
    return 0.05 + Math.random() * 0.1;
  }

  private async calculatePortfolioBeta(
    positions: PortfolioPosition[],
  ): Promise<number> {
    // Mock implementation
    return 0.8 + Math.random() * 0.4;
  }

  private async calculateVaR(
    positions: PortfolioPosition[],
    confidence: number,
  ): Promise<number> {
    // Mock implementation
    return 0.03 + Math.random() * 0.02;
  }

  async getHistoricalDataForPositions(
    positions: PortfolioPosition[],
  ): Promise<{ [ticker: string]: StockData[] }> {
    const historicalData: { [ticker: string]: StockData[] } = {};

    for (const position of positions) {
      if (this.isPortfolioPosition(position)) {
        // Mock historical data
        historicalData[position.ticker] = this.generateMockHistoricalData(
          position.ticker,
        );
      }
    }

    return historicalData;
  }

  private generateMockHistoricalData(ticker: string): StockData[] {
    const data: StockData[] = [];
    const basePrice = 100 + Math.random() * 100;

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      data.push({
        symbol: ticker,
        timestamp: date,
        open: basePrice + Math.random() * 10 - 5,
        high: basePrice + Math.random() * 15,
        low: basePrice - Math.random() * 10,
        close: basePrice + Math.random() * 10 - 5,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    return data.reverse();
  }
}
