import { Injectable } from '@nestjs/common';
import { ValidationError, ValidationResult } from './types';

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
    allowedOrderTypes: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'],
    maxSlippage: 1.0, // 1% max slippage
  };

  /**
   * Validiert Ticker-Symbole
   */
  validateTicker(ticker: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!ticker) {
      errors.push({
        field: 'ticker',
        message: 'Ticker-Symbol ist erforderlich',
        value: ticker,
      });
      return { isValid: false, errors, warnings };
    }

    const cleanTicker = ticker.trim().toUpperCase();

    // Länge prüfen
    if (cleanTicker.length < 1 || cleanTicker.length > 10) {
      errors.push({
        field: 'ticker',
        message: 'Ticker-Symbol muss zwischen 1 und 10 Zeichen lang sein',
        value: cleanTicker,
      });
    }

    // Nur Buchstaben, Zahlen und Punkte erlauben
    if (!/^[A-Z0-9.]+$/.test(cleanTicker)) {
      errors.push({
        field: 'ticker',
        message:
          'Ticker-Symbol darf nur Buchstaben, Zahlen und Punkte enthalten',
        value: cleanTicker,
      });
    }

    // Warnung für bekannte problematische Ticker
    if (cleanTicker.includes('.')) {
      warnings.push(
        'Ticker mit Punkten können bei einigen APIs Probleme verursachen',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validiert Preis-Werte
   */
  validatePrice(price: number, fieldName: string = 'price'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof price !== 'number' || isNaN(price)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be a valid number`,
        value: price,
      });
      return { isValid: false, errors, warnings };
    }

    if (price <= 0) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be greater than 0`,
        value: price,
      });
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
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof quantity !== 'number' || isNaN(quantity)) {
      errors.push({
        field: 'quantity',
        message: 'Quantity must be a valid number',
        value: quantity,
      });
      return { isValid: false, errors, warnings };
    }

    if (quantity <= 0) {
      errors.push({
        field: 'quantity',
        message: 'Quantity must be greater than 0',
        value: quantity,
      });
    }

    if (quantity !== Math.floor(quantity)) {
      errors.push({
        field: 'quantity',
        message: 'Quantity must be a whole number',
        value: quantity,
      });
    }

    if (quantity > 1000000) {
      warnings.push(`Quantity is very large (${quantity})`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Datumsbereiche
   */
  validateDateRange(startDate: Date, endDate: Date): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!startDate || !endDate) {
      errors.push({
        field: 'dateRange',
        message: 'Start- und Enddatum sind erforderlich',
        value: { startDate, endDate },
      });
      return { isValid: false, errors, warnings };
    }

    if (startDate >= endDate) {
      errors.push({
        field: 'dateRange',
        message: 'Startdatum muss vor dem Enddatum liegen',
        value: { startDate, endDate },
      });
    }

    const now = new Date();
    const maxDays = 365 * 5; // 5 Jahre
    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > maxDays) {
      warnings.push(
        `Datumsbereich ist sehr groß (${Math.round(daysDiff)} Tage)`,
      );
    }

    if (endDate > now) {
      warnings.push('Enddatum liegt in der Zukunft');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validiert Portfolio-Konfiguration
   */
  validatePortfolioConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push({
        field: 'config',
        message: 'Portfolio-Konfiguration ist erforderlich',
        value: config,
      });
      return { isValid: false, errors, warnings };
    }

    // Prüfe erforderliche Felder
    if (!config.name || typeof config.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Portfolio-Name ist erforderlich und muss ein String sein',
        value: config.name,
      });
    }

    if (config.initialCapital !== undefined) {
      const priceValidation = this.validatePrice(
        config.initialCapital,
        'initialCapital',
      );
      if (!priceValidation.isValid) {
        errors.push(...priceValidation.errors);
      }
      warnings.push(...priceValidation.warnings);
    }

    // Prüfe Regeln
    if (config.rules) {
      const rulesValidation = this.validatePortfolioRules(config.rules);
      if (!rulesValidation.isValid) {
        errors.push(...rulesValidation.errors);
      }
      warnings.push(...rulesValidation.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Portfolio-Regeln
   */
  validatePortfolioRules(rules: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (rules.maxPositions !== undefined) {
      if (typeof rules.maxPositions !== 'number' || rules.maxPositions <= 0) {
        errors.push({
          field: 'maxPositions',
          message: 'maxPositions muss eine positive Zahl sein',
          value: rules.maxPositions,
        });
      }
    }

    if (rules.maxPositionWeight !== undefined) {
      if (
        typeof rules.maxPositionWeight !== 'number' ||
        rules.maxPositionWeight <= 0 ||
        rules.maxPositionWeight > 100
      ) {
        errors.push({
          field: 'maxPositionWeight',
          message: 'maxPositionWeight muss zwischen 0 und 100 liegen',
          value: rules.maxPositionWeight,
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Positionen
   */
  validatePosition(position: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!position) {
      errors.push({
        field: 'position',
        message: 'Position ist erforderlich',
        value: position,
      });
      return { isValid: false, errors, warnings };
    }

    // Ticker validieren
    if (position.ticker) {
      const tickerValidation = this.validateTicker(position.ticker);
      if (!tickerValidation.isValid) {
        errors.push(...tickerValidation.errors);
      }
      warnings.push(...tickerValidation.warnings);
    }

    // Menge validieren
    if (position.quantity !== undefined) {
      const quantityValidation = this.validateQuantity(position.quantity);
      if (!quantityValidation.isValid) {
        errors.push(...quantityValidation.errors);
      }
      warnings.push(...quantityValidation.warnings);
    }

    // Preis validieren
    if (position.averagePrice !== undefined) {
      const priceValidation = this.validatePrice(
        position.averagePrice,
        'averagePrice',
      );
      if (!priceValidation.isValid) {
        errors.push(...priceValidation.errors);
      }
      warnings.push(...priceValidation.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert ML-Konfiguration
   */
  validateMLConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push({
        field: 'config',
        message: 'ML-Konfiguration ist erforderlich',
        value: config,
      });
      return { isValid: false, errors, warnings };
    }

    // Prüfe erforderliche Felder
    if (config.epochs !== undefined) {
      if (typeof config.epochs !== 'number' || config.epochs <= 0) {
        errors.push({
          field: 'epochs',
          message: 'epochs muss eine positive Zahl sein',
          value: config.epochs,
        });
      }
    }

    if (config.batchSize !== undefined) {
      if (typeof config.batchSize !== 'number' || config.batchSize <= 0) {
        errors.push({
          field: 'batchSize',
          message: 'batchSize muss eine positive Zahl sein',
          value: config.batchSize,
        });
      }
    }

    if (config.learningRate !== undefined) {
      if (
        typeof config.learningRate !== 'number' ||
        config.learningRate <= 0 ||
        config.learningRate > 1
      ) {
        errors.push({
          field: 'learningRate',
          message: 'learningRate muss zwischen 0 und 1 liegen',
          value: config.learningRate,
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert API-Konfiguration
   */
  validateApiConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push({
        field: 'config',
        message: 'API-Konfiguration ist erforderlich',
        value: config,
      });
      return { isValid: false, errors, warnings };
    }

    // Prüfe erforderliche Felder
    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      errors.push({
        field: 'baseUrl',
        message: 'baseUrl ist erforderlich und muss ein String sein',
        value: config.baseUrl,
      });
    }

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push({
        field: 'apiKey',
        message: 'apiKey ist erforderlich und muss ein String sein',
        value: config.apiKey,
      });
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout <= 0) {
        errors.push({
          field: 'timeout',
          message: 'timeout muss eine positive Zahl sein',
          value: config.timeout,
        });
      }
    }

    if (config.retries !== undefined) {
      if (typeof config.retries !== 'number' || config.retries < 0) {
        errors.push({
          field: 'retries',
          message: 'retries muss eine nicht-negative Zahl sein',
          value: config.retries,
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert E-Mail-Adressen
   */
  validateEmail(email: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!email) {
      errors.push({
        field: 'email',
        message: 'E-Mail-Adresse ist erforderlich',
        value: email,
      });
      return { isValid: false, errors, warnings };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push({
        field: 'email',
        message: 'Ungültige E-Mail-Adresse',
        value: email,
      });
    }

    if (email.length > 254) {
      errors.push({
        field: 'email',
        message: 'E-Mail-Adresse ist zu lang (max. 254 Zeichen)',
        value: email,
      });
    }

    // Warnung für verdächtige E-Mail-Adressen
    if (email.includes('test') || email.includes('example')) {
      warnings.push('E-Mail-Adresse scheint eine Test-Adresse zu sein');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validiert Passwörter
   */
  validatePassword(password: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!password) {
      errors.push({
        field: 'password',
        message: 'Passwort ist erforderlich',
        value: password,
      });
      return { isValid: false, errors, warnings };
    }

    if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Passwort muss mindestens 8 Zeichen lang sein',
        value: password,
      });
    }

    if (password.length > 128) {
      errors.push({
        field: 'password',
        message: 'Passwort ist zu lang (max. 128 Zeichen)',
        value: password,
      });
    }

    // Prüfe Komplexität
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      warnings.push(
        'Passwort sollte Groß- und Kleinbuchstaben sowie Zahlen enthalten',
      );
    }

    if (!hasSpecialChar) {
      warnings.push('Passwort sollte Sonderzeichen enthalten');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Bereinigt Eingabedaten
   */
  sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Entferne potenziell gefährliche Zeichen
      .replace(/\s+/g, ' '); // Normalisiere Whitespace
  }

  /**
   * Validiert und bereinigt JSON
   */
  validateAndSanitizeJson(jsonString: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!jsonString || typeof jsonString !== 'string') {
      errors.push({
        field: 'jsonString',
        message: 'JSON-String ist erforderlich',
        value: jsonString,
      });
      return { isValid: false, errors, warnings };
    }

    try {
      const parsed = JSON.parse(jsonString);

      // Prüfe auf zirkuläre Referenzen
      const checkCircular = (obj: any): boolean => {
        const seen = new WeakSet();
        const check = (val: any): boolean => {
          if (val !== null && typeof val === 'object') {
            if (seen.has(val)) {
              return true; // Zirkuläre Referenz gefunden
            }
            seen.add(val);
            return Object.values(val).some(check);
          }
          return false;
        };
        return check(obj);
      };

      if (checkCircular(parsed)) {
        warnings.push('JSON enthält zirkuläre Referenzen');
      }

      return { isValid: true, errors, warnings };
    } catch (error) {
      errors.push({
        field: 'jsonString',
        message: `Ungültiges JSON: ${(error as Error).message}`,
        value: jsonString,
      });
      return { isValid: false, errors, warnings };
    }
  }
}
