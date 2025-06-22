import { Test, TestingModule } from '@nestjs/testing';
import { BacktestService } from './backtest.service';
import { AnalysisEngineService } from '../analysis-engine/analysis-engine.service';
import { BacktestConfig } from '../common/types';

describe('BacktestService', () => {
  let service: BacktestService;
  let mockAnalysisEngineService: any;

  const mockBacktestConfig: BacktestConfig = {
    strategy: {
      name: 'RSI_STRATEGY',
      parameters: {
        rsiPeriod: 14,
        oversoldLevel: 30,
        overboughtLevel: 70,
      },
    },
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-12-31'),
    initialCapital: 100000,
    symbols: ['AAPL', 'MSFT'],
    parameters: {},
  };

  beforeEach(async () => {
    mockAnalysisEngineService = {
      analyzeStock: jest.fn().mockResolvedValue({
        symbol: 'AAPL',
        analysis_date: new Date(),
        indicators: {},
        signals: ['BUY'],
        confidence: 0.8,
        recommendation: 'BUY',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestService,
        {
          provide: AnalysisEngineService,
          useValue: mockAnalysisEngineService,
        },
      ],
    }).compile();

    service = module.get<BacktestService>(BacktestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runBacktest', () => {
    it('should run a complete backtest', async () => {
      const result = await service.runBacktest(mockBacktestConfig);

      expect(result).toBeDefined();
      expect(result.totalReturn).toBeDefined();
      expect(result.annualizedReturn).toBeDefined();
      expect(result.volatility).toBeDefined();
      expect(result.sharpeRatio).toBeDefined();
      expect(result.maxDrawdown).toBeDefined();
      expect(result.winRate).toBeDefined();
      expect(result.trades).toBeInstanceOf(Array);
      expect(result.totalTrades).toBe(result.trades.length);
      expect(result.initialCapital).toBe(mockBacktestConfig.initialCapital);
      expect(result.strategy).toBe(mockBacktestConfig.strategy.name);
    });

    it('should handle empty symbol list', async () => {
      const configWithoutSymbols = {
        ...mockBacktestConfig,
        symbols: [],
      };

      const result = await service.runBacktest(configWithoutSymbols);

      expect(result).toBeDefined();
      expect(result.trades).toEqual([]);
      expect(result.totalTrades).toBe(0);
    });
  });

  describe('generateTradingSignals', () => {
    it('should generate trading signals', async () => {
      const mockStockData = {
        symbol: 'AAPL',
        timestamp: new Date(),
        open: 150,
        high: 155,
        low: 148,
        close: 152,
        volume: 1000000,
      };

      const signals = await service.generateTradingSignals(
        'AAPL',
        mockStockData,
        'RSI_STRATEGY',
      );

      expect(signals).toBeInstanceOf(Array);
    });
  });

  describe('getPresetStrategies', () => {
    it('should return available strategies', () => {
      const strategies = service.getPresetStrategies();

      expect(strategies).toBeInstanceOf(Array);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies).toContain('RSI_STRATEGY');
      expect(strategies).toContain('MACD_STRATEGY');
    });
  });

  describe('createDefaultConfig', () => {
    it('should create a valid default configuration', () => {
      const config = service.createDefaultConfig();

      expect(config).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.strategy.name).toBe('RSI_STRATEGY');
      expect(config.startDate).toBeDefined();
      expect(config.endDate).toBeDefined();
      expect(config.initialCapital).toBe(100000);
      expect(config.symbols).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });
  });
});
