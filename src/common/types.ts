// Stock data interface for historical data
export interface StockData {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Common types for KAIROS application

export interface HistoricalDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  sma?: number[];
  ema?: number[];
  rsi?: number[];
  macd?: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
  bollingerBands?: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  stochastic?: {
    k: number[];
    d: number[];
  };
}

export interface AnalysisResult {
  symbol: string;
  analysis_date: Date;
  indicators: TechnicalIndicators;
  signals: string[];
  confidence: number;
  recommendation: string;
}

export interface Prediction {
  symbol: string;
  prediction_date: Date;
  target_price: number;
  confidence: number;
  time_horizon: string;
  model_version: string;
}

export interface PredictionResult {
  symbol: string;
  prediction: number;
  confidence: number;
  timestamp: Date;
  model: string;
  features: Record<string, number>;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  value?: number;
  unrealizedPnL?: number;
  sector?: string;
}

export interface PortfolioPosition {
  ticker: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  unrealizedPL?: number;
  unrealizedPnL?: number;
  value?: number;
  weight?: number;
  lastUpdated: Date;
  sector?: string;
}

export interface Portfolio {
  id: string;
  name: string;
  totalValue: number;
  cash?: number;
  positions: PortfolioPosition[];
  dailyReturn?: number;
  totalReturn?: number;
  createdAt: Date;
  updatedAt: Date;
  initialValue?: number; // Initial capital value
  sharpeRatio?: number; // Portfolio Sharpe ratio
  maxDrawdown?: number; // Portfolio max drawdown
}

// Trading and Backtest related types
export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  type: string; // Type of signal like "RSI_OVERSOLD", "MACD_BULLISH", etc.
  symbol: string;
  price: number;
  quantity: number;
  timestamp: Date;
  confidence: number;
  reason: string;
  strength?: number; // Signal strength (0-1)
  description?: string; // Signal description
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  entryPrice?: number; // For backward compatibility
  timestamp: Date;
  commission?: number;
  slippage?: number;
  return: number; // Return from this trade
  entryDate: Date; // Entry date for the trade
  exitDate?: Date; // Exit date for the trade
  holdingPeriod: number; // Days held
}

export interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  trades: BacktestTrade[];
  totalTrades: number;
  profitableTrades: number;
  profitFactor: number;
  averageHoldingPeriod: number;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalValue: number;
  finalCapital: number; // Alias für finalValue für Backward-Kompatibilität
  strategy: string; // Strategy name
  ticker?: string; // Symbol or "OVERALL" for portfolio-wide results
}

export interface BacktestConfig {
  strategy: {
    name: string;
    parameters?: Record<string, any>;
  };
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  symbols: string[];
  parameters?: Record<string, any>;
}

export interface RiskMetrics {
  portfolioRisk?: number;
  varDaily?: number; // Value at Risk (1 Tag, 95% Konfidenz)
  varWeekly?: number; // Value at Risk (1 Woche, 95% Konfidenz)
  sharpeRatio: number;
  sortinoRatio?: number;
  maxDrawdown: number;
  volatility: number;
  beta: number; // Beta zum Markt (S&P 500 als Proxy)
  correlationMatrix?: { [ticker: string]: { [ticker: string]: number } };
  concentrationRisk: number;
  liquidityRisk?: number;
  var?: number; // Value at Risk
  cvar?: number; // Conditional Value at Risk
  correlations?: Record<string, number>;
  sectorExposure: SectorExposure[];
  liquidity: number;
  leverage: number;
  correlation: number;
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
    | 'POSITION_SIZE'
    | 'CONCENTRATION'
    | 'DRAWDOWN'
    | 'CORRELATION'
    | 'VOLATILITY'
    | 'LIQUIDITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  ticker?: string;
  value?: number;
  portfolioId?: string;
}

export interface SectorExposure {
  sector: string;
  exposure: number;
  percentage: number;
  value: number;
  tickers: string[];
}

export interface RiskAssessment {
  portfolioId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metrics: RiskMetrics;
  alerts: RiskAlert[];
  recommendations: string[];
  timestamp: Date;
  compliance: {
    isCompliant: boolean;
    violations: number;
    lastCheck: Date;
  };
}

export interface MonitoringMetrics {
  timestamp: Date;
  systemHealth: 'healthy' | 'warning' | 'critical';
  memoryUsage: number;
  cpuUsage: number;
  apiResponseTime: number;
  errorRate: number;
  activeConnections: number;
}

export interface Alert {
  id: string;
  type: 'system' | 'portfolio' | 'risk' | 'performance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

// Additional interfaces for Risk Management
export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  vix: number;
  fearGreedIndex: number;
  timestamp: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  timestamp: Date;
}

export interface SystemAlert {
  id: string;
  type: 'system' | 'portfolio' | 'risk' | 'performance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface TrainingStatus {
  isTraining: boolean;
  progress: number;
  epoch: number;
  loss: number;
  accuracy: number;
  estimatedTimeRemaining: number;
  status: 'IDLE' | 'TRAINING' | 'COMPLETE' | 'ERROR';
}

// NEW: Enhanced types for better consistency
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    cache?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    apiProviders?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    mlService?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    dataQuality?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    systemResources?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    errorRate?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    };
    [key: string]:
      | {
          status: 'healthy' | 'degraded' | 'unhealthy';
          message?: string;
          duration?: number;
          metadata?: Record<string, any>;
        }
      | undefined;
  };
  timestamp: Date;
  duration?: number;
}

// NEW: Database-specific types
export interface DatabaseConfig {
  url: string;
  type: 'postgresql' | 'sqlite' | 'mysql';
  poolSize?: number;
  timeout?: number;
  ssl?: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  cleanupInterval: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimit: number;
  apiKey?: string;
}

// NEW: Event types for better event handling
export interface SystemEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EventHandler {
  handle(event: SystemEvent): Promise<void>;
  canHandle(eventType: string): boolean;
}

// NEW: Configuration types
export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  logging: {
    level: string;
    file: boolean;
    console: boolean;
  };
  database: DatabaseConfig;
  cache: CacheConfig;
  apis: {
    alphaVantage?: ApiConfig;
    polygon?: ApiConfig;
    finnhub?: ApiConfig;
  };
  ml: {
    enabled: boolean;
    serviceUrl: string;
    timeout: number;
  };
  scheduling: {
    enabled: boolean;
    timezone: string;
  };
}

// Enhanced DataIngestionStats interface
export interface DataIngestionStats {
  totalStocks: number;
  activeStocks: number;
  totalDataPoints: number;
  lastUpdate: Date;
  oldestData?: Date;
  newestData?: Date;
  availableProviders?: string[];
  providerStats: Record<
    string,
    {
      requests: number;
      errors: number;
      successRate: number;
    }
  >;
}
