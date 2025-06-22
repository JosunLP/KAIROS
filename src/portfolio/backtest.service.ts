import { Injectable } from '@nestjs/common';
import { AnalysisEngineService } from '../analysis-engine/analysis-engine.service';
import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  TradingSignal,
  StockData,
} from '../common/types';

@Injectable()
export class BacktestService {
  constructor(private readonly analysisEngineService: AnalysisEngineService) {}

  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const { strategy, startDate, endDate, initialCapital, symbols } = config;

    const trades: BacktestTrade[] = [];
    let currentCapital = initialCapital;
    const positions: {
      [symbol: string]: {
        quantity: number;
        entryPrice: number;
        entryDate: Date;
      };
    } = {};

    // Mock historical data generation for each symbol
    for (const symbol of symbols) {
      const historicalData = this.generateMockHistoricalData(
        symbol,
        startDate,
        endDate,
      );

      for (const dataPoint of historicalData) {
        const signals = await this.generateTradingSignals(
          symbol,
          dataPoint,
          strategy.name,
        );

        for (const signal of signals) {
          if (signal.action === 'BUY' && !positions[symbol]) {
            // Buy position
            const quantity = Math.floor((currentCapital * 0.1) / signal.price); // Use 10% of capital per trade
            if (quantity > 0) {
              positions[symbol] = {
                quantity,
                entryPrice: signal.price,
                entryDate: signal.timestamp,
              };
              currentCapital -= quantity * signal.price;

              trades.push({
                id: `${symbol}-${Date.now()}`,
                symbol,
                type: 'BUY',
                quantity,
                price: signal.price,
                entryPrice: signal.price,
                timestamp: signal.timestamp,
                commission: 0,
                slippage: 0,
                return: 0,
                entryDate: signal.timestamp,
                holdingPeriod: 0,
              });
            }
          } else if (signal.action === 'SELL' && positions[symbol]) {
            // Sell position
            const position = positions[symbol];
            const sellValue = position.quantity * signal.price;
            const buyValue = position.quantity * position.entryPrice;
            const tradeReturn = sellValue - buyValue;
            const holdingPeriod = Math.floor(
              (signal.timestamp.getTime() - position.entryDate.getTime()) /
                (1000 * 60 * 60 * 24),
            );

            currentCapital += sellValue;

            trades.push({
              id: `${symbol}-${Date.now()}`,
              symbol,
              type: 'SELL',
              quantity: position.quantity,
              price: signal.price,
              entryPrice: position.entryPrice,
              timestamp: signal.timestamp,
              commission: 0,
              slippage: 0,
              return: tradeReturn,
              entryDate: position.entryDate,
              exitDate: signal.timestamp,
              holdingPeriod,
            });

            delete positions[symbol];
          }
        }
      }
    }

    // Close any remaining positions at end date
    for (const [symbol, position] of Object.entries(positions)) {
      const finalPrice = 100 + Math.random() * 50; // Mock final price
      const sellValue = position.quantity * finalPrice;
      const buyValue = position.quantity * position.entryPrice;
      const tradeReturn = sellValue - buyValue;
      const holdingPeriod = Math.floor(
        (endDate.getTime() - position.entryDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      currentCapital += sellValue;

      trades.push({
        id: `${symbol}-final`,
        symbol,
        type: 'SELL',
        quantity: position.quantity,
        price: finalPrice,
        entryPrice: position.entryPrice,
        timestamp: endDate,
        commission: 0,
        slippage: 0,
        return: tradeReturn,
        entryDate: position.entryDate,
        exitDate: endDate,
        holdingPeriod,
      });
    }

    return this.calculateBacktestMetrics(
      trades,
      initialCapital,
      currentCapital,
      startDate,
      endDate,
      strategy.name,
    );
  }

  async generateTradingSignals(
    ticker: string,
    dataPoint: StockData,
    strategyName: string,
  ): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];

    // Mock signal generation based on strategy
    const randomValue = Math.random();

    if (strategyName === 'RSI_STRATEGY' && randomValue < 0.1) {
      const action = randomValue < 0.05 ? 'BUY' : 'SELL';
      signals.push({
        action,
        type: 'RSI_SIGNAL',
        symbol: ticker,
        price: dataPoint.close,
        quantity: 100,
        timestamp: dataPoint.timestamp,
        confidence: 0.7 + Math.random() * 0.3,
        reason: `RSI-based ${action} signal`,
        strength: Math.random(),
        description: `Generated by ${strategyName}`,
      });
    } else if (strategyName === 'MACD_STRATEGY' && randomValue < 0.08) {
      const action = randomValue < 0.04 ? 'BUY' : 'SELL';
      signals.push({
        action,
        type: 'MACD_SIGNAL',
        symbol: ticker,
        price: dataPoint.close,
        quantity: 100,
        timestamp: dataPoint.timestamp,
        confidence: 0.6 + Math.random() * 0.4,
        reason: `MACD-based ${action} signal`,
        strength: Math.random(),
        description: `Generated by ${strategyName}`,
      });
    }

    return signals;
  }

  getPresetStrategies(): string[] {
    return [
      'RSI_STRATEGY',
      'MACD_STRATEGY',
      'BOLLINGER_BANDS',
      'MOVING_AVERAGE_CROSSOVER',
    ];
  }

  createDefaultConfig(): BacktestConfig {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const endDate = new Date();

    return {
      strategy: {
        name: 'RSI_STRATEGY',
        parameters: {
          rsiPeriod: 14,
          oversoldLevel: 30,
          overboughtLevel: 70,
        },
      },
      startDate,
      endDate,
      initialCapital: 100000,
      symbols: ['AAPL', 'MSFT', 'GOOGL'],
      parameters: {},
    };
  }

  private generateMockHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
  ): StockData[] {
    const data: StockData[] = [];
    let currentPrice = 100 + Math.random() * 100;
    const current = new Date(startDate);

    while (current <= endDate) {
      const change = (Math.random() - 0.5) * 5;
      currentPrice += change;

      const high = currentPrice + Math.random() * 3;
      const low = currentPrice - Math.random() * 3;
      const open = low + Math.random() * (high - low);

      data.push({
        symbol,
        timestamp: new Date(current),
        open,
        high,
        low,
        close: currentPrice,
        volume: Math.floor(Math.random() * 1000000),
      });

      current.setDate(current.getDate() + 1);
    }

    return data;
  }

  private calculateBacktestMetrics(
    trades: BacktestTrade[],
    initialCapital: number,
    finalCapital: number,
    startDate: Date,
    endDate: Date,
    strategy: string,
  ): BacktestResult {
    const totalReturn = (finalCapital - initialCapital) / initialCapital;
    const daysElapsed = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysElapsed) - 1;

    const profitableTrades = trades.filter(t => t.return > 0).length;
    const winRate = trades.length > 0 ? profitableTrades / trades.length : 0;

    const totalProfit = trades
      .filter(t => t.return > 0)
      .reduce((sum, t) => sum + t.return, 0);
    const totalLoss = Math.abs(
      trades.filter(t => t.return < 0).reduce((sum, t) => sum + t.return, 0),
    );
    const profitFactor =
      totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 1;

    const averageHoldingPeriod =
      trades.length > 0
        ? trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
        : 0;

    // Mock volatility and Sharpe ratio calculations
    const volatility = 0.15 + Math.random() * 0.1;
    const sharpeRatio = annualizedReturn / volatility;

    // Mock max drawdown calculation
    const maxDrawdown = 0.05 + Math.random() * 0.1;

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      winRate,
      trades,
      totalTrades: trades.length,
      profitableTrades,
      profitFactor,
      averageHoldingPeriod,
      startDate,
      endDate,
      initialCapital,
      finalValue: finalCapital,
      finalCapital,
      strategy,
      ticker: 'PORTFOLIO',
    };
  }
}
