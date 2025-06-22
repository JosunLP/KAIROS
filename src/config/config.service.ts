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
    return this.nestConfigService.get<string>(
      'DATABASE_URL',
      'file:./kairos.db',
    );
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
    return this.nestConfigService.get<string>(
      'DATA_FETCH_INTERVAL',
      '*/15 * * * *',
    ); // Alle 15 Minuten
  }

  get analysisInterval(): string {
    return this.nestConfigService.get<string>('ANALYSIS_INTERVAL', '0 * * * *'); // Jede Stunde
  }

  get trainingInterval(): string {
    return this.nestConfigService.get<string>('TRAINING_INTERVAL', '0 2 * * *'); // Täglich um 2 Uhr
  }

  // Scheduling - Erweiterte Cron Job Konfiguration
  get dataIngestionCron(): string {
    return this.nestConfigService.get<string>(
      'DATA_INGESTION_CRON',
      '*/15 * * * *',
    );
  }

  get technicalAnalysisCron(): string {
    return this.nestConfigService.get<string>(
      'TECHNICAL_ANALYSIS_CRON',
      '0 * * * *',
    );
  }

  get mlTrainingCron(): string {
    return this.nestConfigService.get<string>('ML_TRAINING_CRON', '0 2 * * *');
  }

  get predictionValidationCron(): string {
    return this.nestConfigService.get<string>(
      'PREDICTION_VALIDATION_CRON',
      '0 3 * * *',
    );
  }

  get dataCleaupCron(): string {
    return this.nestConfigService.get<string>('DATA_CLEANUP_CRON', '0 4 * * 0');
  }

  get dailyPredictionCron(): string {
    return this.nestConfigService.get<string>(
      'DAILY_PREDICTION_CRON',
      '0 6 * * *',
    );
  }

  get dataIntegrityCron(): string {
    return this.nestConfigService.get<string>(
      'DATA_INTEGRITY_CRON',
      '0 1 * * *',
    );
  }

  get schedulingTimezone(): string {
    return this.nestConfigService.get<string>(
      'SCHEDULING_TIMEZONE',
      'Europe/Berlin',
    );
  }

  // Cron Job Monitoring
  get enableCronMonitoring(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_CRON_MONITORING', true);
  }

  get cronJobTimeout(): number {
    return this.nestConfigService.get<number>('CRON_JOB_TIMEOUT', 300000); // 5 Minuten
  }

  get cronJobRetryAttempts(): number {
    return this.nestConfigService.get<number>('CRON_JOB_RETRY_ATTEMPTS', 3);
  }

  get cronJobRetryDelay(): number {
    return this.nestConfigService.get<number>('CRON_JOB_RETRY_DELAY', 30000); // 30 Sekunden
  }

  // Notification Settings für Cron Jobs
  get enableCronNotifications(): boolean {
    return this.nestConfigService.get<boolean>(
      'ENABLE_CRON_NOTIFICATIONS',
      false,
    );
  }

  get cronFailureThreshold(): number {
    return this.nestConfigService.get<number>('CRON_FAILURE_THRESHOLD', 3);
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
    return this.nestConfigService.get<string>(
      'LOG_FILE_PATH',
      './logs/kairos.log',
    );
  }
  // Validierung der Konfiguration
  validateConfig(): boolean {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Prüfe ob mindestens ein API-Key vorhanden ist
    if (
      !this.alphaVantageApiKey &&
      !this.polygonApiKey &&
      !this.finnhubApiKey
    ) {
      errors.push(
        'Mindestens ein API-Key (ALPHA_VANTAGE_API_KEY, POLYGON_API_KEY oder FINNHUB_API_KEY) muss gesetzt sein',
      );
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

    // Prüfe Trading Limits
    if (this.maxTradeAmount <= this.minTradeAmount) {
      errors.push('MAX_TRADE_AMOUNT muss größer als MIN_TRADE_AMOUNT sein');
    }

    if (this.maxPortfolioRisk < 1 || this.maxPortfolioRisk > 100) {
      errors.push('MAX_PORTFOLIO_RISK muss zwischen 1 und 100 liegen');
    }

    if (this.maxPositionSize < 1 || this.maxPositionSize > 50) {
      errors.push('MAX_POSITION_SIZE muss zwischen 1 und 50 liegen');
    }

    // Prüfe Security Settings in Production
    if (this.isProduction) {
      if (this.encryptionKey === 'default-key-change-in-production') {
        errors.push('ENCRYPTION_KEY muss in Produktion geändert werden');
      }

      if (this.sessionSecret === 'default-secret-change-in-production') {
        errors.push('SESSION_SECRET muss in Produktion geändert werden');
      }

      if (!this.enableApiAuth) {
        warnings.push('API-Authentifizierung ist in Produktion deaktiviert');
      }
    }

    // Prüfe Performance Settings
    if (this.cacheMaxSize < 100 || this.cacheMaxSize > 100000) {
      warnings.push('CACHE_MAX_SIZE sollte zwischen 100 und 100000 liegen');
    }

    if (this.cacheTtl < 60 || this.cacheTtl > 3600) {
      warnings.push('CACHE_TTL sollte zwischen 60 und 3600 Sekunden liegen');
    }

    // Prüfe Notification Settings
    if (this.enableEmailNotifications && !this.notificationEmail) {
      warnings.push(
        'Email-Benachrichtigungen aktiviert, aber keine E-Mail-Adresse konfiguriert',
      );
    }

    // Warnungen ausgeben
    if (warnings.length > 0) {
      this.logger.warn('Konfigurationswarnungen:');
      warnings.forEach(warning => this.logger.warn(` - ${warning}`));
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

  // Cache Konfiguration
  get cacheEnabled(): boolean {
    return this.nestConfigService.get<boolean>('CACHE_ENABLED', true);
  }

  get cacheTtl(): number {
    return this.nestConfigService.get<number>('CACHE_TTL', 300); // 5 Minuten
  }

  get cacheMaxSize(): number {
    return this.nestConfigService.get<number>('CACHE_MAX_SIZE', 1000);
  }

  // Performance Monitoring
  get enablePerformanceMonitoring(): boolean {
    return this.nestConfigService.get<boolean>(
      'ENABLE_PERFORMANCE_MONITORING',
      true,
    );
  }

  get performanceMetricsInterval(): number {
    return this.nestConfigService.get<number>(
      'PERFORMANCE_METRICS_INTERVAL',
      60000,
    ); // 1 Minute
  }

  // Security
  get encryptionKey(): string {
    return this.nestConfigService.get<string>(
      'ENCRYPTION_KEY',
      'default-key-change-in-production',
    );
  }

  get sessionSecret(): string {
    return this.nestConfigService.get<string>(
      'SESSION_SECRET',
      'default-secret-change-in-production',
    );
  }

  get enableApiAuth(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_API_AUTH', false);
  }

  // Trading Limits
  get maxDailyTrades(): number {
    return this.nestConfigService.get<number>('MAX_DAILY_TRADES', 100);
  }

  get maxTradeAmount(): number {
    return this.nestConfigService.get<number>('MAX_TRADE_AMOUNT', 100000); // $100k
  }

  get minTradeAmount(): number {
    return this.nestConfigService.get<number>('MIN_TRADE_AMOUNT', 100); // $100
  }

  get enablePaperTrading(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_PAPER_TRADING', true);
  }

  // Risk Management
  get maxPortfolioRisk(): number {
    return this.nestConfigService.get<number>('MAX_PORTFOLIO_RISK', 20); // 20%
  }

  get maxPositionSize(): number {
    return this.nestConfigService.get<number>('MAX_POSITION_SIZE', 10); // 10% des Portfolios
  }

  get stopLossPercentage(): number {
    return this.nestConfigService.get<number>('STOP_LOSS_PERCENTAGE', 5); // 5% Stop Loss
  }

  get takeProfitPercentage(): number {
    return this.nestConfigService.get<number>('TAKE_PROFIT_PERCENTAGE', 15); // 15% Take Profit
  }

  // Data Quality
  get minDataQualityScore(): number {
    return this.nestConfigService.get<number>('MIN_DATA_QUALITY_SCORE', 80); // 80%
  }

  get maxDataAge(): number {
    return this.nestConfigService.get<number>('MAX_DATA_AGE', 86400); // 24 Stunden in Sekunden
  }

  // Notification Settings
  get enableEmailNotifications(): boolean {
    return this.nestConfigService.get<boolean>(
      'ENABLE_EMAIL_NOTIFICATIONS',
      false,
    );
  }

  get notificationEmail(): string {
    return this.nestConfigService.get<string>('NOTIFICATION_EMAIL', '');
  }

  get criticalAlertThreshold(): number {
    return this.nestConfigService.get<number>('CRITICAL_ALERT_THRESHOLD', 95); // 95%
  }

  // Backup Settings
  get enableAutoBackup(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_AUTO_BACKUP', true);
  }

  get backupInterval(): string {
    return this.nestConfigService.get<string>('BACKUP_INTERVAL', '0 3 * * *'); // Täglich um 3 Uhr
  }

  get backupRetentionDays(): number {
    return this.nestConfigService.get<number>('BACKUP_RETENTION_DAYS', 30);
  }

  get backupPath(): string {
    return this.nestConfigService.get<string>('BACKUP_PATH', './backups');
  }

  // Feature Flags
  get enableMLPredictions(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_ML_PREDICTIONS', true);
  }

  get enableAdvancedAnalytics(): boolean {
    return this.nestConfigService.get<boolean>(
      'ENABLE_ADVANCED_ANALYTICS',
      true,
    );
  }

  get enableRealTimeData(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_REAL_TIME_DATA', false);
  }

  get enableSentimentAnalysis(): boolean {
    return this.nestConfigService.get<boolean>(
      'ENABLE_SENTIMENT_ANALYSIS',
      false,
    );
  }

  // Development Settings
  get isDevelopment(): boolean {
    return (
      this.nestConfigService.get<string>('NODE_ENV', 'development') ===
      'development'
    );
  }

  get isProduction(): boolean {
    return (
      this.nestConfigService.get<string>('NODE_ENV', 'development') ===
      'production'
    );
  }

  get enableDebugMode(): boolean {
    return this.nestConfigService.get<boolean>(
      'ENABLE_DEBUG_MODE',
      this.isDevelopment,
    );
  }

  get mockDataInDev(): boolean {
    return this.nestConfigService.get<boolean>('MOCK_DATA_IN_DEV', true);
  }
}
