import { Injectable, Logger } from '@nestjs/common';
import * as TI from 'technicalindicators';
import { PrismaService } from '../persistence/prisma.service';

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

      this.logger.log(
        `Berechne technische Indikatoren für ${activeStocks.length} Aktien`,
      );

      for (const stock of activeStocks) {
        try {
          await this.calculateIndicatorsForStock(stock.id);
        } catch (error) {
          this.logger.error(
            `Fehler bei der Berechnung der Indikatoren für ${stock.ticker}`,
            error,
          );
        }
      }

      this.logger.log('Technische Indikatoren erfolgreich berechnet');
    } catch (error) {
      this.logger.error(
        'Fehler bei der Berechnung der technischen Indikatoren',
        error,
      );
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
        this.logger.warn(
          `Nicht genügend Daten für Aktie ${stockId} (${historicalData.length} Punkte)`,
        );
        return;
      }

      // Sortiere chronologisch (älteste zuerst) für die Berechnung
      historicalData.reverse();

      // Extrahiere Preis-Arrays
      const closes = historicalData.map(d => d.close);
      const highs = historicalData.map(d => d.high);
      const lows = historicalData.map(d => d.low);
      const volumes = historicalData.map(d => Number(d.volume)); // Berechne alle Indikatoren
      const indicators = this.calculateAllIndicatorsRobust(
        closes,
        highs,
        lows,
        volumes,
      );

      // Aktualisiere die Datenpunkte mit den berechneten Indikatoren
      for (let i = 0; i < historicalData.length; i++) {
        const dataPoint = historicalData[i];
        const indicatorIndex = i;

        const updateData: any = {};

        // Nur die Indikatoren aktualisieren, die Werte haben
        if (
          indicators.sma20 &&
          indicators.sma20[indicatorIndex] !== undefined
        ) {
          updateData.sma20 = indicators.sma20[indicatorIndex];
        }
        if (
          indicators.ema50 &&
          indicators.ema50[indicatorIndex] !== undefined
        ) {
          updateData.ema50 = indicators.ema50[indicatorIndex];
        }
        if (
          indicators.rsi14 &&
          indicators.rsi14[indicatorIndex] !== undefined
        ) {
          updateData.rsi14 = indicators.rsi14[indicatorIndex];
        }
        if (indicators.macd && indicators.macd[indicatorIndex] !== undefined) {
          updateData.macd = indicators.macd[indicatorIndex].MACD;
          updateData.macdSignal = indicators.macd[indicatorIndex].signal;
          updateData.macdHist = indicators.macd[indicatorIndex].histogram;
        }
        if (
          indicators.bollinger &&
          indicators.bollinger[indicatorIndex] !== undefined
        ) {
          updateData.bollUpper = indicators.bollinger[indicatorIndex].upper;
          updateData.bollLower = indicators.bollinger[indicatorIndex].lower;
          updateData.bollMid = indicators.bollinger[indicatorIndex].middle;
        }
        if (indicators.adx && indicators.adx[indicatorIndex] !== undefined) {
          // ADX liefert ein Objekt zurück, wir speichern nur den ADX-Wert
          const adxValue = indicators.adx[indicatorIndex];
          updateData.adx =
            typeof adxValue === 'object' ? adxValue.adx : adxValue;
        }
        if (indicators.cci && indicators.cci[indicatorIndex] !== undefined) {
          updateData.cci = indicators.cci[indicatorIndex];
        }
        if (
          indicators.williamsR &&
          indicators.williamsR[indicatorIndex] !== undefined
        ) {
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

      this.logger.debug(
        `Technische Indikatoren für Aktie ${stockId} berechnet`,
      );
    } catch (error) {
      this.logger.error(
        `Fehler bei der Berechnung der Indikatoren für Aktie ${stockId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Validiert Eingabedaten vor der Indikator-Berechnung
   */
  private validateInputData(
    closes: number[],
    highs: number[],
    lows: number[],
    _volumes: number[],
  ): boolean {
    if (!closes || closes.length === 0) {
      throw new Error('Schlusskurse sind erforderlich');
    }

    if (highs.length !== closes.length || lows.length !== closes.length) {
      throw new Error('Inkonsistente Datenlängen (High/Low/Close)');
    }

    // Prüfe auf ungültige Werte
    for (let i = 0; i < closes.length; i++) {
      if (isNaN(closes[i]) || closes[i] <= 0) {
        this.logger.warn(`Ungültiger Schlusskurs an Index ${i}: ${closes[i]}`);
        return false;
      }
      if (highs[i] < closes[i] || lows[i] > closes[i]) {
        this.logger.warn(
          `Inkonsistente Preis-Daten an Index ${i}: H:${highs[i]}, L:${lows[i]}, C:${closes[i]}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Bereinigt und normalisiert Eingabedaten
   */
  private sanitizeInputData(data: any[]): {
    closes: number[];
    highs: number[];
    lows: number[];
    volumes: number[];
  } {
    const sanitized = data.filter(
      d =>
        d.close > 0 &&
        d.high > 0 &&
        d.low > 0 &&
        d.high >= d.close &&
        d.low <= d.close &&
        !isNaN(d.close) &&
        !isNaN(d.high) &&
        !isNaN(d.low),
    );

    return {
      closes: sanitized.map(d => Number(d.close)),
      highs: sanitized.map(d => Number(d.high)),
      lows: sanitized.map(d => Number(d.low)),
      volumes: sanitized.map(d => Number(d.volume)),
    };
  }

  /**
   * Berechnet erweiterte technische Indikatoren mit Fehlerbehandlung
   */
  async calculateIndicatorsForStockImproved(stockId: string): Promise<void> {
    try {
      // Hole die letzten 200 Datenpunkte (ausreichend für alle Indikatoren)
      const rawData = await this.prisma.historicalData.findMany({
        where: { stockId },
        orderBy: { timestamp: 'desc' },
        take: 200,
      });

      if (rawData.length < 50) {
        this.logger.warn(
          `Nicht genügend Daten für Aktie ${stockId} (${rawData.length} Punkte)`,
        );
        return;
      }

      // Sortiere chronologisch und bereinige Daten
      rawData.reverse();
      const { closes, highs, lows, volumes } = this.sanitizeInputData(rawData);

      // Validiere bereinigte Daten
      if (!this.validateInputData(closes, highs, lows, volumes)) {
        this.logger.error(
          `Datenvalidierung für Aktie ${stockId} fehlgeschlagen`,
        );
        return;
      }

      // Berechne alle Indikatoren mit Fehlerbehandlung
      const indicators = this.calculateAllIndicatorsRobust(
        closes,
        highs,
        lows,
        volumes,
      );

      // Aktualisiere Datenpunkte mit berechneten Indikatoren
      await this.updateDataPointsWithIndicators(rawData, indicators);

      this.logger.debug(
        `✅ Technische Indikatoren für Aktie ${stockId} erfolgreich berechnet`,
      );
    } catch (error) {
      this.logger.error(
        `Fehler bei der erweiterten Indikator-Berechnung für Aktie ${stockId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Robuste Berechnung aller technischen Indikatoren
   */
  private calculateAllIndicatorsRobust(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
  ): any {
    const indicators: any = {};

    try {
      // Simple Moving Average (20 Perioden)
      if (closes.length >= 20) {
        try {
          indicators.sma20 = TI.SMA.calculate({ period: 20, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei SMA20-Berechnung:', error);
        }
      }

      // Exponential Moving Average (50 Perioden)
      if (closes.length >= 50) {
        try {
          indicators.ema50 = TI.EMA.calculate({ period: 50, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei EMA50-Berechnung:', error);
        }
      }

      // Relative Strength Index (14 Perioden)
      if (closes.length >= 14) {
        try {
          indicators.rsi14 = TI.RSI.calculate({ period: 14, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei RSI14-Berechnung:', error);
        }
      }

      // MACD
      if (closes.length >= 26) {
        try {
          indicators.macd = TI.MACD.calculate({
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            values: closes,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          });
        } catch (error) {
          this.logger.warn('Fehler bei MACD-Berechnung:', error);
        }
      }

      // Bollinger Bands
      if (closes.length >= 20) {
        try {
          indicators.bollinger = TI.BollingerBands.calculate({
            period: 20,
            stdDev: 2,
            values: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei Bollinger Bands-Berechnung:', error);
        }
      }

      // ADX (Average Directional Index)
      if (closes.length >= 14) {
        try {
          indicators.adx = TI.ADX.calculate({
            period: 14,
            high: highs,
            low: lows,
            close: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei ADX-Berechnung:', error);
        }
      }

      // CCI (Commodity Channel Index)
      if (closes.length >= 20) {
        try {
          indicators.cci = TI.CCI.calculate({
            period: 20,
            high: highs,
            low: lows,
            close: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei CCI-Berechnung:', error);
        }
      }

      // Williams %R
      if (closes.length >= 14) {
        try {
          indicators.williamsR = TI.WilliamsR.calculate({
            period: 14,
            high: highs,
            low: lows,
            close: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei Williams %R-Berechnung:', error);
        }
      }

      // Berechne erweiterte Indikatoren
      const extendedIndicators = this.calculateExtendedIndicators(
        closes,
        highs,
        lows,
        volumes,
      );
      Object.assign(indicators, extendedIndicators);

      return indicators;
    } catch (error) {
      this.logger.error('Fehler bei der robusten Indikator-Berechnung:', error);
      return {};
    }
  }

  /**
   * Berechnet erweiterte technische Indikatoren
   */
  private calculateExtendedIndicators(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
  ): any {
    const indicators: any = {};

    try {
      // Average True Range (ATR)
      if (closes.length >= 14) {
        try {
          indicators.atr = TI.ATR.calculate({
            period: 14,
            high: highs,
            low: lows,
            close: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei ATR-Berechnung:', error);
        }
      }

      // On Balance Volume (OBV)
      if (closes.length >= 2 && volumes.length >= 2) {
        try {
          indicators.obv = TI.OBV.calculate({
            close: closes,
            volume: volumes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei OBV-Berechnung:', error);
        }
      }

      // Money Flow Index (MFI)
      if (closes.length >= 14) {
        try {
          indicators.mfi = TI.MFI.calculate({
            period: 14,
            high: highs,
            low: lows,
            close: closes,
            volume: volumes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei MFI-Berechnung:', error);
        }
      } // Stochastic Oscillator
      if (closes.length >= 14) {
        try {
          indicators.stoch = TI.Stochastic.calculate({
            period: 14,
            signalPeriod: 3,
            high: highs,
            low: lows,
            close: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei Stochastic-Berechnung:', error);
        }
      }

      // TRIX
      if (closes.length >= 42) {
        // 3 * 14 periods
        try {
          indicators.trix = TI.TRIX.calculate({
            period: 14,
            values: closes,
          });
        } catch (error) {
          this.logger.warn('Fehler bei TRIX-Berechnung:', error);
        }
      }

      // Volume Weighted Average Price (VWAP) approximation
      if (closes.length >= 1 && volumes.length >= 1) {
        try {
          indicators.vwap = this.calculateVWAP(closes, highs, lows, volumes);
        } catch (error) {
          this.logger.warn('Fehler bei VWAP-Berechnung:', error);
        }
      }

      // Relative Strength Index with different periods
      if (closes.length >= 9) {
        try {
          indicators.rsi9 = TI.RSI.calculate({ period: 9, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei RSI9-Berechnung:', error);
        }
      }

      if (closes.length >= 21) {
        try {
          indicators.rsi21 = TI.RSI.calculate({ period: 21, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei RSI21-Berechnung:', error);
        }
      }

      // Multiple timeframe EMAs
      if (closes.length >= 9) {
        try {
          indicators.ema9 = TI.EMA.calculate({ period: 9, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei EMA9-Berechnung:', error);
        }
      }

      if (closes.length >= 21) {
        try {
          indicators.ema21 = TI.EMA.calculate({ period: 21, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei EMA21-Berechnung:', error);
        }
      }

      if (closes.length >= 100) {
        try {
          indicators.ema100 = TI.EMA.calculate({ period: 100, values: closes });
        } catch (error) {
          this.logger.warn('Fehler bei EMA100-Berechnung:', error);
        }
      }

      // Parabolic SAR
      if (closes.length >= 2) {
        try {
          indicators.psar = TI.PSAR.calculate({
            step: 0.02,
            max: 0.2,
            high: highs,
            low: lows,
          });
        } catch (error) {
          this.logger.warn('Fehler bei PSAR-Berechnung:', error);
        }
      }

      return indicators;
    } catch (error) {
      this.logger.error(
        'Fehler bei der Berechnung erweiterter Indikatoren:',
        error,
      );
      return {};
    }
  }

  /**
   * Berechnet Volume Weighted Average Price (VWAP)
   */
  private calculateVWAP(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
  ): number[] {
    const vwap: number[] = [];
    let cumulativeVolume = 0;
    let cumulativeVolumePrice = 0;

    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeVolumePrice += typicalPrice * volumes[i];
      cumulativeVolume += volumes[i];

      if (cumulativeVolume > 0) {
        vwap.push(cumulativeVolumePrice / cumulativeVolume);
      } else {
        vwap.push(closes[i]);
      }
    }

    return vwap;
  }

  /**
   * Berechnet Support- und Resistance-Levels
   */
  calculateSupportResistanceLevels(
    closes: number[],
    highs: number[],
    lows: number[],
    lookbackPeriod: number = 20,
  ): { support: number[]; resistance: number[] } {
    const support: number[] = [];
    const resistance: number[] = [];

    if (closes.length < lookbackPeriod) {
      return { support, resistance };
    }

    for (let i = lookbackPeriod; i < closes.length; i++) {
      const recentData = {
        highs: highs.slice(i - lookbackPeriod, i),
        lows: lows.slice(i - lookbackPeriod, i),
        closes: closes.slice(i - lookbackPeriod, i),
      };

      // Finde lokale Minima (Support)
      const localLows = this.findLocalExtremes(recentData.lows, 'min');
      const avgSupport =
        localLows.reduce((sum, val) => sum + val, 0) / localLows.length;
      support.push(avgSupport || lows[i]);

      // Finde lokale Maxima (Resistance)
      const localHighs = this.findLocalExtremes(recentData.highs, 'max');
      const avgResistance =
        localHighs.reduce((sum, val) => sum + val, 0) / localHighs.length;
      resistance.push(avgResistance || highs[i]);
    }

    return { support, resistance };
  }

  /**
   * Findet lokale Extreme (Minima oder Maxima)
   */
  private findLocalExtremes(values: number[], type: 'min' | 'max'): number[] {
    const extremes: number[] = [];
    const windowSize = 3;

    for (let i = windowSize; i < values.length - windowSize; i++) {
      const window = values.slice(i - windowSize, i + windowSize + 1);
      const centerValue = values[i];

      if (type === 'min') {
        const isLocalMin = window.every(val => centerValue <= val);
        if (isLocalMin) extremes.push(centerValue);
      } else {
        const isLocalMax = window.every(val => centerValue >= val);
        if (isLocalMax) extremes.push(centerValue);
      }
    }

    return extremes;
  }

  /**
   * Berechnet erweiterte Marktindikatoren
   */
  calculateMarketIndicators(
    closes: number[],
    volumes: number[],
  ): {
    volatility: number;
    momentum: number;
    trend: number;
    volumeTrend: number;
  } {
    if (closes.length < 20) {
      return { volatility: 0, momentum: 0, trend: 0, volumeTrend: 0 };
    }

    // Volatilität (Standard Deviation der Returns)
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility =
      Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
          returns.length,
      ) * Math.sqrt(252); // Annualisiert

    // Momentum (Rate of Change über 10 Perioden)
    const momentum =
      closes.length >= 10
        ? (closes[closes.length - 1] - closes[closes.length - 11]) /
          closes[closes.length - 11]
        : 0;

    // Trend (Linearer Regression Slope)
    const trend = this.calculateTrendSlope(closes.slice(-20));

    // Volume Trend
    const volumeTrend =
      volumes.length >= 10 ? this.calculateTrendSlope(volumes.slice(-10)) : 0;

    return { volatility, momentum, trend, volumeTrend };
  }

  /**
   * Berechnet die Steigung einer linearen Regression
   */
  private calculateTrendSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Aktualisiert Datenpunkte mit berechneten Indikatoren
   */
  private async updateDataPointsWithIndicators(
    dataPoints: any[],
    indicators: any,
  ): Promise<void> {
    const updatePromises: Promise<any>[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      const dataPoint = dataPoints[i];
      const updateData: any = {};

      // Sichere Indikator-Zuordnung mit Offset-Berechnung
      const sma20Offset = Math.max(
        0,
        dataPoints.length - (indicators.sma20?.length || 0),
      );
      const ema50Offset = Math.max(
        0,
        dataPoints.length - (indicators.ema50?.length || 0),
      );
      const rsi14Offset = Math.max(
        0,
        dataPoints.length - (indicators.rsi14?.length || 0),
      );
      const macdOffset = Math.max(
        0,
        dataPoints.length - (indicators.macd?.length || 0),
      );
      const bollOffset = Math.max(
        0,
        dataPoints.length - (indicators.bollinger?.length || 0),
      );
      const adxOffset = Math.max(
        0,
        dataPoints.length - (indicators.adx?.length || 0),
      );
      const cciOffset = Math.max(
        0,
        dataPoints.length - (indicators.cci?.length || 0),
      );
      const williamsROffset = Math.max(
        0,
        dataPoints.length - (indicators.williamsR?.length || 0),
      );

      // SMA20
      if (indicators.sma20 && i >= sma20Offset) {
        const smaIndex = i - sma20Offset;
        if (smaIndex < indicators.sma20.length) {
          updateData.sma20 = indicators.sma20[smaIndex];
        }
      }

      // EMA50
      if (indicators.ema50 && i >= ema50Offset) {
        const emaIndex = i - ema50Offset;
        if (emaIndex < indicators.ema50.length) {
          updateData.ema50 = indicators.ema50[emaIndex];
        }
      }

      // RSI14
      if (indicators.rsi14 && i >= rsi14Offset) {
        const rsiIndex = i - rsi14Offset;
        if (rsiIndex < indicators.rsi14.length) {
          updateData.rsi14 = indicators.rsi14[rsiIndex];
        }
      }

      // MACD
      if (indicators.macd && i >= macdOffset) {
        const macdIndex = i - macdOffset;
        if (macdIndex < indicators.macd.length) {
          updateData.macd = indicators.macd[macdIndex].MACD;
          updateData.macdSignal = indicators.macd[macdIndex].signal;
          updateData.macdHist = indicators.macd[macdIndex].histogram;
        }
      }

      // Bollinger Bands
      if (indicators.bollinger && i >= bollOffset) {
        const bollIndex = i - bollOffset;
        if (bollIndex < indicators.bollinger.length) {
          updateData.bollUpper = indicators.bollinger[bollIndex].upper;
          updateData.bollLower = indicators.bollinger[bollIndex].lower;
          updateData.bollMid = indicators.bollinger[bollIndex].middle;
        }
      }

      // ADX
      if (indicators.adx && i >= adxOffset) {
        const adxIndex = i - adxOffset;
        if (adxIndex < indicators.adx.length) {
          // ADX liefert ein Objekt zurück, wir speichern nur den ADX-Wert
          const adxValue = indicators.adx[adxIndex];
          updateData.adx =
            typeof adxValue === 'object' ? adxValue.adx : adxValue;
        }
      }

      // CCI
      if (indicators.cci && i >= cciOffset) {
        const cciIndex = i - cciOffset;
        if (cciIndex < indicators.cci.length) {
          updateData.cci = indicators.cci[cciIndex];
        }
      }

      // Williams %R
      if (indicators.williamsR && i >= williamsROffset) {
        const wrIndex = i - williamsROffset;
        if (wrIndex < indicators.williamsR.length) {
          updateData.williamsR = indicators.williamsR[wrIndex];
        }
      }

      // Nur aktualisieren, wenn es Indikatoren zu aktualisieren gibt
      if (Object.keys(updateData).length > 0) {
        updatePromises.push(
          this.prisma.historicalData.update({
            where: { id: dataPoint.id },
            data: updateData,
          }),
        );
      }
    }

    // Führe alle Updates parallel aus
    await Promise.allSettled(updatePromises);
  }

  /**
   * Holt die berechneten Indikatoren für eine Aktie
   */
  async getIndicatorsForStock(
    ticker: string,
    limit: number = 100,
  ): Promise<any[]> {
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
      this.logger.error(
        `Fehler beim Abrufen der Indikatoren für ${ticker}`,
        error,
      );
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
      const buySignals = signals.signals.filter(
        (s: any) => s.signal === 'BUY',
      ).length;
      const sellSignals = signals.signals.filter(
        (s: any) => s.signal === 'SELL',
      ).length;

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
   * Analysiert Handelssignale basierend auf technischen Indikatoren
   */
  async analyzeTradeSignals(stockId: string): Promise<any[]> {
    try {
      // Hole die neuesten Daten mit Indikatoren
      const recentData = await this.prisma.historicalData.findMany({
        where: {
          stockId,
          AND: [
            { sma20: { not: null } },
            { ema50: { not: null } },
            { rsi14: { not: null } },
            { macd: { not: null } },
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: { stock: true },
      });

      if (recentData.length < 3) {
        return [];
      }

      const signals: any[] = [];
      const latest = recentData[0];
      const previous = recentData[1];

      // RSI Oversold/Overbought Signale
      if (latest.rsi14) {
        if (latest.rsi14 < 30) {
          signals.push({
            type: 'RSI_OVERSOLD',
            strength: Math.max(0, (30 - latest.rsi14) / 30),
            description: `RSI ist überverkauft (${latest.rsi14.toFixed(2)})`,
            action: 'BUY',
            timestamp: latest.timestamp,
          });
        } else if (latest.rsi14 > 70) {
          signals.push({
            type: 'RSI_OVERBOUGHT',
            strength: Math.max(0, (latest.rsi14 - 70) / 30),
            description: `RSI ist überkauft (${latest.rsi14.toFixed(2)})`,
            action: 'SELL',
            timestamp: latest.timestamp,
          });
        }
      }

      // MACD Bullish/Bearish Signale
      if (
        latest.macd &&
        latest.macdSignal &&
        previous.macd &&
        previous.macdSignal
      ) {
        const latestCrossover = latest.macd - latest.macdSignal;
        const previousCrossover = previous.macd - previous.macdSignal;

        if (previousCrossover <= 0 && latestCrossover > 0) {
          signals.push({
            type: 'MACD_BULLISH',
            strength: Math.min(
              1,
              Math.abs(latestCrossover) / (latest.close * 0.01),
            ),
            description: 'MACD Bullish Crossover erkannt',
            action: 'BUY',
            timestamp: latest.timestamp,
          });
        } else if (previousCrossover >= 0 && latestCrossover < 0) {
          signals.push({
            type: 'MACD_BEARISH',
            strength: Math.min(
              1,
              Math.abs(latestCrossover) / (latest.close * 0.01),
            ),
            description: 'MACD Bearish Crossover erkannt',
            action: 'SELL',
            timestamp: latest.timestamp,
          });
        }
      }

      // SMA Crossover Signale
      if (latest.sma20 && latest.ema50 && previous.sma20 && previous.ema50) {
        const latestCross = latest.sma20 - latest.ema50;
        const previousCross = previous.sma20 - previous.ema50;

        if (previousCross <= 0 && latestCross > 0) {
          signals.push({
            type: 'SMA_CROSSOVER',
            strength: Math.min(
              1,
              Math.abs(latestCross) / (latest.close * 0.02),
            ),
            description: 'Golden Cross: SMA20 übersteigt EMA50',
            action: 'BUY',
            timestamp: latest.timestamp,
          });
        } else if (previousCross >= 0 && latestCross < 0) {
          signals.push({
            type: 'SMA_CROSSOVER',
            strength: Math.min(
              1,
              Math.abs(latestCross) / (latest.close * 0.02),
            ),
            description: 'Death Cross: SMA20 fällt unter EMA50',
            action: 'SELL',
            timestamp: latest.timestamp,
          });
        }
      }

      // Bollinger Band Squeeze
      if (latest.bollUpper && latest.bollLower) {
        const bandWidth = (latest.bollUpper - latest.bollLower) / latest.close;
        if (bandWidth < 0.05) {
          // Sehr enge Bänder
          signals.push({
            type: 'BOLLINGER_SQUEEZE',
            strength: Math.max(0, (0.05 - bandWidth) / 0.05),
            description: `Bollinger Band Squeeze erkannt (Bandbreite: ${(bandWidth * 100).toFixed(2)}%)`,
            action: 'WATCH',
            timestamp: latest.timestamp,
          });
        }
      }

      return signals;
    } catch (error) {
      this.logger.error(`Fehler bei der Signal-Analyse für ${stockId}:`, error);
      return [];
    }
  }

  /**
   * Generiert eine Handelsempfehlung basierend auf allen Signalen
   */
  async generateTradeRecommendation(stockId: string): Promise<any> {
    try {
      const signals = await this.analyzeTradeSignals(stockId);

      if (signals.length === 0) {
        return {
          recommendation: 'HOLD',
          confidence: 0,
          signals: [],
          reasoning: 'Keine klaren Handelssignale erkannt',
        };
      }

      // Berechne Gesamtempfehlung basierend auf Signalstärken
      let buyScore = 0;
      let sellScore = 0;
      let totalStrength = 0;

      for (const signal of signals) {
        totalStrength += signal.strength;
        if (signal.action === 'BUY') {
          buyScore += signal.strength;
        } else if (signal.action === 'SELL') {
          sellScore += signal.strength;
        }
      }

      const netScore = buyScore - sellScore;
      const confidence = Math.min(1, totalStrength / signals.length);

      let recommendation: string;
      if (netScore > 0.5) {
        recommendation = 'BUY';
      } else if (netScore < -0.5) {
        recommendation = 'SELL';
      } else {
        recommendation = 'HOLD';
      }

      return {
        recommendation,
        confidence,
        signals,
        reasoning: `Basierend auf ${signals.length} Signalen (Buy: ${buyScore.toFixed(2)}, Sell: ${sellScore.toFixed(2)})`,
        netScore,
      };
    } catch (error) {
      this.logger.error(
        `Fehler bei der Empfehlungs-Generierung für ${stockId}:`,
        error,
      );
      return {
        recommendation: 'HOLD',
        confidence: 0,
        signals: [],
        reasoning: 'Fehler bei der Analyse',
      };
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

      this.calculateAllIndicatorsRobust(
        data.map(d => d.close),
        data.map(d => d.high),
        data.map(d => d.low),
        data.map(d => Number(d.volume)),
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

      this.logger.log(
        `✅ Vollanalyse für ${stocks.length} Aktien abgeschlossen`,
      );
    } catch (error) {
      this.logger.error('Fehler bei der Vollanalyse:', error);
      throw error;
    }
  }

  // Public methods for testing
  public calculateSMA(values: number[], period: number): number[] {
    try {
      return TI.SMA.calculate({ period, values });
    } catch (error) {
      this.logger.warn('Fehler bei SMA-Berechnung:', error);
      return [];
    }
  }

  public calculateEMA(values: number[], period: number): number[] {
    try {
      return TI.EMA.calculate({ period, values });
    } catch (error) {
      this.logger.warn('Fehler bei EMA-Berechnung:', error);
      return [];
    }
  }

  public calculateRSI(values: number[], period: number = 14): number[] {
    try {
      return TI.RSI.calculate({ period, values });
    } catch (error) {
      this.logger.warn('Fehler bei RSI-Berechnung:', error);
      return [];
    }
  }

  public calculateMACD(
    values: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
  ) {
    try {
      return TI.MACD.calculate({
        fastPeriod,
        slowPeriod,
        signalPeriod,
        values,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
    } catch (error) {
      this.logger.warn('Fehler bei MACD-Berechnung:', error);
      return [];
    }
  }

  public calculateBollingerBands(
    values: number[],
    period: number = 20,
    stdDev: number = 2,
  ) {
    try {
      return TI.BollingerBands.calculate({
        period,
        stdDev,
        values,
      });
    } catch (error) {
      this.logger.warn('Fehler bei Bollinger Bands-Berechnung:', error);
      return [];
    }
  }

  public async analyzeStock(symbol: string) {
    try {
      const stock = await this.prisma.stock.findUnique({
        where: { ticker: symbol },
        include: {
          historicalData: {
            orderBy: { timestamp: 'desc' },
            take: 50,
          },
        },
      });

      if (!stock || stock.historicalData.length === 0) {
        throw new Error(`No data found for symbol: ${symbol}`);
      }

      const closes = stock.historicalData.reverse().map(d => d.close);

      const indicators = {
        sma: this.calculateSMA(closes, 20),
        ema: this.calculateEMA(closes, 20),
        rsi: this.calculateRSI(closes, 14),
        macd: this.calculateMACD(closes),
        bollingerBands: this.calculateBollingerBands(closes),
      };

      return {
        symbol,
        analysis_date: new Date(),
        indicators,
        signals: this.generateSignals(indicators, closes),
        confidence: this.calculateConfidence(indicators),
        recommendation: this.generateRecommendation(indicators, closes),
      };
    } catch (error) {
      this.logger.error(`Fehler bei der Analyse von ${symbol}:`, error);
      throw error;
    }
  }

  private generateSignals(indicators: any, closes: number[]): string[] {
    const signals: string[] = [];
    const currentPrice = closes[closes.length - 1];

    // RSI Signale
    if (indicators.rsi.length > 0) {
      const currentRSI = indicators.rsi[indicators.rsi.length - 1];
      if (currentRSI > 70) {
        signals.push('RSI_OVERBOUGHT');
      } else if (currentRSI < 30) {
        signals.push('RSI_OVERSOLD');
      }
    }

    // SMA Signale
    if (indicators.sma.length > 0) {
      const currentSMA = indicators.sma[indicators.sma.length - 1];
      if (currentPrice > currentSMA) {
        signals.push('PRICE_ABOVE_SMA');
      } else {
        signals.push('PRICE_BELOW_SMA');
      }
    }

    return signals;
  }

  private calculateConfidence(indicators: any): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on available indicators
    if (indicators.rsi.length > 0) confidence += 0.1;
    if (indicators.macd.length > 0) confidence += 0.1;
    if (indicators.sma.length > 0) confidence += 0.1;
    if (indicators.ema.length > 0) confidence += 0.1;
    if (indicators.bollingerBands.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private generateRecommendation(indicators: any, closes: number[]): string {
    const signals = this.generateSignals(indicators, closes);

    const bullishSignals = signals.filter(
      s => s.includes('OVERSOLD') || s.includes('ABOVE'),
    ).length;

    const bearishSignals = signals.filter(
      s => s.includes('OVERBOUGHT') || s.includes('BELOW'),
    ).length;

    if (bullishSignals > bearishSignals) {
      return 'BUY';
    } else if (bearishSignals > bullishSignals) {
      return 'SELL';
    } else {
      return 'HOLD';
    }
  }
}
