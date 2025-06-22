import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  ApiConfig,
  AppConfig,
  CacheConfig,
  DatabaseConfig,
} from '../common/types';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly config: AppConfig;

  constructor(private readonly nestConfigService: NestConfigService) {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Lädt und validiert die Konfiguration
   */
  private loadConfiguration(): AppConfig {
    const config: AppConfig = {
      environment: this.getEnvironment(),
      port: this.getNumber('APP_PORT', 3000),
      host: this.getString('APP_HOST', 'localhost'),
      cors: {
        enabled: this.getBoolean('CORS_ENABLED', true),
        origins: this.getStringArray('CORS_ORIGINS', ['http://localhost:3000']),
      },
      logging: {
        level: this.getString('LOG_LEVEL', 'info'),
        file: this.getBoolean('ENABLE_FILE_LOGGING', true),
        console: this.getBoolean('ENABLE_CONSOLE_LOGGING', true),
      },
      database: this.loadDatabaseConfig(),
      cache: this.loadCacheConfig(),
      apis: this.loadApiConfigs(),
      ml: {
        enabled: this.getBoolean('ML_ENABLED', true),
        serviceUrl: this.getString('ML_SERVICE_URL', 'http://localhost:8080'),
        timeout: this.getNumber('ML_TIMEOUT', 30000),
      },
      scheduling: {
        enabled: this.getBoolean('SCHEDULING_ENABLED', true),
        timezone: this.getString('SCHEDULING_TIMEZONE', 'Europe/Berlin'),
      },
    };

    return config;
  }

  /**
   * Lädt Datenbank-Konfiguration
   */
  private loadDatabaseConfig(): DatabaseConfig {
    return {
      url: this.getString(
        'DATABASE_URL',
        'postgresql://kairos:kairos@localhost:5432/kairos',
      ),
      type: this.getDatabaseType(),
      poolSize: this.getNumber('DATABASE_POOL_SIZE', 10),
      timeout: this.getNumber('DATABASE_TIMEOUT', 30000),
      ssl: this.getBoolean('DATABASE_SSL', false),
    };
  }

  /**
   * Lädt Cache-Konfiguration
   */
  private loadCacheConfig(): CacheConfig {
    return {
      enabled: this.getBoolean('CACHE_ENABLED', true),
      ttl: this.getNumber('CACHE_TTL', 300), // 5 Minuten
      maxSize: this.getNumber('CACHE_MAX_SIZE', 1000),
      cleanupInterval: this.getNumber('CACHE_CLEANUP_INTERVAL', 60000), // 1 Minute
    };
  }

  /**
   * Lädt API-Konfigurationen
   */
  private loadApiConfigs(): AppConfig['apis'] {
    return {
      alphaVantage: this.loadApiConfig('ALPHA_VANTAGE'),
      polygon: this.loadApiConfig('POLYGON'),
      finnhub: this.loadApiConfig('FINNHUB'),
    };
  }

  /**
   * Lädt einzelne API-Konfiguration
   */
  private loadApiConfig(prefix: string): ApiConfig | undefined {
    const baseUrl = this.getString(`${prefix}_BASE_URL`, '');
    const apiKey = this.getString(`${prefix}_API_KEY`, '');

    if (!baseUrl || !apiKey) {
      return undefined;
    }

    return {
      baseUrl,
      apiKey,
      timeout: this.getNumber(`${prefix}_TIMEOUT`, 10000),
      retries: this.getNumber(`${prefix}_RETRIES`, 3),
      rateLimit: this.getNumber(`${prefix}_RATE_LIMIT`, 100),
    };
  }

  /**
   * Validiert die Konfiguration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Basis-Validierung
    if (!this.config.port || this.config.port < 1 || this.config.port > 65535) {
      errors.push('Invalid port number');
    }

    if (!this.config.database.url) {
      errors.push('Database URL is required');
    }

    // API-Validierung
    const hasApiConfig = Object.values(this.config.apis).some(
      api => api !== undefined,
    );
    if (!hasApiConfig) {
      errors.push('At least one API configuration is required');
    }

    // ML-Service-Validierung
    if (this.config.ml.enabled && !this.config.ml.serviceUrl) {
      errors.push('ML service URL is required when ML is enabled');
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed: ${errors.join(', ')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log('Configuration validated successfully');
  }

  /**
   * Getter-Methoden für Konfigurationswerte
   */
  get environment(): string {
    return this.config.environment;
  }

  get port(): number {
    return this.config.port;
  }

  get host(): string {
    return this.config.host;
  }

  get cors(): AppConfig['cors'] {
    return this.config.cors;
  }

  get logging(): AppConfig['logging'] {
    return this.config.logging;
  }

  get database(): DatabaseConfig {
    return this.config.database;
  }

  get cache(): CacheConfig {
    return this.config.cache;
  }

  get apis(): AppConfig['apis'] {
    return this.config.apis;
  }

  get ml(): AppConfig['ml'] {
    return this.config.ml;
  }

  get scheduling(): AppConfig['scheduling'] {
    return this.config.scheduling;
  }

  // Legacy-Getter für Backward-Kompatibilität
  get databaseUrl(): string {
    return this.config.database.url;
  }

  get cacheEnabled(): boolean {
    return this.config.cache.enabled;
  }

  get cacheTtl(): number {
    return this.config.cache.ttl;
  }

  get cacheMaxSize(): number {
    return this.config.cache.maxSize;
  }

  get alphaVantageApiKey(): string | undefined {
    return this.config.apis.alphaVantage?.apiKey;
  }

  get polygonApiKey(): string | undefined {
    return this.config.apis.polygon?.apiKey;
  }

  get finnhubApiKey(): string | undefined {
    return this.config.apis.finnhub?.apiKey;
  }

  get mlServiceUrl(): string {
    return this.config.ml.serviceUrl;
  }

  get mlEnabled(): boolean {
    return this.config.ml.enabled;
  }

  get mlTimeout(): number {
    return this.config.ml.timeout;
  }

  get schedulingEnabled(): boolean {
    return this.config.scheduling.enabled;
  }

  get schedulingTimezone(): string {
    return this.config.scheduling.timezone;
  }

  /**
   * Cron-Schedule-Getter
   */
  get dataIngestionCron(): string {
    return this.getString('DATA_INGESTION_CRON', '*/30 9-17 * * 1-5');
  }

  get technicalAnalysisCron(): string {
    return this.getString('TECHNICAL_ANALYSIS_CRON', '5 * * * *');
  }

  get mlTrainingCron(): string {
    return this.getString('ML_TRAINING_CRON', '0 2 * * 1-5');
  }

  get predictionValidationCron(): string {
    return this.getString('PREDICTION_VALIDATION_CRON', '0 4 * * 1-5');
  }

  get dataCleanupCron(): string {
    return this.getString('DATA_CLEANUP_CRON', '0 3 * * 6');
  }

  get dailyPredictionCron(): string {
    return this.getString('DAILY_PREDICTION_CRON', '30 6 * * 1-5');
  }

  get dataIntegrityCron(): string {
    return this.getString('DATA_INTEGRITY_CRON', '0 1 * * *');
  }

  /**
   * Monitoring-Konfiguration
   */
  get enableCronMonitoring(): boolean {
    return this.getBoolean('ENABLE_CRON_MONITORING', true);
  }

  get cronJobTimeout(): number {
    return this.getNumber('CRON_JOB_TIMEOUT', 900000); // 15 Minuten
  }

  get enableCronNotifications(): boolean {
    return this.getBoolean('ENABLE_CRON_NOTIFICATIONS', true);
  }

  get cronFailureThreshold(): number {
    return this.getNumber('CRON_FAILURE_THRESHOLD', 2);
  }

  /**
   * E-Mail-Benachrichtigungen
   */
  get enableEmailNotifications(): boolean {
    return this.getBoolean('ENABLE_EMAIL_NOTIFICATIONS', false);
  }

  get emailConfig(): {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  } {
    return {
      host: this.getString('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.getNumber('EMAIL_PORT', 587),
      secure: this.getBoolean('EMAIL_SECURE', false),
      user: this.getString('EMAIL_USER', ''),
      pass: this.getString('EMAIL_PASS', ''),
      from: this.getString('EMAIL_FROM', ''),
    };
  }

  /**
   * Redis-Konfiguration
   */
  get redisUrl(): string {
    const password = this.getString('REDIS_PASSWORD', '');
    const host = this.getString('REDIS_HOST', 'localhost');
    const port = this.getNumber('REDIS_PORT', 6379);

    if (password) {
      return `redis://:${password}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
  }

  /**
   * Hilfsmethoden für Konfigurationswerte
   */
  private getEnvironment(): 'development' | 'staging' | 'production' {
    const env = this.getString('NODE_ENV', 'development');
    if (['development', 'staging', 'production'].includes(env)) {
      return env as 'development' | 'staging' | 'production';
    }
    return 'development';
  }

  private getDatabaseType(): 'postgresql' | 'sqlite' | 'mysql' {
    const url = this.getString('DATABASE_URL', '');
    if (url.includes('postgresql') || url.includes('postgres')) {
      return 'postgresql';
    } else if (url.includes('sqlite')) {
      return 'sqlite';
    } else if (url.includes('mysql')) {
      return 'mysql';
    }
    return 'postgresql'; // Default
  }

  private getString(key: string, defaultValue: string): string {
    return this.nestConfigService.get<string>(key) || defaultValue;
  }

  private getNumber(key: string, defaultValue: number): number {
    const value = this.nestConfigService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue;
    }
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  private getBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.nestConfigService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }

  private getStringArray(key: string, defaultValue: string[]): string[] {
    const value = this.nestConfigService.get<string>(key);
    if (!value) {
      return defaultValue;
    }
    return value.split(',').map(item => item.trim());
  }

  /**
   * Prüft ob eine API konfiguriert ist
   */
  isApiConfigured(apiName: string): boolean {
    const api = this.config.apis[apiName as keyof AppConfig['apis']];
    return api !== undefined && !!api.apiKey;
  }

  /**
   * Holt alle konfigurierten APIs
   */
  getConfiguredApis(): string[] {
    return Object.entries(this.config.apis)
      .filter(([_, config]) => config !== undefined)
      .map(([name, _]) => name);
  }

  /**
   * Exportiert die gesamte Konfiguration (ohne sensitive Daten)
   */
  exportConfig(): Omit<AppConfig, 'apis'> & {
    apis: Record<string, Omit<ApiConfig, 'apiKey'> & { configured: boolean }>;
  } {
    const exportedApis: Record<
      string,
      Omit<ApiConfig, 'apiKey'> & { configured: boolean }
    > = {};

    Object.entries(this.config.apis).forEach(([name, config]) => {
      if (config) {
        const { apiKey, ...rest } = config;
        exportedApis[name] = { ...rest, configured: !!apiKey };
      }
    });

    return {
      ...this.config,
      apis: exportedApis,
    };
  }
}
