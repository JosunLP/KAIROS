export interface PredictionResult {
  ticker: string;
  confidence: number;
  direction: number; // 1 für Aufwärts, -1 für Abwärts
  timestamp: Date;
  targetPrice?: number;
  timeframe?: number; // Anzahl Tage
}

export interface TrainingStatus {
  isTraining: boolean;
  startTime?: Date;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  accuracy?: number;
  shouldStop?: boolean;
}

export interface HistoricalDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
  sma20?: number;
  ema50?: number;
  rsi14?: number;
  macd?: number;
}

export interface StockInfo {
  id: string;
  ticker: string;
  name: string;
}

export interface TechnicalIndicators {
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  ema50?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
}

export interface AnalysisResult {
  ticker: string;
  timestamp: Date;
  signals: TradingSignal[];
  confidence: number;
  recommendation: "BUY" | "SELL" | "HOLD";
}

export interface TradingSignal {
  type:
    | "RSI_OVERSOLD"
    | "RSI_OVERBOUGHT"
    | "MACD_BULLISH"
    | "MACD_BEARISH"
    | "SMA_CROSSOVER"
    | "BOLLINGER_SQUEEZE";
  strength: number; // 0-1
  description: string;
}

export interface DataIngestionStats {
  totalStocks: number;
  totalDataPoints: number;
  lastUpdate: Date;
  oldestData: Date;
  newestData: Date;
}

export interface MLModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastTraining: Date;
  trainingDataSize: number;
}
