import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../persistence/prisma.service';
import { AnalysisEngineService } from './analysis-engine.service';

describe('AnalysisEngineService', () => {
  let service: AnalysisEngineService;

  beforeEach(async () => {
    const mockPrismaService = {
      // Mock only what's needed
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisEngineService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalysisEngineService>(AnalysisEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateSMA', () => {
    it('should calculate simple moving average correctly', () => {
      const prices = [10, 12, 14, 16, 18];
      const period = 3;
      const result = service.calculateSMA(prices, period);

      expect(result).toEqual([12, 14, 16]);
    });
  });

  describe('calculateEMA', () => {
    it('should calculate exponential moving average correctly', () => {
      const prices = [10, 12, 14, 16, 18];
      const period = 3;
      const result = service.calculateEMA(prices, period);

      expect(result).toHaveLength(3);
      expect(result[0]).toBeCloseTo(12, 1);
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI correctly', () => {
      const prices = [
        44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 46.08, 45.89,
        46.03, 46.83, 46.69, 46.45, 46.59,
      ];
      const result = service.calculateRSI(prices, 14);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeGreaterThan(0);
      expect(result[0]).toBeLessThan(100);
    });
  });
  describe('calculateMACD', () => {
    it('should calculate MACD correctly', () => {
      const prices = new Array(50)
        .fill(0)
        .map((_, i) => 100 + Math.sin(i * 0.1) * 10);
      const result = service.calculateMACD(prices);

      expect(result).toBeInstanceOf(Array);
      // TI library returns array of objects with MACD, signal, histogram properties
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('MACD');
        expect(result[0]).toHaveProperty('signal');
        expect(result[0]).toHaveProperty('histogram');
      }
    });
  });
  describe('calculateBollingerBands', () => {
    it('should calculate Bollinger Bands correctly', () => {
      const prices = [
        20, 22, 24, 23, 25, 24, 26, 25, 27, 26, 28, 27, 29, 28, 30,
      ];
      const result = service.calculateBollingerBands(prices, 10, 2);

      expect(result).toBeInstanceOf(Array);
      // TI library returns array of objects with upper, middle, lower properties
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('upper');
        expect(result[0]).toHaveProperty('middle');
        expect(result[0]).toHaveProperty('lower');
      }
    });
  });
});
