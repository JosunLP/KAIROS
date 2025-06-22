import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  trackedStocks: number;
  totalDataPoints: number;
  lastDataUpdate: Date | null;
  mlModelStatus: 'IDLE' | 'TRAINING' | 'PREDICTING' | 'ERROR';
  portfolioCount: number;
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  activeConnections: number;
  errorRate: number; // Errors per hour
}

export interface SystemAlert {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  component: string;
  timestamp: Date;
  acknowledged: boolean;
  details?: any;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  requestsPerMinute: number;
  dbConnectionTime: number;
  mlInferenceTime: number;
  dataIngestionRate: number;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private startTime: Date = new Date();
  private alerts: SystemAlert[] = [];
  private performanceHistory: PerformanceMetrics[] = [];
  private errorCount = 0;
  private requestCount = 0;

  constructor(private readonly prisma: PrismaService) {
    // Starte Monitoring-Intervall
    this.startPerformanceMonitoring();
  }

  /**
   * Sammelt aktuelle System-Metriken
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = Date.now() - this.startTime.getTime();

      // Datenbankmetriken abrufen
      const [stockCount, dataPointCount, lastDataPoint] = await Promise.all([
        this.prisma.stock.count(),
        this.prisma.historicalData.count(),
        this.prisma.historicalData.findFirst({
          orderBy: { timestamp: 'desc' },
        }),
      ]);

      // Portfolio-Anzahl simulieren (da wir In-Memory verwenden)
      const portfolioCount = 0; // Wird von PortfolioService verwaltet

      // System-Health bewerten
      const systemHealth = this.assessSystemHealth(
        memoryUsage,
        this.errorCount,
      );

      // Fehlerrate berechnen (Fehler pro Stunde)
      const errorRate = this.calculateErrorRate();

      return {
        uptime,
        memoryUsage,
        trackedStocks: stockCount,
        totalDataPoints: dataPointCount,
        lastDataUpdate: lastDataPoint?.timestamp || null,
        mlModelStatus: 'IDLE', // Würde von ML-Service geholt
        portfolioCount,
        systemHealth,
        activeConnections: 1, // Vereinfacht
        errorRate,
      };
    } catch (error) {
      this.logger.error('Fehler beim Sammeln der System-Metriken:', error);
      this.recordError('MONITORING', 'Fehler beim Sammeln der Metriken');
      throw error;
    }
  }

  /**
   * Erstellt einen System-Alert
   */
  createAlert(
    type: SystemAlert['type'],
    message: string,
    component: string,
    details?: any,
  ): SystemAlert {
    const alert: SystemAlert = {
      id: this.generateAlertId(),
      type,
      message,
      component,
      timestamp: new Date(),
      acknowledged: false,
      details,
    };

    this.alerts.unshift(alert);

    // Begrenze Alert-Anzahl
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    // Log Alert
    const logMethod =
      type === 'CRITICAL' || type === 'ERROR'
        ? 'error'
        : type === 'WARNING'
          ? 'warn'
          : 'log';
    this.logger[logMethod](`[${component}] ${message}`, details);

    return alert;
  }

  /**
   * Holt alle aktiven Alerts
   */
  getActiveAlerts(): SystemAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Bestätigt einen Alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.log(`Alert bestätigt: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Zeichnet einen Fehler auf
   */
  recordError(component: string, message: string, details?: any): void {
    this.errorCount++;
    this.createAlert('ERROR', message, component, details);
  }

  /**
   * Zeichnet eine Performance-Metrik auf
   */
  recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceHistory.unshift(metric);

    // Begrenze History
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(0, 1000);
    }
  }

  /**
   * Holt Performance-Metriken der letzten Zeit
   */
  getPerformanceMetrics(lastMinutes: number = 60): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - lastMinutes * 60 * 1000);
    return this.performanceHistory.filter(
      metric => metric && new Date() >= cutoff,
    );
  }

  /**
   * Bewertet die System-Gesundheit
   */
  private assessSystemHealth(
    memoryUsage: NodeJS.MemoryUsage,
    errorCount: number,
  ): SystemMetrics['systemHealth'] {
    // Memory-Nutzung prüfen (über 90% = Critical, über 70% = Warning)
    const memoryUsagePercent =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > 90 || errorCount > 10) {
      return 'CRITICAL';
    } else if (memoryUsagePercent > 70 || errorCount > 5) {
      return 'WARNING';
    }

    return 'HEALTHY';
  }

  /**
   * Berechnet die Fehlerrate pro Stunde
   */
  private calculateErrorRate(): number {
    const hoursRunning =
      (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60);
    return hoursRunning > 0 ? this.errorCount / hoursRunning : 0;
  }

  /**
   * Startet kontinuierliches Performance-Monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.recordPerformanceMetric(metrics);

        // System-Health-Checks
        await this.performHealthChecks();
      } catch (error) {
        this.logger.error('Fehler beim Performance-Monitoring:', error);
      }
    }, 60000); // Jede Minute
  }

  /**
   * Sammelt aktuelle Performance-Metriken
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      // Einfache DB-Verbindungstest
      await this.prisma.$queryRaw`SELECT 1`;
      const dbConnectionTime = Date.now() - startTime;

      return {
        avgResponseTime: 0, // Würde von Request-Handler verfolgt
        requestsPerMinute: this.requestCount,
        dbConnectionTime,
        mlInferenceTime: 0, // Würde von ML-Service verfolgt
        dataIngestionRate: 0, // Würde von Data-Ingestion-Service verfolgt
      };
    } catch (error) {
      this.recordError('DATABASE', 'DB-Verbindungsfehler', error);
      throw error;
    }
  }

  /**
   * Führt Gesundheitsprüfungen durch
   */
  private async performHealthChecks(): Promise<void> {
    // Memory-Check
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > 80) {
      this.createAlert(
        'WARNING',
        `Hohe Speichernutzung: ${memoryUsagePercent.toFixed(1)}%`,
        'SYSTEM',
      );
    }

    // Fehlerrate-Check
    const errorRate = this.calculateErrorRate();
    if (errorRate > 5) {
      this.createAlert(
        'WARNING',
        `Hohe Fehlerrate: ${errorRate.toFixed(1)} Fehler/Stunde`,
        'SYSTEM',
      );
    }

    // Weitere Health-Checks...
  }

  /**
   * Generiert eine eindeutige Alert-ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Exportiert System-Diagnose
   */
  async exportDiagnostics(): Promise<any> {
    try {
      const metrics = await this.getSystemMetrics();
      const recentAlerts = this.alerts.slice(0, 20);
      const recentPerformance = this.getPerformanceMetrics(60);

      return {
        timestamp: new Date(),
        systemMetrics: metrics,
        recentAlerts,
        recentPerformance,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          pid: process.pid,
        },
      };
    } catch (error) {
      this.logger.error('Fehler beim Exportieren der Diagnose:', error);
      throw error;
    }
  }
}
