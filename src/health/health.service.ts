import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../common/cache.service';
import { ErrorHandlingService } from '../common/error-handling.service';
import { HealthCheckResult } from '../common/types';
import { ConfigService } from '../config/config.service';
import { DataIngestionService } from '../data-ingestion/data-ingestion.service';
import { MlPredictionService } from '../ml-prediction/ml-prediction.service';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly errorHandling: ErrorHandlingService,
    private readonly dataIngestion: DataIngestionService,
    private readonly mlPrediction: MlPredictionService,
  ) {}

  /**
   * Führt einen vollständigen Health Check durch
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {};

    try {
      // Datenbank-Check
      checks.database = await this.checkDatabase();

      // Cache-Check
      checks.cache = await this.checkCache();

      // API-Provider-Check
      checks.apiProviders = await this.checkApiProviders();

      // ML-Service-Check
      checks.mlService = await this.checkMLService();

      // Datenqualität-Check
      checks.dataQuality = await this.checkDataQuality();

      // System-Ressourcen-Check
      checks.systemResources = await this.checkSystemResources();

      // Fehler-Check
      checks.errorRate = await this.checkErrorRate();

      // Gesamtstatus bestimmen
      const status = this.determineOverallStatus(checks);

      const duration = Date.now() - startTime;

      return {
        status,
        checks,
        timestamp: new Date(),
        duration,
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        checks: {
          healthCheck: {
            status: 'unhealthy',
            message: 'Health check itself failed',
            duration: Date.now() - startTime,
          },
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Prüft die Datenbankverbindung
   */
  private async checkDatabase(): Promise<
    HealthCheckResult['checks']['database']
  > {
    const startTime = Date.now();

    try {
      // Verbindung testen
      await this.prisma.$queryRaw`SELECT 1`;

      // Tabellen prüfen
      const stockCount = await this.prisma.stock.count();
      const dataCount = await this.prisma.historicalData.count();

      const duration = Date.now() - startTime;

      return {
        status: 'healthy',
        message: `Database connected. ${stockCount} stocks, ${dataCount} data points`,
        duration,
        metadata: {
          stockCount,
          dataCount,
          url: this.config.database.url.replace(/\/\/.*@/, '//***:***@'), // Passwort ausblenden
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Prüft den Cache
   */
  private async checkCache(): Promise<HealthCheckResult['checks']['cache']> {
    const startTime = Date.now();

    try {
      const stats = this.cache.getStatistics();
      const health = this.cache.healthCheck();

      const duration = Date.now() - startTime;

      if (health.healthy) {
        return {
          status: 'healthy',
          message: `Cache operational. Hit rate: ${stats.hitRate.toFixed(1)}%`,
          duration,
          metadata: {
            hitRate: stats.hitRate,
            totalEntries: stats.totalEntries,
            memoryUsage: stats.memoryUsage,
          },
        };
      } else {
        return {
          status: 'degraded',
          message: `Cache issues: ${health.issues.join(', ')}`,
          duration,
          metadata: {
            issues: health.issues,
            stats,
          },
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `Cache check failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Prüft API-Provider
   */
  private async checkApiProviders(): Promise<
    HealthCheckResult['checks']['apiProviders']
  > {
    const startTime = Date.now();

    try {
      const configuredApis = this.config.getConfiguredApis();
      const stats = await this.dataIngestion.getDataStatistics();

      const providerStatuses = Object.entries(stats.providerStats).map(
        ([name, stats]) => ({
          name,
          configured: configuredApis.includes(name),
          successRate: stats.successRate,
          requests: stats.requests,
          errors: stats.errors,
        }),
      );

      const healthyProviders = providerStatuses.filter(
        p => p.configured && p.successRate > 80,
      );
      const totalConfigured = providerStatuses.filter(p => p.configured).length;

      const duration = Date.now() - startTime;

      if (healthyProviders.length === totalConfigured && totalConfigured > 0) {
        return {
          status: 'healthy',
          message: `All ${totalConfigured} API providers operational`,
          duration,
          metadata: {
            providers: providerStatuses,
            lastUpdate: stats.lastUpdate,
          },
        };
      } else if (healthyProviders.length > 0) {
        return {
          status: 'degraded',
          message: `${healthyProviders.length}/${totalConfigured} API providers operational`,
          duration,
          metadata: {
            providers: providerStatuses,
            healthyCount: healthyProviders.length,
            totalConfigured,
          },
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'No API providers operational',
          duration,
          metadata: {
            providers: providerStatuses,
          },
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `API providers check failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Prüft ML-Service
   */
  private async checkMLService(): Promise<
    HealthCheckResult['checks']['mlService']
  > {
    const startTime = Date.now();

    try {
      const status = await this.mlPrediction.checkMLServiceStatus();
      const duration = Date.now() - startTime;

      if (status.healthy) {
        return {
          status: 'healthy',
          message: 'ML service operational',
          duration,
          metadata: {
            models: status.models,
            version: status.version,
          },
        };
      } else {
        return {
          status: 'degraded',
          message: `ML service issues: ${status.issues?.join(', ') || 'Unknown'}`,
          duration,
          metadata: {
            issues: status.issues,
          },
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `ML service check failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Prüft Datenqualität
   */
  private async checkDataQuality(): Promise<
    HealthCheckResult['checks']['dataQuality']
  > {
    const startTime = Date.now();

    try {
      const stats = await this.dataIngestion.getDataStatistics();
      const duration = Date.now() - startTime;

      // Datenqualitäts-Metriken
      const dataAge = stats.newestData
        ? (Date.now() - stats.newestData.getTime()) / (1000 * 60 * 60) // Stunden
        : Infinity;

      const hasRecentData = dataAge < 24; // Weniger als 24 Stunden alt
      const hasSufficientData = stats.totalDataPoints > 1000;
      const hasActiveStocks = stats.activeStocks > 0;

      if (hasRecentData && hasSufficientData && hasActiveStocks) {
        return {
          status: 'healthy',
          message: 'Data quality is good',
          duration,
          metadata: {
            totalStocks: stats.totalStocks,
            activeStocks: stats.activeStocks,
            totalDataPoints: stats.totalDataPoints,
            dataAgeHours: Math.round(dataAge),
            oldestData: stats.oldestData,
            newestData: stats.newestData,
          },
        };
      } else {
        const issues = [];
        if (!hasRecentData) issues.push('Data is stale');
        if (!hasSufficientData) issues.push('Insufficient data points');
        if (!hasActiveStocks) issues.push('No active stocks');

        return {
          status: 'degraded',
          message: `Data quality issues: ${issues.join(', ')}`,
          duration,
          metadata: {
            issues,
            totalStocks: stats.totalStocks,
            activeStocks: stats.activeStocks,
            totalDataPoints: stats.totalDataPoints,
            dataAgeHours: Math.round(dataAge),
          },
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `Data quality check failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Prüft System-Ressourcen
   */
  private async checkSystemResources(): Promise<
    HealthCheckResult['checks']['systemResources']
  > {
    const startTime = Date.now();

    try {
      const usage = process.memoryUsage();
      const memoryUsageMB = Math.round(usage.heapUsed / 1024 / 1024);
      const memoryLimitMB = Math.round(usage.heapTotal / 1024 / 1024);
      const memoryUsagePercent = Math.round(
        (memoryUsageMB / memoryLimitMB) * 100,
      );

      const uptime = process.uptime();
      const duration = Date.now() - startTime;

      // Ressourcen-Schwellenwerte
      const memoryThreshold = 80; // 80% Speicherverbrauch
      const uptimeThreshold = 3600; // 1 Stunde

      if (memoryUsagePercent < memoryThreshold && uptime > uptimeThreshold) {
        return {
          status: 'healthy',
          message: 'System resources are healthy',
          duration,
          metadata: {
            memoryUsageMB,
            memoryLimitMB,
            memoryUsagePercent,
            uptimeSeconds: Math.round(uptime),
            nodeVersion: process.version,
            platform: process.platform,
          },
        };
      } else {
        const issues = [];
        if (memoryUsagePercent >= memoryThreshold) {
          issues.push(`High memory usage: ${memoryUsagePercent}%`);
        }
        if (uptime < uptimeThreshold) {
          issues.push('Recent restart detected');
        }

        return {
          status: 'degraded',
          message: `Resource issues: ${issues.join(', ')}`,
          duration,
          metadata: {
            issues,
            memoryUsageMB,
            memoryLimitMB,
            memoryUsagePercent,
            uptimeSeconds: Math.round(uptime),
          },
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `System resources check failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Prüft Fehlerrate
   */
  private async checkErrorRate(): Promise<
    HealthCheckResult['checks']['errorRate']
  > {
    const startTime = Date.now();

    try {
      const errorStats = this.errorHandling.getErrorStatistics(1); // Letzte Stunde
      const duration = Date.now() - startTime;

      const totalErrors = errorStats.total;
      const criticalErrors = errorStats.bySeverity.critical || 0;
      const highErrors = errorStats.bySeverity.high || 0;

      // Fehler-Schwellenwerte
      const maxTotalErrors = 100;
      const maxCriticalErrors = 5;
      const maxHighErrors = 20;

      if (
        totalErrors <= maxTotalErrors &&
        criticalErrors <= maxCriticalErrors &&
        highErrors <= maxHighErrors
      ) {
        return {
          status: 'healthy',
          message: `Error rate is acceptable (${totalErrors} errors in last hour)`,
          duration,
          metadata: {
            totalErrors,
            criticalErrors,
            highErrors,
            handledErrors: errorStats.handled,
            unhandledErrors: errorStats.unhandled,
            byComponent: errorStats.byComponent,
          },
        };
      } else {
        const issues = [];
        if (totalErrors > maxTotalErrors)
          issues.push(`High total error rate: ${totalErrors}`);
        if (criticalErrors > maxCriticalErrors)
          issues.push(`Critical errors: ${criticalErrors}`);
        if (highErrors > maxHighErrors)
          issues.push(`High severity errors: ${highErrors}`);

        return {
          status: 'degraded',
          message: `Error rate issues: ${issues.join(', ')}`,
          duration,
          metadata: {
            issues,
            totalErrors,
            criticalErrors,
            highErrors,
            handledErrors: errorStats.handled,
            unhandledErrors: errorStats.unhandled,
          },
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: `Error rate check failed: ${(error as Error).message}`,
        duration,
      };
    }
  }

  /**
   * Bestimmt den Gesamtstatus basierend auf allen Checks
   */
  private determineOverallStatus(
    checks: HealthCheckResult['checks'],
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const checkValues = Object.values(checks);

    if (checkValues.some(check => check?.status === 'unhealthy')) {
      return 'unhealthy';
    }

    if (checkValues.some(check => check?.status === 'degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Schneller Health Check für Load Balancer
   */
  async quickHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
  }> {
    try {
      // Nur kritische Checks
      const dbCheck = await this.checkDatabase();

      if (dbCheck && dbCheck.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
        };
      }

      return {
        status: 'healthy',
        message: 'Service is operational',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
      };
    }
  }
}
