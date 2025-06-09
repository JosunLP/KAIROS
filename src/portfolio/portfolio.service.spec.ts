import { Test, TestingModule } from "@nestjs/testing";
import { PortfolioService } from "./portfolio.service";
import { PrismaService } from "../persistence/prisma.service";
import { RiskManagementService } from "./risk-management.service";
import { MonitoringService } from "../common/monitoring.service";
import { Portfolio, PortfolioPosition } from "../common/types";

describe("PortfolioService", () => {
  let service: PortfolioService;
  let mockPrismaService: any;
  let mockRiskManagementService: any;
  let mockMonitoringService: any;

  const mockPortfolio: Portfolio = {
    id: "test-portfolio-1",
    name: "Test Portfolio",
    totalValue: 10000,
    positions: [],
    dailyReturn: 0,
    totalReturn: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPosition: PortfolioPosition = {
    ticker: "AAPL",
    quantity: 10,
    averagePrice: 150,
    currentPrice: 155,
    unrealizedPL: 50,
    weight: 0.1,
    lastUpdated: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      portfolio: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      stock: {
        findUnique: jest.fn(),
      },
    };

    const mockRiskManagement = {
      assessPortfolioRisk: jest.fn(),
    };

    const mockMonitoring = {
      incrementCounter: jest.fn(),
      recordDuration: jest.fn(),
      addAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RiskManagementService, useValue: mockRiskManagement },
        { provide: MonitoringService, useValue: mockMonitoring },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    mockPrismaService = module.get(PrismaService);
    mockRiskManagementService = module.get(RiskManagementService);
    mockMonitoringService = module.get(MonitoringService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createPortfolioWithCapital", () => {
    it("should create a portfolio with initial capital", async () => {
      const portfolioData = {
        name: "Test Portfolio",
        initialCapital: 10000,
      };

      mockPrismaService.portfolio.create.mockResolvedValue({
        ...mockPortfolio,
        ...portfolioData,
      });

      const result = await service.createPortfolioWithCapital(
        portfolioData.name,
        portfolioData.initialCapital,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(portfolioData.name);
      expect(result.totalValue).toBe(portfolioData.initialCapital);
      expect(mockPrismaService.portfolio.create).toHaveBeenCalledWith({
        data: {
          name: portfolioData.name,
          totalValue: portfolioData.initialCapital,
          positions: [],
          dailyReturn: 0,
          totalReturn: 0,
        },
      });
    });

    it("should handle errors during portfolio creation", async () => {
      mockPrismaService.portfolio.create.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        service.createPortfolioWithCapital("Test Portfolio", 10000),
      ).rejects.toThrow("Database error");
    });
  });

  describe("getAllPortfolios", () => {
    it("should return all portfolios", async () => {
      const mockPortfolios = [mockPortfolio];
      mockPrismaService.portfolio.findMany.mockResolvedValue(mockPortfolios);

      const result = await service.getAllPortfolios();

      expect(result).toEqual(mockPortfolios);
      expect(mockPrismaService.portfolio.findMany).toHaveBeenCalled();
    });

    it("should return empty array when no portfolios exist", async () => {
      mockPrismaService.portfolio.findMany.mockResolvedValue([]);

      const result = await service.getAllPortfolios();

      expect(result).toEqual([]);
    });
  });

  describe("getPortfolio", () => {
    it("should return portfolio by id", async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolio("test-portfolio-1");

      expect(result).toEqual(mockPortfolio);
      expect(mockPrismaService.portfolio.findUnique).toHaveBeenCalledWith({
        where: { id: "test-portfolio-1" },
      });
    });

    it("should return null for non-existent portfolio", async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const result = await service.getPortfolio("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("addPosition", () => {
    it("should add a new position to portfolio", async () => {
      const portfolioWithPosition = {
        ...mockPortfolio,
        positions: [mockPosition],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.stock.findUnique.mockResolvedValue({
        id: "stock-1",
        ticker: "AAPL",
        name: "Apple Inc.",
      });
      mockPrismaService.portfolio.update.mockResolvedValue(
        portfolioWithPosition,
      );

      const result = await service.addPosition(
        "test-portfolio-1",
        "AAPL",
        10,
        150,
      );

      expect(result).toEqual(portfolioWithPosition);
      expect(mockPrismaService.portfolio.update).toHaveBeenCalled();
    });

    it("should throw error if portfolio not found", async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      await expect(
        service.addPosition("non-existent", "AAPL", 10, 150),
      ).rejects.toThrow("Portfolio nicht gefunden");
    });

    it("should throw error if stock not found", async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.stock.findUnique.mockResolvedValue(null);

      await expect(
        service.addPosition("test-portfolio-1", "INVALID", 10, 150),
      ).rejects.toThrow("Aktie INVALID nicht gefunden");
    });
  });

  describe("removePosition", () => {
    it("should remove position from portfolio", async () => {
      const portfolioWithPosition = {
        ...mockPortfolio,
        positions: [mockPosition],
      };
      const portfolioWithoutPosition = {
        ...mockPortfolio,
        positions: [],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(
        portfolioWithPosition,
      );
      mockPrismaService.portfolio.update.mockResolvedValue(
        portfolioWithoutPosition,
      );

      const result = await service.removePosition("test-portfolio-1", "AAPL");

      expect(result).toEqual(portfolioWithoutPosition);
      expect(mockPrismaService.portfolio.update).toHaveBeenCalled();
    });

    it("should throw error if portfolio not found", async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      await expect(
        service.removePosition("non-existent", "AAPL"),
      ).rejects.toThrow("Portfolio nicht gefunden");
    });

    it("should throw error if position not found", async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      await expect(
        service.removePosition("test-portfolio-1", "NONEXISTENT"),
      ).rejects.toThrow("Position NONEXISTENT nicht im Portfolio gefunden");
    });
  });

  describe("calculatePortfolioMetrics", () => {
    it("should calculate portfolio metrics", async () => {
      const portfolioWithPosition = {
        ...mockPortfolio,
        positions: [mockPosition],
      };

      const result = await service.calculatePortfolioMetrics(portfolioWithPosition);

      expect(result).toBeDefined();
      expect(result.totalValue).toBeGreaterThan(0);
      expect(result.totalReturn).toBeDefined();
      expect(result.dailyReturn).toBeDefined();
    });
  });
});
