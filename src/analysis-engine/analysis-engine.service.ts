import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import * as TI from 'technicalindicators';

export interface TechnicalIndicators {
  sma20?: number;
  ema50?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bollUpper?: number;
  bollLower?: number;
  bollMid?: number;
  adx?: number;
  cci?: number;
  williamsR?: number;
}

@Injectable()
export class AnalysisEngineService {
  private readonly logger = new Logger(AnalysisEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Berechnet technische Indikatoren für alle aktiven Aktien
   */
  async enrichLatestData(): Promise<void> {
    try {
      const activeStocks = await this.prisma.stock.findMany({
        where: { isActive: true },
      });

      this.logger.log(`Berechne technische Indikatoren für ${activeStocks.length} Aktien`);

      for (const stock of activeStocks) {
        try {
          await this.calculateIndicatorsForStock(stock.id);
        } catch (error) {
          this.logger.error(`Fehler bei der Berechnung der Indikatoren für ${stock.ticker}`, error);
        }
      }

      this.logger.log('Technische Indikatoren erfolgreich berechnet');
    } catch (error) {
      this.logger.error('Fehler bei der Berechnung der technischen Indikatoren', error);
      throw error;
    }
  }

  /**
   * Berechnet technische Indikatoren für eine bestimmte Aktie
   */
  async calculateIndicatorsForStock(stockId: string): Promise<void> {
    try {
      // Hole die letzten 200 Datenpunkte (ausreichend für alle Indikatoren)
      const historicalData = await this.prisma.historicalData.findMany({
        where: { stockId },
        orderBy: { timestamp: 'desc' },
        take: 200,
      });

      if (historicalData.length < 50) {
        this.logger.warn(`Nicht genügend Daten für Aktie ${stockId} (${historicalData.length} Punkte)`);
        return;
      }

      // Sortiere chronologisch (älteste zuerst) für die Berechnung
      historicalData.reverse();

      // Extrahiere Preis-Arrays
      const closes = historicalData.map(d => d.close);
      const highs = historicalData.map(d => d.high);
      const lows = historicalData.map(d => d.low);
      const volumes = historicalData.map(d => Number(d.volume));

      // Berechne alle Indikatoren
      const indicators = this.calculateAllIndicators(closes, highs, lows, volumes);

      // Aktualisiere die Datenpunkte mit den berechneten Indikatoren
      for (let i = 0; i < historicalData.length; i++) {
        const dataPoint = historicalData[i];
        const indicatorIndex = i;

        const updateData: any = {};

        // Nur die Indikatoren aktualisieren, die Werte haben
        if (indicators.sma20 && indicators.sma20[indicatorIndex] !== undefined) {
          updateData.sma20 = indicators.sma20[indicatorIndex];
        }
        if (indicators.ema50 && indicators.ema50[indicatorIndex] !== undefined) {
          updateData.ema50 = indicators.ema50[indicatorIndex];
        }
        if (indicators.rsi14 && indicators.rsi14[indicatorIndex] !== undefined) {
          updateData.rsi14 = indicators.rsi14[indicatorIndex];
        }
        if (indicators.macd && indicators.macd[indicatorIndex] !== undefined) {
          updateData.macd = indicators.macd[indicatorIndex].MACD;
          updateData.macdSignal = indicators.macd[indicatorIndex].signal;
          updateData.macdHist = indicators.macd[indicatorIndex].histogram;
        }
        if (indicators.bollinger && indicators.bollinger[indicatorIndex] !== undefined) {
          updateData.bollUpper = indicators.bollinger[indicatorIndex].upper;
          updateData.bollLower = indicators.bollinger[indicatorIndex].lower;
          updateData.bollMid = indicators.bollinger[indicatorIndex].middle;
        }
        if (indicators.adx && indicators.adx[indicatorIndex] !== undefined) {
          updateData.adx = indicators.adx[indicatorIndex];
        }
        if (indicators.cci && indicators.cci[indicatorIndex] !== undefined) {
          updateData.cci = indicators.cci[indicatorIndex];
        }
        if (indicators.williamsR && indicators.williamsR[indicatorIndex] !== undefined) {
          updateData.williamsR = indicators.williamsR[indicatorIndex];
        }

        // Nur aktualisieren, wenn es Indikatoren zu aktualisieren gibt
        if (Object.keys(updateData).length > 0) {
          await this.prisma.historicalData.update({
            where: { id: dataPoint.id },
            data: updateData,
          });
        }
      }

      this.logger.debug(`Technische Indikatoren für Aktie ${stockId} berechnet`);
    } catch (error) {
      this.logger.error(`Fehler bei der Berechnung der Indikatoren für Aktie ${stockId}`, error);
      throw error;
    }
  }

  /**
   * Berechnet alle technischen Indikatoren
   */
  private calculateAllIndicators(closes: number[], highs: number[], lows: number[], volumes: number[]): any {
    const indicators: any = {};

    try {
      // Simple Moving Average (20 Perioden)
      if (closes.length >= 20) {
        indicators.sma20 = TI.SMA.calculate({
          period: 20,
          values: closes,
        });
      }

      // Exponential Moving Average (50 Perioden)
      if (closes.length >= 50) {
        indicators.ema50 = TI.EMA.calculate({
          period: 50,
          values: closes,
        });
      }

      // Relative Strength Index (14 Perioden)
      if (closes.length >= 14) {
        indicators.rsi14 = TI.RSI.calculate({
          period: 14,
          values: closes,
        });
      }      // MACD (12, 26, 9)
      if (closes.length >= 26) {
        indicators.macd = TI.MACD.calculate({
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: true,
          SimpleMASignal: true,
          values: closes,
        });
      }

      // Bollinger Bands (20, 2)
      if (closes.length >= 20) {
        indicators.bollinger = TI.BollingerBands.calculate({
          period: 20,
          stdDev: 2,
          values: closes,
        });
      }

      // Average Directional Index (14 Perioden)
      if (closes.length >= 14) {
        indicators.adx = TI.ADX.calculate({
          period: 14,
          high: highs,
          low: lows,
          close: closes,
        });
      }

      // Commodity Channel Index (20 Perioden)
      if (closes.length >= 20) {
        indicators.cci = TI.CCI.calculate({
          period: 20,
          high: highs,
          low: lows,
          close: closes,
        });
      }

      // Williams %R (14 Perioden)
      if (closes.length >= 14) {
        indicators.williamsR = TI.WilliamsR.calculate({
          period: 14,
          high: highs,
          low: lows,
          close: closes,
        });
      }

    } catch (error) {
      this.logger.error('Fehler bei der Berechnung der technischen Indikatoren', error);
    }

    return indicators;
  }

  /**
   * Holt die berechneten Indikatoren für eine Aktie
   */
  async getIndicatorsForStock(ticker: string, limit: number = 100): Promise<any[]> {
    try {
      const stock = await this.prisma.stock.findUnique({
        where: { ticker },
        include: {
          historicalData: {
            orderBy: { timestamp: 'desc' },
            take: limit,
          },
        },
      });

      if (!stock) {
        throw new Error(`Aktie ${ticker} nicht gefunden`);
      }

      return stock.historicalData.map(data => ({
        timestamp: data.timestamp,
        close: data.close,
        sma20: data.sma20,
        ema50: data.ema50,
        rsi14: data.rsi14,
        macd: data.macd,
        macdSignal: data.macdSignal,
        macdHist: data.macdHist,
        bollUpper: data.bollUpper,
        bollLower: data.bollLower,
        bollMid: data.bollMid,
        adx: data.adx,
        cci: data.cci,
        williamsR: data.williamsR,
      }));
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen der Indikatoren für ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Analysiert Signale basierend auf technischen Indikatoren
   */
  async analyzeSignals(ticker: string): Promise<any> {
    try {
      const latestData = await this.prisma.historicalData.findFirst({
        where: {
          stock: { ticker },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (!latestData) {
        throw new Error(`Keine Daten für ${ticker} gefunden`);
      }

      const signals: any = {
        ticker,
        timestamp: latestData.timestamp,
        signals: [],
        overallSentiment: 'NEUTRAL',
      };

      // RSI-Signale
      if (latestData.rsi14) {
        if (latestData.rsi14 > 70) {
          signals.signals.push({
            type: 'RSI',
            signal: 'SELL',
            strength: 'STRONG',
            message: `RSI überkauft (${latestData.rsi14.toFixed(2)})`,
          });
        } else if (latestData.rsi14 < 30) {
          signals.signals.push({
            type: 'RSI',
            signal: 'BUY',
            strength: 'STRONG',
            message: `RSI überverkauft (${latestData.rsi14.toFixed(2)})`,
          });
        }
      }

      // MACD-Signale
      if (latestData.macd && latestData.macdSignal) {
        if (latestData.macd > latestData.macdSignal) {
          signals.signals.push({
            type: 'MACD',
            signal: 'BUY',
            strength: 'MEDIUM',
            message: 'MACD über Signal-Linie',
          });
        } else {
          signals.signals.push({
            type: 'MACD',
            signal: 'SELL',
            strength: 'MEDIUM',
            message: 'MACD unter Signal-Linie',
          });
        }
      }

      // Bollinger Band Signale
      if (latestData.bollUpper && latestData.bollLower && latestData.close) {
        if (latestData.close > latestData.bollUpper) {
          signals.signals.push({
            type: 'BOLLINGER',
            signal: 'SELL',
            strength: 'MEDIUM',
            message: 'Preis über oberem Bollinger Band',
          });
        } else if (latestData.close < latestData.bollLower) {
          signals.signals.push({
            type: 'BOLLINGER',
            signal: 'BUY',
            strength: 'MEDIUM',
            message: 'Preis unter unterem Bollinger Band',
          });
        }
      }

      // Berechne Gesamtstimmung
      const buySignals = signals.signals.filter((s: any) => s.signal === 'BUY').length;
      const sellSignals = signals.signals.filter((s: any) => s.signal === 'SELL').length;

      if (buySignals > sellSignals) {
        signals.overallSentiment = 'BULLISH';
      } else if (sellSignals > buySignals) {
        signals.overallSentiment = 'BEARISH';
      }

      return signals;
    } catch (error) {
      this.logger.error(`Fehler bei der Signal-Analyse für ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Analysiert Daten für eine bestimmte Aktie
   */
  async enrichDataForStock(ticker: string): Promise<void> {
    try {
      this.logger.log(`📊 Analysiere Daten für ${ticker}...`);

      // Hole die neuesten Rohdaten
      const data = await this.prisma.historicalData.findMany({
        where: {
          stock: { ticker },
          // Nur Daten ohne berechnete Indikatoren
          OR: [
            { sma20: null },
            { ema50: null },
            { rsi14: null },
            { macd: null },
          ],
        },
        orderBy: { timestamp: 'asc' },
        take: 200, // Genug für technische Indikatoren
        include: { stock: true },
      });

      if (data.length === 0) {
        this.logger.log(`Keine neuen Daten für ${ticker} zum Analysieren`);
        return;
      }

      await this.calculateAllIndicators(
        data.map(d => d.close),
        data.map(d => d.high), 
        data.map(d => d.low),
        data.map(d => Number(d.volume))
      );
      this.logger.log(`✅ ${data.length} Datenpunkte für ${ticker} analysiert`);

    } catch (error) {
      this.logger.error(`Fehler bei der Analyse für ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Analysiert alle verfügbaren Daten
   */
  async enrichAllData(): Promise<void> {
    try {
      this.logger.log('📊 Starte Vollanalyse aller Daten...');

      const stocks = await this.prisma.stock.findMany();
      
      for (const stock of stocks) {
        await this.enrichDataForStock(stock.ticker);
      }

      this.logger.log(`✅ Vollanalyse für ${stocks.length} Aktien abgeschlossen`);

    } catch (error) {
      this.logger.error('Fehler bei der Vollanalyse:', error);
      throw error;
    }
  }
}
