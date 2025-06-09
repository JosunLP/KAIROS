import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../persistence/prisma.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import {
  BacktestResult,
  BacktestTrade,
  Portfolio,
  PortfolioPosition,
  TradingSignal,
} from "../common/types";

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  strategy: BacktestStrategy;
  riskParameters: RiskParameters;
  tradingCosts: TradingCosts;
}

export interface BacktestStrategy {
  name: string;
  buySignals: string[];
  sellSignals: string[];
  riskManagement: {
    stopLoss?: number; // %
    takeProfit?: number; // %
    maxPositionSize?: number; // % of portfolio
    maxDrawdown?: number; // %
  };
}

export interface RiskParameters {
  maxPositionSize: number; // % des Portfolios
  maxExposure: number; // % des Portfolios
  stopLoss: number; // %
  takeProfit: number; // %
  maxDrawdown: number; // %
}

export interface TradingCosts {
  commission: number; // Feste Gebühr pro Trade
  spread: number; // % des Handelswerts
  slippage: number; // % des Handelswerts
}

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysisEngine: AnalysisEngineService,
  ) {}

  /**
   * Führt einen Backtest für eine Strategie durch
   */
  async runBacktest(
    tickers: string[],
    config: BacktestConfig,
  ): Promise<BacktestResult[]> {
    try {
      this.logger.log(`🔄 Starte Backtest für ${tickers.length} Aktien...`);

      const results: BacktestResult[] = [];

      for (const ticker of tickers) {
        this.logger.log(`📊 Backtesting ${ticker}...`);

        const result = await this.backtestSingleStock(ticker, config);
        if (result) {
          results.push(result);
        }
      }

      // Berechne Gesamt-Performance
      const overallResult = this.calculateOverallPerformance(results, config);
      results.push(overallResult);

      this.logger.log(
        `✅ Backtest abgeschlossen für ${results.length} Ergebnisse`,
      );
      return results;
    } catch (error) {
      this.logger.error(`Fehler beim Backtest:`, error);
      throw error;
    }
  }

  /**
   * Backtesting für eine einzelne Aktie
   */
  private async backtestSingleStock(
    ticker: string,
    config: BacktestConfig,
  ): Promise<BacktestResult | null> {
    try {
      // Lade historische Daten
      const historicalData = await this.prisma.historicalData.findMany({
        where: {
          stock: { ticker },
          timestamp: {
            gte: config.startDate,
            lte: config.endDate,
          },
          // Nur Daten mit Indikatoren
          sma20: { not: null },
          ema50: { not: null },
          rsi14: { not: null },
          macd: { not: null },
        },
        orderBy: { timestamp: "asc" },
        include: { stock: true },
      });

      if (historicalData.length < 50) {
        this.logger.warn(`Nicht genügend Daten für ${ticker}`);
        return null;
      }

      // Simuliere Trading
      const portfolio = this.initializePortfolio(config.initialCapital);
      const trades: BacktestTrade[] = [];
      let currentPosition: PortfolioPosition | null = null;

      for (let i = 1; i < historicalData.length; i++) {
        const currentData = historicalData[i];
        const previousData = historicalData[i - 1];

        // Generiere Handelssignale
        const signals = await this.generateTradingSignals(
          currentData,
          previousData,
          config.strategy,
        );

        // Prüfe Exit-Bedingungen
        if (currentPosition) {
          const exitSignal = this.checkExitConditions(
            currentPosition,
            currentData,
            config.strategy.riskManagement,
          );

          if (exitSignal) {
            const trade = this.executeSell(
              currentPosition,
              currentData,
              portfolio,
              config.tradingCosts,
              exitSignal.reason,
            );
            trades.push(trade);
            currentPosition = null;
          }
        }

        // Prüfe Entry-Bedingungen
        if (!currentPosition && signals.some((s) => s.action === "BUY")) {
          const positionSize = this.calculatePositionSize(
            portfolio.totalValue,
            currentData.close,
            config.strategy.riskManagement,
          );

          if (positionSize > 0) {
            currentPosition = this.executeBuy(
              ticker,
              currentData,
              positionSize,
              portfolio,
              config.tradingCosts,
            );
          }
        }
      }

      // Schließe offene Position am Ende
      if (currentPosition) {
        const finalData = historicalData[historicalData.length - 1];
        const trade = this.executeSell(
          currentPosition,
          finalData,
          portfolio,
          config.tradingCosts,
          "End of backtest",
        );
        trades.push(trade);
      }

      // Berechne Ergebnisse
      return this.calculateBacktestResult(
        ticker,
        trades,
        config,
        historicalData,
      );
    } catch (error) {
      this.logger.error(`Fehler beim Backtest für ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Generiert Handelssignale basierend auf der Strategie
   */
  private async generateTradingSignals(
    currentData: any,
    previousData: any,
    strategy: BacktestStrategy,
  ): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];

    // RSI-Signale
    if (
      strategy.buySignals.includes("RSI_OVERSOLD") &&
      currentData.rsi14 < 30
    ) {
      signals.push({
        type: "RSI_OVERSOLD",
        strength: Math.max(0, (30 - currentData.rsi14) / 30),
        description: `RSI überverkauft (${currentData.rsi14.toFixed(2)})`,
        action: "BUY",
        confidence: 0.8,
      });
    }

    if (
      strategy.sellSignals.includes("RSI_OVERBOUGHT") &&
      currentData.rsi14 > 70
    ) {
      signals.push({
        type: "RSI_OVERBOUGHT",
        strength: Math.max(0, (currentData.rsi14 - 70) / 30),
        description: `RSI überkauft (${currentData.rsi14.toFixed(2)})`,
        action: "SELL",
        confidence: 0.8,
      });
    }

    // MACD-Signale
    if (
      strategy.buySignals.includes("MACD_BULLISH") &&
      currentData.macd > currentData.macdSignal &&
      previousData.macd <= previousData.macdSignal
    ) {
      signals.push({
        type: "MACD_BULLISH",
        strength: Math.min(
          1,
          Math.abs(currentData.macd - currentData.macdSignal) /
            (currentData.close * 0.01),
        ),
        description: "MACD Bullish Crossover",
        action: "BUY",
        confidence: 0.7,
      });
    }

    if (
      strategy.sellSignals.includes("MACD_BEARISH") &&
      currentData.macd < currentData.macdSignal &&
      previousData.macd >= previousData.macdSignal
    ) {
      signals.push({
        type: "MACD_BEARISH",
        strength: Math.min(
          1,
          Math.abs(currentData.macd - currentData.macdSignal) /
            (currentData.close * 0.01),
        ),
        description: "MACD Bearish Crossover",
        action: "SELL",
        confidence: 0.7,
      });
    }

    // SMA Crossover
    if (
      strategy.buySignals.includes("SMA_CROSSOVER") &&
      currentData.sma20 > currentData.ema50 &&
      previousData.sma20 <= previousData.ema50
    ) {
      signals.push({
        type: "SMA_CROSSOVER",
        strength: Math.min(
          1,
          Math.abs(currentData.sma20 - currentData.ema50) /
            (currentData.close * 0.02),
        ),
        description: "Golden Cross: SMA20 über EMA50",
        action: "BUY",
        confidence: 0.6,
      });
    }

    return signals;
  }

  /**
   * Prüft Exit-Bedingungen für eine Position
   */
  private checkExitConditions(
    position: PortfolioPosition,
    currentData: any,
    riskManagement: any,
  ): { reason: string } | null {
    const currentPrice = currentData.close;
    const unrealizedPL =
      (currentPrice - position.averagePrice) / position.averagePrice;

    // Stop Loss
    if (
      riskManagement.stopLoss &&
      unrealizedPL < -riskManagement.stopLoss / 100
    ) {
      return {
        reason: `Stop Loss erreicht (${(unrealizedPL * 100).toFixed(2)}%)`,
      };
    }

    // Take Profit
    if (
      riskManagement.takeProfit &&
      unrealizedPL > riskManagement.takeProfit / 100
    ) {
      return {
        reason: `Take Profit erreicht (${(unrealizedPL * 100).toFixed(2)}%)`,
      };
    }

    return null;
  }

  /**
   * Initialisiert ein Portfolio für den Backtest
   */
  private initializePortfolio(initialCapital: number): Portfolio {
    return {
      id: `backtest_${Date.now()}`,
      name: "Backtest Portfolio",
      totalValue: initialCapital,
      positions: [],
      dailyReturn: 0,
      totalReturn: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Berechnet die Positionsgröße basierend auf Risk Management
   */
  private calculatePositionSize(
    portfolioValue: number,
    currentPrice: number,
    riskManagement: any,
  ): number {
    const maxPositionValue =
      portfolioValue * (riskManagement.maxPositionSize || 0.1);
    return Math.floor(maxPositionValue / currentPrice);
  }

  /**
   * Führt einen Kauf aus
   */
  private executeBuy(
    ticker: string,
    data: any,
    quantity: number,
    portfolio: Portfolio,
    tradingCosts: TradingCosts,
  ): PortfolioPosition {
    const price = data.close;
    const totalCost =
      quantity * price +
      tradingCosts.commission +
      (quantity * price * tradingCosts.spread) / 100;

    portfolio.totalValue -= totalCost;

    const position: PortfolioPosition = {
      ticker,
      quantity,
      averagePrice: price,
      currentPrice: price,
      unrealizedPL: 0,
      weight: (quantity * price) / portfolio.totalValue,
      lastUpdated: data.timestamp,
    };

    portfolio.positions.push(position);
    return position;
  }

  /**
   * Führt einen Verkauf aus
   */
  private executeSell(
    position: PortfolioPosition,
    data: any,
    portfolio: Portfolio,
    tradingCosts: TradingCosts,
    reason: string,
  ): BacktestTrade {
    const exitPrice = data.close;
    const totalRevenue =
      position.quantity * exitPrice -
      tradingCosts.commission -
      (position.quantity * exitPrice * tradingCosts.spread) / 100;

    portfolio.totalValue += totalRevenue;

    // Entferne Position aus Portfolio
    const positionIndex = portfolio.positions.findIndex(
      (p) => p.ticker === position.ticker,
    );
    if (positionIndex >= 0) {
      portfolio.positions.splice(positionIndex, 1);
    }

    const trade: BacktestTrade = {
      entryDate: position.lastUpdated,
      exitDate: data.timestamp,
      entryPrice: position.averagePrice,
      exitPrice: exitPrice,
      quantity: position.quantity,
      return: (exitPrice - position.averagePrice) / position.averagePrice,
      holdingPeriod: Math.floor(
        (data.timestamp.getTime() - position.lastUpdated.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
      signal: {
        type: "MANUAL",
        strength: 1,
        description: reason,
        action: "SELL",
      },
    };

    return trade;
  }

  /**
   * Berechnet das Backtest-Ergebnis
   */
  private calculateBacktestResult(
    ticker: string,
    trades: BacktestTrade[],
    config: BacktestConfig,
    historicalData: any[],
  ): BacktestResult {
    if (trades.length === 0) {
      return {
        strategy: config.strategy.name,
        ticker,
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: config.initialCapital,
        finalCapital: config.initialCapital,
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        winRate: 0,
        totalTrades: 0,
        profitableTrades: 0,
        profitFactor: 0,
        averageHoldingPeriod: 0,
        trades: [],
      };
    }

    const totalReturn = trades.reduce((sum, trade) => sum + trade.return, 0);
    const winningTrades = trades.filter((trade) => trade.return > 0);
    const losingTrades = trades.filter((trade) => trade.return <= 0);

    const winRate = winningTrades.length / trades.length;
    const averageWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + trade.return, 0) /
          winningTrades.length
        : 0;
    const averageLoss =
      losingTrades.length > 0
        ? Math.abs(
            losingTrades.reduce((sum, trade) => sum + trade.return, 0) /
              losingTrades.length,
          )
        : 0;

    const profitFactor =
      averageLoss > 0
        ? (averageWin * winningTrades.length) /
          (averageLoss * losingTrades.length)
        : 0;

    // Annualized Return
    const daysDiff =
      (config.endDate.getTime() - config.startDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const years = daysDiff / 365.25;
    const annualizedReturn =
      years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

    // Sharpe Ratio (vereinfacht)
    const returns = trades.map((trade) => trade.return);
    const avgReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
        returns.length,
    );
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Max Drawdown (vereinfacht)
    let peak = config.initialCapital;
    let maxDrawdown = 0;
    let currentValue = config.initialCapital;

    for (const trade of trades) {
      currentValue *= 1 + trade.return;
      if (currentValue > peak) {
        peak = currentValue;
      }
      const drawdown = (peak - currentValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const averageHoldingPeriod =
      trades.reduce((sum, trade) => sum + trade.holdingPeriod, 0) /
      trades.length;
    return {
      strategy: config.strategy.name,
      ticker,
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      finalCapital: config.initialCapital * (1 + totalReturn),
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      maxDrawdown,
      volatility: stdDev,
      winRate,
      totalTrades: trades.length,
      profitableTrades: winningTrades.length,
      profitFactor,
      averageHoldingPeriod,
      trades,
    };
  }

  /**
   * Berechnet die Gesamt-Performance aller Backtests
   */
  private calculateOverallPerformance(
    results: BacktestResult[],
    config: BacktestConfig,
  ): BacktestResult {
    if (results.length === 0) {
      return {
        strategy: config.strategy.name,
        ticker: "OVERALL",
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: config.initialCapital,
        finalCapital: config.initialCapital,
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        winRate: 0,
        totalTrades: 0,
        profitableTrades: 0,
        profitFactor: 0,
        averageHoldingPeriod: 0,
        trades: [],
      };
    }

    const totalTrades = results.reduce(
      (sum, result) => sum + result.totalTrades,
      0,
    );
    const totalReturn =
      results.reduce((sum, result) => sum + result.totalReturn, 0) /
      results.length;
    const annualizedReturn =
      results.reduce((sum, result) => sum + result.annualizedReturn, 0) /
      results.length;
    const sharpeRatio =
      results.reduce((sum, result) => sum + result.sharpeRatio, 0) /
      results.length;
    const maxDrawdown = Math.max(
      ...results.map((result) => result.maxDrawdown),
    );
    const winRate =
      results.reduce((sum, result) => sum + result.winRate, 0) / results.length;
    const profitFactor =
      results.reduce((sum, result) => sum + result.profitFactor, 0) /
      results.length;
    const averageHoldingPeriod =
      results.reduce((sum, result) => sum + result.averageHoldingPeriod, 0) /
      results.length;

    const allTrades = results.flatMap((result) => result.trades);
    const totalProfitableTrades = results.reduce(
      (sum, result) => sum + result.profitableTrades,
      0,
    );
    const averageVolatility =
      results.reduce((sum, result) => sum + result.volatility, 0) /
      results.length;

    return {
      strategy: config.strategy.name,
      ticker: "OVERALL",
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      finalCapital: config.initialCapital * (1 + totalReturn),
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      maxDrawdown,
      volatility: averageVolatility,
      winRate,
      totalTrades,
      profitableTrades: totalProfitableTrades,
      profitFactor,
      averageHoldingPeriod,
      trades: allTrades,
    };
  }

  /**
   * Vordefinierte Handelsstrategien
   */
  static getPresetStrategies(): { [key: string]: BacktestStrategy } {
    return {
      rsi_mean_reversion: {
        name: "RSI Mean Reversion",
        buySignals: ["RSI_OVERSOLD"],
        sellSignals: ["RSI_OVERBOUGHT"],
        riskManagement: {
          stopLoss: 5,
          takeProfit: 10,
          maxPositionSize: 10,
          maxDrawdown: 15,
        },
      },
      macd_trend_following: {
        name: "MACD Trend Following",
        buySignals: ["MACD_BULLISH", "SMA_CROSSOVER"],
        sellSignals: ["MACD_BEARISH"],
        riskManagement: {
          stopLoss: 8,
          takeProfit: 15,
          maxPositionSize: 15,
          maxDrawdown: 20,
        },
      },
      momentum_strategy: {
        name: "Momentum Strategy",
        buySignals: ["SMA_CROSSOVER", "MOMENTUM_BULLISH"],
        sellSignals: ["MOMENTUM_BEARISH"],
        riskManagement: {
          stopLoss: 6,
          takeProfit: 12,
          maxPositionSize: 12,
          maxDrawdown: 18,
        },
      },
    };
  }

  /**
   * Erstellt eine Backtest-Konfiguration mit Standardwerten
   */
  static createDefaultConfig(
    startDate: Date,
    endDate: Date,
    strategyName: string = "rsi_mean_reversion",
  ): BacktestConfig {
    const strategies = BacktestService.getPresetStrategies();
    const strategy = strategies[strategyName] || strategies.rsi_mean_reversion;

    return {
      startDate,
      endDate,
      initialCapital: 100000, // 100k €
      strategy,
      riskParameters: {
        maxPositionSize: strategy.riskManagement.maxPositionSize || 10,
        maxExposure: 50,
        stopLoss: strategy.riskManagement.stopLoss || 5,
        takeProfit: strategy.riskManagement.takeProfit || 10,
        maxDrawdown: strategy.riskManagement.maxDrawdown || 15,
      },
      tradingCosts: {
        commission: 5, // 5€ pro Trade
        spread: 0.1, // 0.1% Spread
        slippage: 0.05, // 0.05% Slippage
      },
    };
  }
}
