import { Test, TestingModule } from "@nestjs/testing";
import { RiskManagementService } from "./risk-management.service";
import { PrismaService } from "../persistence/prisma.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import { Portfolio, PortfolioPosition, RiskAssessment } from "../common/types";

describe("RiskManagementService", () => {
  let service: RiskManagementService;
  let mockPrismaService: any;
  let mockAnalysisEngineService: any;

  const mockRiskLimits = {
    maxPositionSize: 20,
    maxSectorExposure: 40,
    maxDrawdown: 0.15,
    minLiquidity: 0.05,
    maxLeverage: 2.0,
    maxCorrelation: 0.8,
    stopLossLevel: 0.10,
  };

  const mockPosition: PortfolioPosition = {
    ticker: "AAPL",
    quantity: 100,
    averagePrice: 150,
    currentPrice: 155,
    unrealizedPL: 500,
    weight: 0.3,
    lastUpdated: new Date(),
    symbol: ""
  };

  const mockPortfolio: Portfolio = {
    id: "test-portfolio-1",
    name: "Test Portfolio",
    totalValue: 50000,
    positions: [mockPosition],
    dailyReturn: 0.02,
    totalReturn: 0.15,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHistoricalData = [
    { close: 150, timestamp: new Date("2023-01-01") },
    { close: 155, timestamp: new Date("2023-01-02") },
    { close: 148, timestamp: new Date("2023-01-03") },
    { close: 160, timestamp: new Date("2023-01-04") },
    { close: 152, timestamp: new Date("2023-01-05") },
  ];

  beforeEach(async () => {
    const mockPrisma = {
      historicalData: {
        findMany: jest.fn(),
      },
      stock: {
        findMany: jest.fn(),
      },
    };

    mockAnalysisEngineService = {
      getHistoricalData: jest.fn(),
      calculateRSI: jest.fn(),
      calculateSMA: jest.fn(),
      calculateEMA: jest.fn(),
      analyzeStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskManagementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AnalysisEngineService, useValue: mockAnalysisEngineService },
      ],
    }).compile();

    service = module.get<RiskManagementService>(RiskManagementService);
    mockPrismaService = module.get(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
  describe("assessPortfolioRisk", () => {
    beforeEach(() => {
      mockPrismaService.historicalData.findMany.mockResolvedValue(
        mockHistoricalData,
      );
      mockPrismaService.stock.findMany.mockResolvedValue([
        {
          ticker: "AAPL",
          sector: "Technology",
          industry: "Consumer Electronics",
        },
      ]);
    });

    it("should return valid risk assessment", async () => {
      const assessment: RiskAssessment = await service.assessPortfolioRisk(
        mockPortfolio,
        mockRiskLimits,
      );

      expect(assessment).toBeDefined();
      expect(assessment.portfolioId).toBe(mockPortfolio.id);
      expect(assessment.riskLevel).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
      expect(typeof assessment.riskScore).toBe("number");
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
      expect(assessment.metrics).toBeDefined();
      expect(Array.isArray(assessment.alerts)).toBe(true);
      expect(Array.isArray(assessment.recommendations)).toBe(true);
    });

    it("should calculate volatility correctly", async () => {
      const assessment: RiskAssessment = await service.assessPortfolioRisk(
        mockPortfolio,
        mockRiskLimits,
      );

      expect(assessment.metrics.volatility).toBeDefined();
      expect(typeof assessment.metrics.volatility).toBe("number");
      expect(assessment.metrics.volatility).toBeGreaterThanOrEqual(0);
    });

    it("should identify concentration risk", async () => {
      const highConcentrationPortfolio = {
        ...mockPortfolio,
        totalValue: 50000,
        positions: [
          { ...mockPosition, ticker: "AAPL", quantity: 100, averagePrice: 500, currentPrice: 500 }, // 50000 value = 100% concentration
        ],
      };

      const assessment: RiskAssessment = await service.assessPortfolioRisk(
        highConcentrationPortfolio,
        mockRiskLimits,
      );

      expect(assessment.alerts.length).toBeGreaterThan(0);
      expect(
        assessment.alerts.some((alert: any) => alert.type === "POSITION_SIZE"),
      ).toBe(true);
    });

    it("should handle empty portfolio", async () => {
      const emptyPortfolio = {
        ...mockPortfolio,
        positions: [],
        totalValue: 10000,
      };

      const assessment: RiskAssessment = await service.assessPortfolioRisk(
        emptyPortfolio,
        mockRiskLimits,
      );

      expect(assessment).toBeDefined();
      expect(assessment.riskLevel).toBe("LOW");
      expect(assessment.riskScore).toBeLessThan(30);
    });

    it("should generate appropriate recommendations", async () => {
      const assessment: RiskAssessment = await service.assessPortfolioRisk(
        mockPortfolio,
        mockRiskLimits,
      );

      expect(assessment.recommendations).toBeDefined();
      expect(Array.isArray(assessment.recommendations)).toBe(true);

      if (assessment.recommendations.length > 0) {
        const recommendation = assessment.recommendations[0];
        expect(typeof recommendation).toBe("string");
      }
    });
  });

  describe("calculateSectorExposure", () => {
    beforeEach(() => {
      mockPrismaService.stock.findMany.mockResolvedValue([
        { ticker: "AAPL", sector: "Technology" },
        { ticker: "MSFT", sector: "Technology" },
        { ticker: "JPM", sector: "Financials" },
      ]);
    });

    it("should calculate sector exposure correctly", async () => {
      const multiSectorPortfolio = {
        ...mockPortfolio,
        totalValue: 100000, // Set a total value
        positions: [
          { ...mockPosition, ticker: "AAPL", quantity: 100, averagePrice: 150, currentPrice: 150 }, // 15000 value = 15%
          { ...mockPosition, ticker: "MSFT", quantity: 200, averagePrice: 300, currentPrice: 300 }, // 60000 value = 60%  
          { ...mockPosition, ticker: "JPM", quantity: 125, averagePrice: 200, currentPrice: 200 }, // 25000 value = 25%
        ],
      };

      const sectorExposure =
        await service.calculateSectorExposure(multiSectorPortfolio);

      expect(sectorExposure).toBeInstanceOf(Array);
      expect(sectorExposure.length).toBeGreaterThan(0);
      
      // Find Technology sector (AAPL + MSFT = 15% + 60% = 75%)
      const techSector = sectorExposure.find(s => s.sector === 'Technology');
      expect(techSector).toBeDefined();
      expect(techSector!.exposure).toBeCloseTo(75, 1); // Should be ~75% (15% + 60%)
      
      // Find Banking sector (JPM = 25%)
      const bankSector = sectorExposure.find(s => s.sector === 'Banking');
      expect(bankSector).toBeDefined();
      expect(bankSector!.exposure).toBeCloseTo(25, 1); // Should be ~25%
    });

    it("should handle unknown sectors", async () => {
      const unknownSectorPortfolio = {
        ...mockPortfolio,
        totalValue: 50000,
        positions: [
          { ...mockPosition, ticker: "UNKNOWN", quantity: 100, averagePrice: 500, currentPrice: 500 }, // Will map to 'Other'
        ],
      };

      const sectorExposure =
        await service.calculateSectorExposure(unknownSectorPortfolio);

      expect(sectorExposure).toBeInstanceOf(Array);
      const otherSector = sectorExposure.find(s => s.sector === 'Other');
      expect(otherSector).toBeDefined();
      expect(otherSector!.exposure).toBeCloseTo(100, 1); // Should be 100% since it's the only position
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock zu einem Fehler, aber der Service sollte die Fehler abfangen und trotzdem ein Ergebnis liefern
      mockPrismaService.historicalData.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      const assessment = await service.assessPortfolioRisk(mockPortfolio, mockRiskLimits);
      
      // Der Service sollte trotzdem ein Assessment zurückgeben, auch wenn die DB fehlschlägt
      expect(assessment).toBeDefined();
      expect(assessment.riskLevel).toBeDefined();
      expect(assessment.portfolioId).toBe(mockPortfolio.id);
    });

    it("should handle missing historical data", async () => {
      mockPrismaService.historicalData.findMany.mockResolvedValue([]);
      mockPrismaService.stock.findMany.mockResolvedValue([]);

      const assessment: RiskAssessment =
        await service.assessPortfolioRisk(mockPortfolio, mockRiskLimits);

      expect(assessment).toBeDefined();
      expect(assessment.riskLevel).toBe("MEDIUM"); // Default when data insufficient
    });
  });
});
