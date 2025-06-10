import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../common/notification.service';
import { ConfigService } from '../config/config.service';

export interface CronJobMetrics {
  jobName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'success' | 'failed';
  error?: string;
  consecutiveFailures: number;
  lastRunTime?: Date;
  nextRunTime?: Date;
}

@Injectable()
export class CronMonitoringService {
  private readonly logger = new Logger(CronMonitoringService.name);
  private readonly jobMetrics = new Map<string, CronJobMetrics>();
  private readonly jobHistory = new Map<string, CronJobMetrics[]>();

  constructor(
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Startet die Überwachung eines Cron Jobs
   */
  startJob(jobName: string): void {
    if (!this.configService.enableCronMonitoring) {
      return;
    }

    const metrics: CronJobMetrics = {
      jobName,
      startTime: new Date(),
      status: 'running',
      consecutiveFailures: this.getConsecutiveFailures(jobName),
    };

    this.jobMetrics.set(jobName, metrics);
    this.logger.log(`🔄 Cron Job gestartet: ${jobName}`);
  }

  /**
   * Beendet die Überwachung eines Cron Jobs erfolgreich
   */
  completeJob(jobName: string, details?: any): void {
    if (!this.configService.enableCronMonitoring) {
      return;
    }

    const metrics = this.jobMetrics.get(jobName);
    if (!metrics) {
      this.logger.warn(`Keine Metriken für Job ${jobName} gefunden`);
      return;
    }

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.status = 'success';
    metrics.consecutiveFailures = 0;
    metrics.lastRunTime = new Date();

    this.saveJobHistory(jobName, { ...metrics });
    this.jobMetrics.delete(jobName);

    this.logger.log(
      `✅ Cron Job erfolgreich beendet: ${jobName} (${metrics.duration}ms)`,
    );

    // Performance-Warnung bei langen Laufzeiten
    if (metrics.duration > this.configService.cronJobTimeout) {
      this.logger.warn(
        `⚠️  Job ${jobName} lief länger als erwartet: ${metrics.duration}ms`,
      );
    }
  }

  /**
   * Markiert einen Cron Job als fehlgeschlagen
   */
  failJob(jobName: string, error: Error | string): void {
    if (!this.configService.enableCronMonitoring) {
      return;
    }

    const metrics = this.jobMetrics.get(jobName);
    if (!metrics) {
      this.logger.warn(`Keine Metriken für Job ${jobName} gefunden`);
      return;
    }

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.status = 'failed';
    metrics.error = error instanceof Error ? error.message : error;
    metrics.consecutiveFailures = this.getConsecutiveFailures(jobName) + 1;

    this.saveJobHistory(jobName, { ...metrics });
    this.jobMetrics.delete(jobName);

    this.logger.error(
      `❌ Cron Job fehlgeschlagen: ${jobName} - ${metrics.error}`,
    );

    // Benachrichtigung bei kritischen Fehlern
    this.handleJobFailure(jobName, metrics);
  }

  /**
   * Behandelt Job-Fehler und sendet Benachrichtigungen
   */
  private async handleJobFailure(jobName: string, metrics: CronJobMetrics): Promise<void> {
    const threshold = this.configService.cronFailureThreshold;
    
    if (metrics.consecutiveFailures >= threshold) {
      const message = `🚨 KRITISCH: Cron Job "${jobName}" ist ${metrics.consecutiveFailures} mal hintereinander fehlgeschlagen.\n\nLetzter Fehler: ${metrics.error}\nZeit: ${metrics.endTime}`;
      
      if (this.configService.enableCronNotifications) {
        try {
          await this.notificationService.sendAlert(
            'Kritischer Cron Job Fehler',
            message,
            'high'
          );
        } catch (error) {
          this.logger.error('Fehler beim Senden der Benachrichtigung:', error);
        }
      }
      
      this.logger.error(`🚨 KRITISCH: ${message}`);
    }
  }

  /**
   * Ruft die Anzahl aufeinanderfolgender Fehler ab
   */
  private getConsecutiveFailures(jobName: string): number {
    const history = this.jobHistory.get(jobName) || [];
    let failures = 0;
    
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].status === 'failed') {
        failures++;
      } else {
        break;
      }
    }
    
    return failures;
  }

  /**
   * Speichert Job-Historie (begrenzt auf die letzten 100 Einträge)
   */
  private saveJobHistory(jobName: string, metrics: CronJobMetrics): void {
    const history = this.jobHistory.get(jobName) || [];
    history.push(metrics);
    
    // Begrenzt die Historie auf die letzten 100 Einträge
    if (history.length > 100) {
      history.shift();
    }
    
    this.jobHistory.set(jobName, history);
  }

  /**
   * Ruft Metriken für einen Job ab
   */
  getJobMetrics(jobName: string): CronJobMetrics | undefined {
    return this.jobMetrics.get(jobName);
  }

  /**
   * Ruft die Historie für einen Job ab
   */
  getJobHistory(jobName: string): CronJobMetrics[] {
    return this.jobHistory.get(jobName) || [];
  }

  /**
   * Ruft alle aktuellen Job-Metriken ab
   */
  getAllJobMetrics(): Map<string, CronJobMetrics> {
    return new Map(this.jobMetrics);
  }

  /**
   * Ruft Statistiken für alle Jobs ab
   */  getJobStatistics(): any {
    const stats = {
      totalJobs: this.jobHistory.size,
      runningJobs: this.jobMetrics.size,
      jobSummary: {} as Record<string, any>,
    };

    for (const [jobName, history] of this.jobHistory.entries()) {
      const recentRuns = history.slice(-10);
      const successRate = recentRuns.filter(r => r.status === 'success').length / recentRuns.length * 100;
      const avgDuration = recentRuns.reduce((sum, r) => sum + (r.duration || 0), 0) / recentRuns.length;
      const lastRun = history[history.length - 1];

      stats.jobSummary[jobName] = {
        totalRuns: history.length,
        successRate: Math.round(successRate),
        avgDuration: Math.round(avgDuration),
        lastRun: lastRun?.lastRunTime,
        lastStatus: lastRun?.status,
        consecutiveFailures: this.getConsecutiveFailures(jobName),
      };
    }

    return stats;
  }

  /**
   * Überprüft ob Jobs überfällig sind
   */
  checkOverdueJobs(): void {
    const now = new Date();
    const timeout = this.configService.cronJobTimeout;

    for (const [jobName, metrics] of this.jobMetrics.entries()) {
      const runtime = now.getTime() - metrics.startTime.getTime();
      
      if (runtime > timeout) {
        this.logger.warn(
          `⚠️  Job ${jobName} läuft bereits ${Math.round(runtime / 1000)}s (Timeout: ${Math.round(timeout / 1000)}s)`
        );
      }
    }
  }
}
