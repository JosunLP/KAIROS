import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private readonly nestConfigService: NestConfigService) {}

  // API Keys
  get alphaVantageApiKey(): string {
    return this.nestConfigService.get<string>('ALPHA_VANTAGE_API_KEY', '');
  }

  get polygonApiKey(): string {
    return this.nestConfigService.get<string>('POLYGON_API_KEY', '');
  }

  get finnhubApiKey(): string {
    return this.nestConfigService.get<string>('FINNHUB_API_KEY', '');
  }

  // Datenbank
  get databaseUrl(): string {
    return this.nestConfigService.get<string>('DATABASE_URL', 'file:./kairos.db');
  }

  // ML Konfiguration
  get mlModelPath(): string {
    return this.nestConfigService.get<string>('ML_MODEL_PATH', './models');
  }

  get mlTrainingEpochs(): number {
    return this.nestConfigService.get<number>('ML_TRAINING_EPOCHS', 50);
  }

  get mlBatchSize(): number {
    return this.nestConfigService.get<number>('ML_BATCH_SIZE', 32);
  }

  get mlSequenceLength(): number {
    return this.nestConfigService.get<number>('ML_SEQUENCE_LENGTH', 30);
  }

  // Scheduling
  get dataFetchInterval(): string {
    return this.nestConfigService.get<string>('DATA_FETCH_INTERVAL', '*/15 * * * *'); // Alle 15 Minuten
  }

  get analysisInterval(): string {
    return this.nestConfigService.get<string>('ANALYSIS_INTERVAL', '0 * * * *'); // Jede Stunde
  }

  get trainingInterval(): string {
    return this.nestConfigService.get<string>('TRAINING_INTERVAL', '0 2 * * *'); // Täglich um 2 Uhr
  }

  // API Rate Limits
  get alphaVantageRateLimit(): number {
    return this.nestConfigService.get<number>('ALPHA_VANTAGE_RATE_LIMIT', 5); // Anfragen pro Minute
  }

  get polygonRateLimit(): number {
    return this.nestConfigService.get<number>('POLYGON_RATE_LIMIT', 10);
  }

  get finnhubRateLimit(): number {
    return this.nestConfigService.get<number>('FINNHUB_RATE_LIMIT', 60);
  }

  // Retry-Konfiguration
  get retryAttempts(): number {
    return this.nestConfigService.get<number>('RETRY_ATTEMPTS', 3);
  }

  get retryDelay(): number {
    return this.nestConfigService.get<number>('RETRY_DELAY', 1000); // ms
  }

  // Logging
  get logLevel(): string {
    return this.nestConfigService.get<string>('LOG_LEVEL', 'info');
  }

  get enableFileLogging(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_FILE_LOGGING', false);
  }

  get logFilePath(): string {
    return this.nestConfigService.get<string>('LOG_FILE_PATH', './logs/kairos.log');
  }

  // Validierung der Konfiguration
  validateConfig(): boolean {
    const errors: string[] = [];

    // Prüfe ob mindestens ein API-Key vorhanden ist
    if (!this.alphaVantageApiKey && !this.polygonApiKey && !this.finnhubApiKey) {
      errors.push('Mindestens ein API-Key (ALPHA_VANTAGE_API_KEY, POLYGON_API_KEY oder FINNHUB_API_KEY) muss gesetzt sein');
    }

    // Prüfe ML-Parameter
    if (this.mlTrainingEpochs < 1 || this.mlTrainingEpochs > 1000) {
      errors.push('ML_TRAINING_EPOCHS muss zwischen 1 und 1000 liegen');
    }

    if (this.mlBatchSize < 1 || this.mlBatchSize > 1024) {
      errors.push('ML_BATCH_SIZE muss zwischen 1 und 1024 liegen');
    }

    if (this.mlSequenceLength < 5 || this.mlSequenceLength > 100) {
      errors.push('ML_SEQUENCE_LENGTH muss zwischen 5 und 100 liegen');
    }

    // Fehler ausgeben falls vorhanden
    if (errors.length > 0) {
      this.logger.error('Konfigurationsfehler:');
      errors.forEach(error => this.logger.error(` - ${error}`));
      return false;
    }

    this.logger.log('✅ Konfiguration erfolgreich validiert');
    return true;
  }

  // Hilfsmethode für API-Konfiguration
  getApiConfig(provider: 'alphavantage' | 'polygon' | 'finnhub') {
    switch (provider) {
      case 'alphavantage':
        return {
          apiKey: this.alphaVantageApiKey,
          rateLimit: this.alphaVantageRateLimit,
          baseUrl: 'https://www.alphavantage.co/query',
        };
      case 'polygon':
        return {
          apiKey: this.polygonApiKey,
          rateLimit: this.polygonRateLimit,
          baseUrl: 'https://api.polygon.io',
        };
      case 'finnhub':
        return {
          apiKey: this.finnhubApiKey,
          rateLimit: this.finnhubRateLimit,
          baseUrl: 'https://finnhub.io/api/v1',
        };
      default:
        throw new Error(`Unbekannter Provider: ${provider}`);
    }
  }
}
