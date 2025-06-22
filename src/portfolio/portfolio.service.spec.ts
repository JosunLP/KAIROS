import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Portfolio } from '../common/types';
import { PrismaService } from '../persistence/prisma.service';
import { PortfolioService } from './portfolio.service';

describe('PortfolioService', () => {
  let service: PortfolioService;

  // Mock PrismaService
  const mockPrismaService = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);

    // Mock Logger to prevent console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPortfolio', () => {
    it('should create a portfolio without initial positions', async () => {
      const portfolioName = 'Test Portfolio';

      const portfolio = await service.createPortfolio(portfolioName);

      expect(portfolio).toBeDefined();
      expect(portfolio.name).toBe(portfolioName);
      expect(portfolio.positions).toEqual([]);
      expect(portfolio.totalValue).toBe(0);
      expect(portfolio.dailyReturn).toBe(0);
      expect(portfolio.totalReturn).toBe(0);
      expect(portfolio.id).toBeDefined();
      expect(portfolio.createdAt).toBeInstanceOf(Date);
      expect(portfolio.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a portfolio with initial positions', async () => {
      const portfolioName = 'Test Portfolio with Positions';

      // Mock getCurrentPrices method
      jest
        .spyOn(service as any, 'getCurrentPrices')
        .mockResolvedValue(new Map([['AAPL', 155]]));
      jest
        .spyOn(service as any, 'calculatePortfolioReturns')
        .mockResolvedValue([0.033]);
      jest.spyOn(service as any, 'calculateSharpeRatio').mockReturnValue(1.2);
      jest.spyOn(service as any, 'calculateMaxDrawdown').mockReturnValue(0.05);
      jest.spyOn(service as any, 'calculateVolatility').mockReturnValue(0.15);
      jest.spyOn(service as any, 'calculateTotalReturn').mockReturnValue(0.033);

      const portfolio = await service.createPortfolio(
        portfolioName,
        undefined,
        0,
      );

      // Add the initial position
      await service.addPosition(portfolio.id, 'AAPL', 10, 150);

      expect(portfolio).toBeDefined();
      expect(portfolio.name).toBe(portfolioName);
      expect(portfolio.positions).toHaveLength(1);
      expect(portfolio.positions[0].ticker).toBe('AAPL');
    });

    it('should create a portfolio with initial capital', async () => {
      const portfolioName = 'Capital Test Portfolio';
      const initialCapital = 10000;

      const portfolio = await service.createPortfolio(
        portfolioName,
        undefined,
        0,
      );

      expect(portfolio).toBeDefined();
      expect(portfolio.name).toBe(portfolioName);
      expect(portfolio.totalValue).toBe(initialCapital);
      expect(portfolio.initialValue).toBe(initialCapital);
      expect(portfolio.positions).toEqual([]);
      expect(portfolio.id).toBeDefined();
    });
  });

  describe('getAllPortfolios', () => {
    it('should return empty array when no portfolios exist', async () => {
      const portfolios = await service.getAllPortfolios();

      expect(portfolios).toEqual([]);
    });

    it('should return all created portfolios', async () => {
      await service.createPortfolio('Portfolio 1');
      await service.createPortfolio('Portfolio 2');

      const portfolios = await service.getAllPortfolios();

      expect(portfolios).toHaveLength(2);
      expect(portfolios[0].name).toBe('Portfolio 1');
      expect(portfolios[1].name).toBe('Portfolio 2');
    });
  });

  describe('getPortfolio', () => {
    it('should return null for non-existing portfolio', async () => {
      const portfolio = await service.getPortfolio('non-existing-id');

      expect(portfolio).toBeNull();
    });

    it('should return existing portfolio', async () => {
      const createdPortfolio = await service.createPortfolio('Test Portfolio');

      const retrievedPortfolio = await service.getPortfolio(
        createdPortfolio.id,
      );

      expect(retrievedPortfolio).toBeDefined();
      expect(retrievedPortfolio?.id).toBe(createdPortfolio.id);
      expect(retrievedPortfolio?.name).toBe('Test Portfolio');
    });
  });

  describe('addPosition', () => {
    let portfolio: Portfolio;

    beforeEach(async () => {
      portfolio = await service.createPortfolio(
        'Test Portfolio',
        undefined,
        10000,
      );

      // Mock required methods
      jest
        .spyOn(service as any, 'updatePortfolioMetrics')
        .mockResolvedValue(undefined);
    });

    it('should add a new position to portfolio', async () => {
      const ticker = 'AAPL';
      const quantity = 10;
      const price = 150;

      await service.addPosition(portfolio.id, ticker, quantity, price);

      const updatedPortfolio = await service.getPortfolio(portfolio.id);

      expect(updatedPortfolio?.positions).toHaveLength(1);
      expect(updatedPortfolio?.positions[0].ticker).toBe(ticker);
      expect(updatedPortfolio?.positions[0].quantity).toBe(quantity);
      expect(updatedPortfolio?.positions[0].averagePrice).toBe(price);
    });

    it('should update existing position (average cost)', async () => {
      const ticker = 'AAPL';

      // Add first position
      await service.addPosition(portfolio.id, ticker, 10, 150);

      // Add second position with same ticker
      await service.addPosition(portfolio.id, ticker, 10, 160);

      const updatedPortfolio = await service.getPortfolio(portfolio.id);

      expect(updatedPortfolio?.positions).toHaveLength(1);
      expect(updatedPortfolio?.positions[0].ticker).toBe(ticker);
      expect(updatedPortfolio?.positions[0].quantity).toBe(20);
      expect(updatedPortfolio?.positions[0].averagePrice).toBe(155); // (10*150 + 10*160) / 20
    });

    it('should throw error for non-existing portfolio', async () => {
      await expect(
        service.addPosition('non-existing', 'AAPL', 10, 150),
      ).rejects.toThrow('Portfolio non-existing nicht gefunden');
    });
  });

  describe('removePosition', () => {
    let portfolio: Portfolio;

    beforeEach(async () => {
      portfolio = await service.createPortfolio(
        'Test Portfolio',
        undefined,
        10000,
      );

      // Mock required methods
      jest
        .spyOn(service as any, 'updatePortfolioMetrics')
        .mockResolvedValue(undefined);

      // Add a position to remove
      await service.addPosition(portfolio.id, 'AAPL', 10, 150);
    });

    it('should remove existing position', async () => {
      await service.removePosition(portfolio.id, 'AAPL');

      const updatedPortfolio = await service.getPortfolio(portfolio.id);

      expect(updatedPortfolio?.positions).toHaveLength(0);
    });

    it('should throw error for non-existing portfolio', async () => {
      await expect(
        service.removePosition('non-existing', 'AAPL'),
      ).rejects.toThrow('Portfolio non-existing nicht gefunden');
    });

    it('should throw error for non-existing position', async () => {
      await expect(
        service.removePosition(portfolio.id, 'MSFT'),
      ).rejects.toThrow('Position MSFT nicht im Portfolio gefunden');
    });
  });

  describe('calculatePortfolioMetrics', () => {
    let portfolio: Portfolio;

    beforeEach(async () => {
      portfolio = await service.createPortfolio(
        'Test Portfolio',
        undefined,
        10000,
      );

      // Add some positions
      portfolio.positions = [
        {
          ticker: 'AAPL',
          symbol: 'AAPL',
          quantity: 10,
          averagePrice: 150,
          currentPrice: 155,
          unrealizedPL: 50,
          unrealizedPnL: 50,
          value: 1550,
          weight: 50,
          lastUpdated: new Date(),
        },
        {
          ticker: 'MSFT',
          symbol: 'MSFT',
          quantity: 5,
          averagePrice: 300,
          currentPrice: 310,
          unrealizedPL: 50,
          unrealizedPnL: 50,
          value: 1550,
          weight: 50,
          lastUpdated: new Date(),
        },
      ];

      // Mock required methods
      jest.spyOn(service as any, 'getCurrentPrices').mockResolvedValue(
        new Map([
          ['AAPL', 155],
          ['MSFT', 310],
        ]),
      );
      jest
        .spyOn(service as any, 'calculatePortfolioReturns')
        .mockResolvedValue([0.01, 0.02, 0.033]);
      jest.spyOn(service as any, 'calculateSharpeRatio').mockReturnValue(1.2);
      jest.spyOn(service as any, 'calculateMaxDrawdown').mockReturnValue(0.05);
      jest.spyOn(service as any, 'calculateVolatility').mockReturnValue(0.15);
      jest.spyOn(service as any, 'calculateTotalReturn').mockReturnValue(0.033);
    });

    it('should calculate portfolio metrics correctly', async () => {
      const metrics = await service.calculatePortfolioMetrics(portfolio);

      expect(metrics).toBeDefined();
      expect(metrics.totalValue).toBe(3100); // 10*155 + 5*310
      expect(metrics.dailyReturn).toBe(0.033);
      expect(metrics.totalReturn).toBe(0.033);
      expect(metrics.sharpeRatio).toBe(1.2);
      expect(metrics.maxDrawdown).toBe(0.05);
      expect(metrics.volatility).toBe(0.15);
    });

    it('should handle portfolio with no positions', async () => {
      const emptyPortfolio = await service.createPortfolio('Empty Portfolio');

      jest
        .spyOn(service as any, 'getCurrentPrices')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'calculatePortfolioReturns')
        .mockResolvedValue([]);
      jest.spyOn(service as any, 'calculateSharpeRatio').mockReturnValue(0);
      jest.spyOn(service as any, 'calculateMaxDrawdown').mockReturnValue(0);
      jest.spyOn(service as any, 'calculateVolatility').mockReturnValue(0);
      jest.spyOn(service as any, 'calculateTotalReturn').mockReturnValue(0);

      const metrics = await service.calculatePortfolioMetrics(emptyPortfolio);

      expect(metrics.totalValue).toBe(0);
      expect(metrics.dailyReturn).toBe(0);
    });
  });

  describe('assessPortfolioRisk', () => {
    let portfolio: Portfolio;

    beforeEach(async () => {
      portfolio = await service.createPortfolio(
        'Risk Test Portfolio',
        undefined,
        10000,
      );

      // Mock calculatePortfolioMetrics
      jest.spyOn(service, 'calculatePortfolioMetrics').mockResolvedValue({
        totalValue: 10000,
        dailyReturn: 0.01,
        totalReturn: 0.15,
        sharpeRatio: 1.2,
        maxDrawdown: 0.05,
        volatility: 0.15,
      });

      // Mock calculatePositionRisks
      jest
        .spyOn(service as any, 'calculatePositionRisks')
        .mockResolvedValue([]);
    });

    it('should assess portfolio risk with low risk score', async () => {
      const riskAssessment = await service.assessPortfolioRisk(portfolio);

      expect(riskAssessment).toBeDefined();
      expect(riskAssessment.portfolioId).toBe(portfolio.id);
      expect(riskAssessment.riskLevel).toBe('LOW');
      expect(riskAssessment.riskScore).toBeLessThan(30);
      expect(riskAssessment.timestamp).toBeInstanceOf(Date);
    });

    it('should identify high volatility risk', async () => {
      // Mock high volatility
      jest.spyOn(service, 'calculatePortfolioMetrics').mockResolvedValue({
        totalValue: 10000,
        dailyReturn: 0.01,
        totalReturn: 0.15,
        sharpeRatio: 1.2,
        maxDrawdown: 0.05,
        volatility: 0.35, // High volatility
      });

      const riskAssessment = await service.assessPortfolioRisk(portfolio);

      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(30);
      expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(
        riskAssessment.riskLevel,
      );
    });

    it('should identify concentration risk', async () => {
      // Add a concentrated position
      portfolio.positions = [
        {
          ticker: 'AAPL',
          symbol: 'AAPL',
          quantity: 100,
          averagePrice: 90,
          currentPrice: 100,
          unrealizedPL: 1000,
          unrealizedPnL: 1000,
          value: 10000, // 100% of portfolio
          weight: 100,
          lastUpdated: new Date(),
        },
      ];

      const riskAssessment = await service.assessPortfolioRisk(portfolio);

      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(25);
    });
  });
});
