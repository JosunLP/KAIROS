import { Test, TestingModule } from "@nestjs/testing";
import { BacktestService } from "./backtest.service";
import { PrismaService } from "../persistence/prisma.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import { BacktestConfig, BacktestStrategy } from "./backtest.service";

describe("BacktestService", () => {
  let service: BacktestService;
  let mockPrismaService: any;
  let mockAnalysisEngineService: any;

  const mockBacktestStrategy: BacktestStrategy = {
    name: "RSI Mean Reversion",
    buySignals: ["RSI_OVERSOLD"],
    sellSignals: ["RSI_OVERBOUGHT"],
    riskManagement: {
      stopLoss: 5,
      takeProfit: 10,
      maxPositionSize: 10,
      maxDrawdown: 15,
    },
  };

  const mockBacktestConfig: BacktestConfig = {
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-12-31"),
    initialCapital: 100000,
    strategy: mockBacktestStrategy,
    riskParameters: {
      maxPositionSize: 10,
      maxExposure: 50,
      stopLoss: 5,
      takeProfit: 10,
      maxDrawdown: 15,
    },
    tradingCosts: {
      commission: 5,
      spread: 0.1,
      slippage: 0.05,
    },
  };

  const mockHistoricalData = [
    {
      id: "1",
      timestamp: new Date("2023-01-01"),
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000000,
      sma20: 100,
      ema50: 98,
      rsi14: 25, // Oversold
      macd: -1,
      macdSignal: -0.5,
      stock: { ticker: "AAPL" },
    },
    {
      id: "2",
      timestamp: new Date("2023-01-02"),
      open: 102,
      high: 108,
      low: 101,
      close: 106,
      volume: 1200000,
      sma20: 101,
      ema50: 99,
      rsi14: 75, // Overbought
      macd: 0.5,
      macdSignal: 0.2,
      stock: { ticker: "AAPL" },
    },
  ];

  beforeEach(async () => {
    const mockPrisma = {
      historicalData: {
        findMany: jest.fn(),
      },
    };

    const mockAnalysisEngine = {
      calculateIndicatorsForStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AnalysisEngineService, useValue: mockAnalysisEngine },
      ],
    }).compile();

    service = module.get<BacktestService>(BacktestService);
    mockPrismaService = module.get(PrismaService);
    mockAnalysisEngineService = module.get(AnalysisEngineService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("runBacktest", () => {
    it("should execute backtest for given tickers", async () => {
      mockPrismaService.historicalData.findMany.mockResolvedValue(
        mockHistoricalData,
      );

      const result = await service.runBacktest(["AAPL"], mockBacktestConfig);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrismaService.historicalData.findMany).toHaveBeenCalled();
    });

    it("should handle empty ticker array", async () => {
      const result = await service.runBacktest([], mockBacktestConfig);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1); // Only overall result
    });

    it("should handle errors gracefully", async () => {
      mockPrismaService.historicalData.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        service.runBacktest(["AAPL"], mockBacktestConfig),
      ).rejects.toThrow("Database error");
    });
  });

  describe("getPresetStrategies", () => {
    it("should return predefined strategies", () => {
      const strategies = BacktestService.getPresetStrategies();

      expect(strategies).toBeDefined();
      expect(typeof strategies).toBe("object");
      expect(strategies.rsi_mean_reversion).toBeDefined();
      expect(strategies.macd_trend_following).toBeDefined();
      expect(strategies.momentum_strategy).toBeDefined();
    });

    it("should have valid strategy structure", () => {
      const strategies = BacktestService.getPresetStrategies();
      const rsiStrategy = strategies.rsi_mean_reversion;

      expect(rsiStrategy.name).toBeDefined();
      expect(Array.isArray(rsiStrategy.buySignals)).toBe(true);
      expect(Array.isArray(rsiStrategy.sellSignals)).toBe(true);
      expect(rsiStrategy.riskManagement).toBeDefined();
      expect(typeof rsiStrategy.riskManagement.stopLoss).toBe("number");
      expect(typeof rsiStrategy.riskManagement.takeProfit).toBe("number");
    });
  });

  describe("createDefaultConfig", () => {
    it("should create valid default config", () => {
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-12-31");
      const config = BacktestService.createDefaultConfig(startDate, endDate);

      expect(config.startDate).toEqual(startDate);
      expect(config.endDate).toEqual(endDate);
      expect(config.initialCapital).toBe(100000);
      expect(config.strategy).toBeDefined();
      expect(config.riskParameters).toBeDefined();
      expect(config.tradingCosts).toBeDefined();
    });

    it("should use specified strategy", () => {
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-12-31");
      const config = BacktestService.createDefaultConfig(
        startDate,
        endDate,
        "macd_trend_following",
      );

      expect(config.strategy.name).toBe("MACD Trend Following");
    });

    it("should fallback to default strategy for invalid strategy name", () => {
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-12-31");
      const config = BacktestService.createDefaultConfig(
        startDate,
        endDate,
        "invalid_strategy",
      );

      expect(config.strategy.name).toBe("RSI Mean Reversion");
    });
  });
});
