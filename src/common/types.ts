export interface PredictionResult {
  ticker: string;
  confidence: number;
  direction: number; // 1 für Aufwärts, -1 für Abwärts
  timestamp: Date;
  targetPrice?: number;
  timeframe?: number; // Anzahl Tage
  metrics?: PredictionMetrics;
  riskAssessment?: RiskAssessment;
}

export interface PredictionMetrics {
  confidence: number;
  volatility: number;
  trendStrength: number;
  riskScore: number;
  supportLevels?: number[];
  resistanceLevels?: number[];
}

export interface RiskAssessment {
  portfolioId?: string;
  riskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metrics: {
    portfolioRisk: number;
    varDaily: number;
    varWeekly: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    correlationMatrix?: { [ticker: string]: { [ticker: string]: number } };
  };
  alerts: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    message: string;
    value: number;
    threshold: number;
  }>;
  recommendations: string[];
  timestamp: Date;
  // Legacy fields for backwards compatibility
  level?: "LOW" | "MEDIUM" | "HIGH";
  score?: number;
  factors?: string[];
}

export interface TrainingStatus {
  isTraining: boolean;
  startTime?: Date;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  accuracy?: number;
  shouldStop?: boolean;
  validationLoss?: number;
  validationAccuracy?: number;
  progress?: number; // 0-100
  estimatedTimeRemaining?: number; // in seconds
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
  sma200?: number;
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
  // Erweiterte Indikatoren
  adx?: number;
  cci?: number;
  williamsR?: number;
  stochK?: number;
  stochD?: number;
  atr?: number; // Average True Range
  obv?: number; // On Balance Volume
  mfi?: number; // Money Flow Index
  trix?: number;
  dmi?: number; // Directional Movement Index
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
    | "BOLLINGER_SQUEEZE"
    | "VOLUME_SPIKE"
    | "BREAKOUT_RESISTANCE"
    | "BREAKOUT_SUPPORT"
    | "MOMENTUM_BULLISH"
    | "MOMENTUM_BEARISH"
    | "PATTERN_BULLISH"
    | "PATTERN_BEARISH"
    | "MANUAL"
    | "STOP_LOSS"
    | "TAKE_PROFIT";
  strength: number; // 0-1
  description: string;
  action?: "BUY" | "SELL" | "HOLD";
  timeframe?: string;
  confidence?: number;
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

export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  unrealizedPL?: number;
  weight?: number; // Prozent des Portfolios
  lastUpdated: Date;
}

export interface Portfolio {
  id: string;
  name: string;
  totalValue: number;
  initialValue?: number; // Startkapital
  positions: PortfolioPosition[];
  dailyReturn: number;
  totalReturn: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestResult {
  strategy: string;
  ticker: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  profitFactor: number;
  averageHoldingPeriod: number;
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  return: number;
  holdingPeriod: number;
  signal: TradingSignal;
}

export interface MarketSentiment {
  ticker: string;
  bullishScore: number; // 0-100
  bearishScore: number; // 0-100
  neutralScore: number; // 0-100
  volatilityIndex: number;
  fearGreedIndex?: number;
  newsAnalysis?: NewsAnalysis;
  socialMediaSentiment?: SocialMediaSentiment;
  timestamp: Date;
}

export interface NewsAnalysis {
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  overallSentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  keyTopics: string[];
  sources: string[];
}

export interface SocialMediaSentiment {
  twitterScore?: number;
  redditScore?: number;
  mentions: number;
  trending: boolean;
}

export interface DataQuality {
  completeness: number; // 0-100
  accuracy: number; // 0-100
  freshness: number; // minutes since last update
  consistency: number; // 0-100
  issues: string[];
  lastValidated: Date;
}

export interface SystemHealth {
  status: "HEALTHY" | "WARNING" | "ERROR";
  uptime: number; // seconds
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  diskUsage: number; // percentage
  apiStatus: Map<string, "UP" | "DOWN" | "DEGRADED">;
  lastHealthCheck: Date;
  alerts: SystemAlert[];
}

export interface SystemAlert {
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  component: string;
  timestamp: Date;
  resolved?: boolean;
}
