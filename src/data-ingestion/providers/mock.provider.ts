import { Injectable, Logger } from '@nestjs/common';
import { DataProvider, MarketDataPoint } from '../data-ingestion.service';

@Injectable()
export class MockProvider implements DataProvider {
  public readonly name = 'Mock Provider (Demo)';
  private readonly logger = new Logger(MockProvider.name);

  isConfigured(): boolean {
    return true; // Mock Provider ist immer verfügbar
  }

  async fetchHistoricalData(
    ticker: string,
    days: number = 365,
  ): Promise<MarketDataPoint[]> {
    this.logger.log(`📊 Generiere ${days} Mock-Datenpunkte für ${ticker}...`);

    const data: MarketDataPoint[] = [];
    const startPrice = 100 + Math.random() * 100; // Startpreis zwischen 100-200
    let currentPrice = startPrice;

    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

      // Simuliere Preisbewegungen mit Trend und Volatilität
      const dailyChange = (Math.random() - 0.48) * 0.05; // Leichter Aufwärtstrend
      currentPrice = Math.max(10, currentPrice * (1 + dailyChange));

      const volatility = 0.02;
      const open = currentPrice * (1 + (Math.random() - 0.5) * volatility);
      const close = currentPrice;
      const high = Math.max(open, close) * (1 + Math.random() * volatility);
      const low = Math.min(open, close) * (1 - Math.random() * volatility);
      const volume = Math.floor(1000000 + Math.random() * 5000000);
      data.push({
        timestamp,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: volume,
      });
    }

    this.logger.log(
      `✅ ${data.length} Mock-Datenpunkte für ${ticker} generiert`,
    );
    return data.reverse(); // Älteste zuerst
  }

  async fetchLatestData(ticker: string): Promise<MarketDataPoint | null> {
    const data = await this.fetchHistoricalData(ticker, 1);
    return data.length > 0 ? data[0] : null;
  }

  // Zusätzliche Methoden für erweiterte Mock-Funktionalität
  async searchSymbol(
    query: string,
  ): Promise<Array<{ symbol: string; name: string }>> {
    const mockSymbols = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    ];

    return mockSymbols.filter(
      s =>
        s.symbol.toLowerCase().includes(query.toLowerCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase()),
    );
  }

  async getCompanyInfo(
    ticker: string,
  ): Promise<{ name: string; sector?: string; industry?: string } | null> {
    const companyData: Record<
      string,
      { name: string; sector: string; industry: string }
    > = {
      AAPL: {
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
      },
      MSFT: {
        name: 'Microsoft Corporation',
        sector: 'Technology',
        industry: 'Software',
      },
      GOOGL: {
        name: 'Alphabet Inc.',
        sector: 'Technology',
        industry: 'Internet Services',
      },
      AMZN: {
        name: 'Amazon.com Inc.',
        sector: 'Consumer Discretionary',
        industry: 'E-commerce',
      },
      TSLA: {
        name: 'Tesla Inc.',
        sector: 'Consumer Discretionary',
        industry: 'Electric Vehicles',
      },
      META: {
        name: 'Meta Platforms Inc.',
        sector: 'Technology',
        industry: 'Social Media',
      },
      NVDA: {
        name: 'NVIDIA Corporation',
        sector: 'Technology',
        industry: 'Semiconductors',
      },
    };

    return (
      companyData[ticker.toUpperCase()] || {
        name: `${ticker.toUpperCase()} Corporation`,
        sector: 'Technology',
        industry: 'Software',
      }
    );
  }
}
