import { Test, TestingModule } from "@nestjs/testing";
import { RiskManagementService } from "./risk-management.service";
import { PrismaService } from "../persistence/prisma.service";
import { Portfolio, PortfolioPosition, RiskAssessment } from "../common/types";

describe("RiskManagementService", () => {
  let service: RiskManagementService;
  let mockPrismaService: any;

  const mockPosition: PortfolioPosition = {
    ticker: "AAPL",
    quantity: 100,
    averagePrice: 150,
    currentPrice: 155,
    unrealizedPL: 500,
    weight: 0.3,
    lastUpdated: new Date(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskManagementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RiskManagementService>(RiskManagementService);
    mockPrismaService = module.get(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
  describe("assessPortfolioRisk", () => {
    const mockRiskLimits = {
      maxPositionSize: 20,
      maxSectorExposure: 40,
      maxDrawdown: 15,
      minLiquidity: 10,
      maxVolatility: 25,
    };

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
        positions: [
          { ...mockPosition, weight: 0.6 }, // 60% concentration
        ],
      };

      const assessment: RiskAssessment = await service.assessPortfolioRisk(
        highConcentrationPortfolio,
        mockRiskLimits,
      );

      expect(assessment.alerts.length).toBeGreaterThan(0);
      expect(
        assessment.alerts.some((alert) => alert.type === "CONCENTRATION"),
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
        positions: [
          { ...mockPosition, ticker: "AAPL", weight: 0.4 },
          { ...mockPosition, ticker: "MSFT", weight: 0.3 },
          { ...mockPosition, ticker: "JPM", weight: 0.3 },
        ],
      };

      const sectorExposure =
        await service.calculateSectorExposure(multiSectorPortfolio);

      expect(sectorExposure).toBeDefined();
      expect(typeof sectorExposure).toBe("object");
      expect(sectorExposure["Technology"]).toBe(0.7); // 40% + 30%
      expect(sectorExposure["Financials"]).toBe(0.3);
    });

    it("should handle unknown sectors", async () => {
      mockPrismaService.stock.findMany.mockResolvedValue([
        { ticker: "AAPL", sector: null },
      ]);

      const sectorExposure =
        await service.calculateSectorExposure(mockPortfolio);

      expect(sectorExposure).toBeDefined();
      expect(sectorExposure["Unknown"]).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockPrismaService.historicalData.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.assessPortfolioRisk(mockPortfolio)).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle missing historical data", async () => {
      mockPrismaService.historicalData.findMany.mockResolvedValue([]);
      mockPrismaService.stock.findMany.mockResolvedValue([]);

      const assessment: RiskAssessment =
        await service.assessPortfolioRisk(mockPortfolio);

      expect(assessment).toBeDefined();
      expect(assessment.riskLevel).toBe("MEDIUM"); // Default when data insufficient
    });
  });
});
