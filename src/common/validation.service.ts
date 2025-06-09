import { Injectable } from "@nestjs/common";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PortfolioValidationRules {
  maxPositions?: number;
  maxPositionWeight?: number; // Prozent
  minCashReserve?: number; // Prozent
  allowedTickers?: string[];
  blacklistedTickers?: string[];
  maxSingleStockExposure?: number; // Prozent
  maxSectorExposure?: number; // Prozent
}

export interface TradingValidationRules {
  maxDailyTrades?: number;
  maxTradeSize?: number; // Dollar
  minTradeSize?: number; // Dollar
  maxLeverage?: number;
  allowedOrderTypes?: string[];
  tradingHours?: { start: string; end: string };
  maxSlippage?: number; // Prozent
}

@Injectable()
export class ValidationService {
  private readonly defaultPortfolioRules: PortfolioValidationRules = {
    maxPositions: 50,
    maxPositionWeight: 20, // 20% max per Position
    minCashReserve: 5, // 5% Cash-Reserve
    maxSingleStockExposure: 25, // 25% max in einer Aktie
    maxSectorExposure: 40, // 40% max in einem Sektor
  };

  private readonly defaultTradingRules: TradingValidationRules = {
    maxDailyTrades: 100,
    maxTradeSize: 100000, // $100k
    minTradeSize: 100, // $100
    maxLeverage: 2.0,
    allowedOrderTypes: ["MARKET", "LIMIT", "STOP", "STOP_LIMIT"],
    maxSlippage: 1.0, // 1% max slippage
  };

  /**
   * Validiert Ticker-Symbol
   */
  validateTicker(ticker: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!ticker || typeof ticker !== "string") {
      errors.push("Ticker must be a non-empty string");
      return { isValid: false, errors, warnings };
    }

    const cleanTicker = ticker.trim().toUpperCase();

    // Grundlegende Format-Prüfung
    if (!/^[A-Z]{1,5}$/.test(cleanTicker)) {
      errors.push("Ticker must be 1-5 uppercase letters");
    }

    // Bekannte problematische Ticker
    const blacklisted = ["TEST", "DEMO", "NULL", "VOID"];
    if (blacklisted.includes(cleanTicker)) {
      errors.push(`Ticker ${cleanTicker} is blacklisted`);
    }

    // Warnungen für seltene Ticker
    if (cleanTicker.length === 1) {
      warnings.push("Single-letter tickers are rare and might not exist");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Preis-Werte
   */
  validatePrice(price: number, fieldName: string = "price"): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof price !== "number" || isNaN(price)) {
      errors.push(`${fieldName} must be a valid number`);
      return { isValid: false, errors, warnings };
    }

    if (price <= 0) {
      errors.push(`${fieldName} must be greater than 0`);
    }

    if (price > 1000000) {
      warnings.push(`${fieldName} is unusually high (${price})`);
    }

    if (price < 0.01) {
      warnings.push(`${fieldName} is very low (${price})`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Mengen-Werte
   */
  validateQuantity(quantity: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof quantity !== "number" || isNaN(quantity)) {
      errors.push("Quantity must be a valid number");
      return { isValid: false, errors, warnings };
    }

    if (quantity <= 0) {
      errors.push("Quantity must be greater than 0");
    }

    if (quantity !== Math.floor(quantity)) {
      errors.push("Quantity must be a whole number");
    }

    if (quantity > 1000000) {
      warnings.push(`Quantity is very large (${quantity})`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Datum
   */
  validateDate(
    date: Date | string,
    fieldName: string = "date",
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let dateObj: Date;

    if (typeof date === "string") {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      errors.push(`${fieldName} must be a valid Date or date string`);
      return { isValid: false, errors, warnings };
    }

    if (isNaN(dateObj.getTime())) {
      errors.push(`${fieldName} is not a valid date`);
      return { isValid: false, errors, warnings };
    }

    const now = new Date();
    const twoYearsAgo = new Date(
      now.getFullYear() - 2,
      now.getMonth(),
      now.getDate(),
    );
    const oneYearFuture = new Date(
      now.getFullYear() + 1,
      now.getMonth(),
      now.getDate(),
    );

    if (dateObj > oneYearFuture) {
      warnings.push(`${fieldName} is far in the future`);
    }

    if (dateObj < twoYearsAgo) {
      warnings.push(`${fieldName} is quite old`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Portfolio
   */
  validatePortfolio(
    portfolio: any,
    rules?: PortfolioValidationRules,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const activeRules = { ...this.defaultPortfolioRules, ...rules };

    if (!portfolio) {
      errors.push("Portfolio is required");
      return { isValid: false, errors, warnings };
    }

    // Portfolio Name
    if (
      !portfolio.name ||
      typeof portfolio.name !== "string" ||
      portfolio.name.trim().length === 0
    ) {
      errors.push("Portfolio name is required");
    }

    // Positionen validieren
    if (!Array.isArray(portfolio.positions)) {
      errors.push("Portfolio positions must be an array");
    } else {
      // Anzahl Positionen
      if (
        activeRules.maxPositions &&
        portfolio.positions.length > activeRules.maxPositions
      ) {
        errors.push(
          `Portfolio exceeds maximum positions (${portfolio.positions.length}/${activeRules.maxPositions})`,
        );
      }

      // Einzelne Positionen validieren
      const tickerCounts = new Map<string, number>();
      for (let i = 0; i < portfolio.positions.length; i++) {
        const position = portfolio.positions[i];
        const positionErrors = this.validatePosition(position, i);
        errors.push(...positionErrors.errors);
        warnings.push(...positionErrors.warnings);

        // Ticker-Duplikate prüfen
        if (position.ticker) {
          const count = tickerCounts.get(position.ticker) || 0;
          tickerCounts.set(position.ticker, count + 1);
        }
      }

      // Duplikate melden
      for (const [ticker, count] of tickerCounts) {
        if (count > 1) {
          errors.push(`Duplicate ticker ${ticker} found ${count} times`);
        }
      }

      // Gewichtung prüfen
      if (portfolio.totalValue && portfolio.totalValue > 0) {
        const positionWeights = this.calculatePositionWeights(portfolio);
        for (const [ticker, weight] of positionWeights) {
          if (
            activeRules.maxPositionWeight &&
            weight > activeRules.maxPositionWeight
          ) {
            warnings.push(
              `Position ${ticker} exceeds maximum weight (${weight.toFixed(1)}%/${activeRules.maxPositionWeight}%)`,
            );
          }
        }
      }
    }

    // Wert-Validierung
    if (portfolio.totalValue !== undefined) {
      const valueResult = this.validatePrice(
        portfolio.totalValue,
        "totalValue",
      );
      errors.push(...valueResult.errors);
      warnings.push(...valueResult.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert einzelne Portfolio-Position
   */
  private validatePosition(position: any, index: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const prefix = `Position ${index}:`;

    if (!position) {
      errors.push(`${prefix} Position is null or undefined`);
      return { isValid: false, errors, warnings };
    }

    // Ticker validieren
    const tickerResult = this.validateTicker(position.ticker);
    errors.push(...tickerResult.errors.map((err) => `${prefix} ${err}`));
    warnings.push(...tickerResult.warnings.map((warn) => `${prefix} ${warn}`));

    // Quantity validieren
    const quantityResult = this.validateQuantity(position.quantity);
    errors.push(...quantityResult.errors.map((err) => `${prefix} ${err}`));
    warnings.push(
      ...quantityResult.warnings.map((warn) => `${prefix} ${warn}`),
    );

    // Average Price validieren
    const priceResult = this.validatePrice(
      position.averagePrice,
      "averagePrice",
    );
    errors.push(...priceResult.errors.map((err) => `${prefix} ${err}`));
    warnings.push(...priceResult.warnings.map((warn) => `${prefix} ${warn}`));

    // Current Price (optional)
    if (position.currentPrice !== undefined) {
      const currentPriceResult = this.validatePrice(
        position.currentPrice,
        "currentPrice",
      );
      errors.push(
        ...currentPriceResult.errors.map((err) => `${prefix} ${err}`),
      );
      warnings.push(
        ...currentPriceResult.warnings.map((warn) => `${prefix} ${warn}`),
      );
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Backtest-Konfiguration
   */
  validateBacktestConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push("Backtest config is required");
      return { isValid: false, errors, warnings };
    }

    // Tickers validieren
    if (!Array.isArray(config.tickers) || config.tickers.length === 0) {
      errors.push("At least one ticker is required");
    } else {
      config.tickers.forEach((ticker: string, index: number) => {
        const tickerResult = this.validateTicker(ticker);
        errors.push(
          ...tickerResult.errors.map((err) => `Ticker ${index}: ${err}`),
        );
        warnings.push(
          ...tickerResult.warnings.map((warn) => `Ticker ${index}: ${warn}`),
        );
      });
    }

    // Datum validieren
    const startDateResult = this.validateDate(config.startDate, "startDate");
    errors.push(...startDateResult.errors);
    warnings.push(...startDateResult.warnings);

    const endDateResult = this.validateDate(config.endDate, "endDate");
    errors.push(...endDateResult.errors);
    warnings.push(...endDateResult.warnings);

    // Datum-Logik prüfen
    if (startDateResult.isValid && endDateResult.isValid) {
      const startDate = new Date(config.startDate);
      const endDate = new Date(config.endDate);

      if (startDate >= endDate) {
        errors.push("Start date must be before end date");
      }

      const daysDiff =
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < 30) {
        warnings.push("Backtest period is very short (less than 30 days)");
      }
      if (daysDiff > 365 * 5) {
        warnings.push("Backtest period is very long (more than 5 years)");
      }
    }

    // Initial Capital validieren
    if (config.initialCapital !== undefined) {
      const capitalResult = this.validatePrice(
        config.initialCapital,
        "initialCapital",
      );
      errors.push(...capitalResult.errors);
      warnings.push(...capitalResult.warnings);

      if (config.initialCapital < 1000) {
        warnings.push("Initial capital is very low (< $1000)");
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert ML-Trainings-Parameter
   */
  validateMLTrainingConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push("ML training config is required");
      return { isValid: false, errors, warnings };
    }

    // Epochs validieren
    if (config.epochs !== undefined) {
      if (
        typeof config.epochs !== "number" ||
        config.epochs <= 0 ||
        config.epochs !== Math.floor(config.epochs)
      ) {
        errors.push("Epochs must be a positive integer");
      } else if (config.epochs > 1000) {
        warnings.push(
          "Very high number of epochs (> 1000) may take a long time",
        );
      } else if (config.epochs < 10) {
        warnings.push(
          "Low number of epochs (< 10) may result in undertrained model",
        );
      }
    }

    // Learning Rate validieren
    if (config.learningRate !== undefined) {
      if (typeof config.learningRate !== "number" || config.learningRate <= 0) {
        errors.push("Learning rate must be a positive number");
      } else if (config.learningRate > 1.0) {
        warnings.push(
          "High learning rate (> 1.0) may cause training instability",
        );
      } else if (config.learningRate < 0.00001) {
        warnings.push(
          "Very low learning rate (< 0.00001) may result in slow training",
        );
      }
    }

    // Batch Size validieren
    if (config.batchSize !== undefined) {
      if (
        typeof config.batchSize !== "number" ||
        config.batchSize <= 0 ||
        config.batchSize !== Math.floor(config.batchSize)
      ) {
        errors.push("Batch size must be a positive integer");
      } else if (config.batchSize > 1024) {
        warnings.push(
          "Large batch size (> 1024) may require significant memory",
        );
      } else if (config.batchSize < 8) {
        warnings.push("Small batch size (< 8) may result in unstable training");
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Berechnet Position-Gewichtungen
   */
  private calculatePositionWeights(portfolio: any): Map<string, number> {
    const weights = new Map<string, number>();

    if (
      !portfolio.positions ||
      !portfolio.totalValue ||
      portfolio.totalValue === 0
    ) {
      return weights;
    }

    for (const position of portfolio.positions) {
      if (position.ticker && position.quantity && position.averagePrice) {
        const positionValue = position.quantity * position.averagePrice;
        const weight = (positionValue / portfolio.totalValue) * 100;
        weights.set(position.ticker, weight);
      }
    }

    return weights;
  }

  /**
   * Sanitized Input (entfernt potentiell gefährliche Zeichen)
   */
  sanitizeInput(input: string): string {
    if (typeof input !== "string") {
      return "";
    }

    return input
      .replace(/[<>]/g, "") // HTML Tags entfernen
      .replace(/['"]/g, "") // Quotes entfernen
      .replace(/[;]/g, "") // Semikolons entfernen
      .trim();
  }

  /**
   * Validiert Email-Format
   */
  validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!email || typeof email !== "string") {
      errors.push("Email is required");
      return { isValid: false, errors, warnings };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push("Invalid email format");
    }

    if (email.length > 254) {
      errors.push("Email is too long");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Kombiniert mehrere ValidationResults
   */
  combineValidationResults(...results: ValidationResult[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const result of results) {
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
