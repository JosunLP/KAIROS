import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataIngestionService } from '../data-ingestion/data-ingestion.service';
import { AnalysisEngineService } from '../analysis-engine/analysis-engine.service';
import { MlPredictionService } from '../ml-prediction/ml-prediction.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { RiskManagementService } from '../portfolio/risk-management.service';
import { BacktestService } from '../portfolio/backtest.service';
import { TasksService } from '../scheduling/tasks.service';
import { PrismaService } from '../persistence/prisma.service';
import { CacheService } from '../common/cache.service';
import { MonitoringService } from '../common/monitoring.service';
import { NotificationService } from '../common/notification.service';

export interface AutomationConfig {
  enabled: boolean;
  dataIngestionIntervalMs: number;
  analysisIntervalMs: number;
  predictionIntervalMs: number;
  portfolioRebalanceIntervalMs: number;
  riskCheckIntervalMs: number;
  healthCheckIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  stopOnCriticalError: boolean;
  notifications: {
    enabled: boolean;
    errorThreshold: number;
    successSummaryInterval: number;
  };
}

export interface AutomationStatus {
  isRunning: boolean;
  startTime?: Date;
  lastActivity?: Date;
  successfulCycles: number;
  failedCycles: number;
  currentCycle: number;
  components: {
    dataIngestion: {
      status: 'active' | 'idle' | 'error';
      lastRun?: Date;
      errors: number;
    };
    analysis: {
      status: 'active' | 'idle' | 'error';
      lastRun?: Date;
      errors: number;
    };
    prediction: {
      status: 'active' | 'idle' | 'error';
      lastRun?: Date;
      errors: number;
    };
    portfolio: {
      status: 'active' | 'idle' | 'error';
      lastRun?: Date;
      errors: number;
    };
    riskManagement: {
      status: 'active' | 'idle' | 'error';
      lastRun?: Date;
      errors: number;
    };
  };
  errors: string[];
  performance: {
    averageCycleTimeMs: number;
    lastCycleTimeMs: number;
    memoryUsageMB: number;
    cpuUsagePercent: number;
  };
}

@Injectable()
export class AutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationService.name);
  private isRunning = false;
  private shouldStop = false;
  private automationLoop?: NodeJS.Timeout;
  private config!: AutomationConfig;
  private status!: AutomationStatus;
  private retryCount = 0;

  // Intervall-Timers für verschiedene Komponenten
  private dataIngestionTimer?: NodeJS.Timeout;
  private analysisTimer?: NodeJS.Timeout;
  private predictionTimer?: NodeJS.Timeout;
  private portfolioTimer?: NodeJS.Timeout;
  private riskTimer?: NodeJS.Timeout;
  private healthTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataIngestionService: DataIngestionService,
    private readonly analysisEngineService: AnalysisEngineService,
    private readonly mlPredictionService: MlPredictionService,
    private readonly portfolioService: PortfolioService,
    private readonly riskManagementService: RiskManagementService,
    private readonly backtestService: BacktestService,
    private readonly tasksService: TasksService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly monitoringService: MonitoringService,
    private readonly notificationService: NotificationService,
  ) {
    this.initializeConfig();
    this.initializeStatus();
  }

  async onModuleInit() {
    this.logger.log('🤖 Automation Service initialisiert');

    // Auto-Start wenn in Konfiguration aktiviert
    if (this.config.enabled) {
      this.logger.log('⚡ Auto-Start aktiviert - Vollautomatik wird gestartet');
      await this.startAutomation();
    }
  }

  async onModuleDestroy() {
    await this.stopAutomation();
  }

  private initializeConfig() {
    this.config = {
      enabled: this.configService.get<boolean>('AUTOMATION_ENABLED', false),
      dataIngestionIntervalMs: this.configService.get<number>(
        'AUTOMATION_DATA_INTERVAL_MS',
        5 * 60 * 1000,
      ), // 5 Min
      analysisIntervalMs: this.configService.get<number>(
        'AUTOMATION_ANALYSIS_INTERVAL_MS',
        15 * 60 * 1000,
      ), // 15 Min
      predictionIntervalMs: this.configService.get<number>(
        'AUTOMATION_PREDICTION_INTERVAL_MS',
        30 * 60 * 1000,
      ), // 30 Min
      portfolioRebalanceIntervalMs: this.configService.get<number>(
        'AUTOMATION_PORTFOLIO_INTERVAL_MS',
        60 * 60 * 1000,
      ), // 1 Std
      riskCheckIntervalMs: this.configService.get<number>(
        'AUTOMATION_RISK_INTERVAL_MS',
        10 * 60 * 1000,
      ), // 10 Min
      healthCheckIntervalMs: this.configService.get<number>(
        'AUTOMATION_HEALTH_INTERVAL_MS',
        2 * 60 * 1000,
      ), // 2 Min
      maxRetries: this.configService.get<number>('AUTOMATION_MAX_RETRIES', 3),
      retryDelayMs: this.configService.get<number>(
        'AUTOMATION_RETRY_DELAY_MS',
        30 * 1000,
      ), // 30 Sec
      stopOnCriticalError: this.configService.get<boolean>(
        'AUTOMATION_STOP_ON_CRITICAL_ERROR',
        true,
      ),
      notifications: {
        enabled: this.configService.get<boolean>(
          'AUTOMATION_NOTIFICATIONS_ENABLED',
          true,
        ),
        errorThreshold: this.configService.get<number>(
          'AUTOMATION_ERROR_THRESHOLD',
          5,
        ),
        successSummaryInterval: this.configService.get<number>(
          'AUTOMATION_SUCCESS_SUMMARY_INTERVAL',
          60 * 60 * 1000,
        ), // 1 Std
      },
    };
  }

  private initializeStatus() {
    this.status = {
      isRunning: false,
      successfulCycles: 0,
      failedCycles: 0,
      currentCycle: 0,
      components: {
        dataIngestion: { status: 'idle', errors: 0 },
        analysis: { status: 'idle', errors: 0 },
        prediction: { status: 'idle', errors: 0 },
        portfolio: { status: 'idle', errors: 0 },
        riskManagement: { status: 'idle', errors: 0 },
      },
      errors: [],
      performance: {
        averageCycleTimeMs: 0,
        lastCycleTimeMs: 0,
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
      },
    };
  }

  /**
   * Startet den Vollautomatik-Modus
   */
  async startAutomation(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Automation läuft bereits');
      return;
    }

    try {
      this.logger.log('🚀 Starte Vollautomatik-Modus');

      this.isRunning = true;
      this.shouldStop = false;
      this.status.isRunning = true;
      this.status.startTime = new Date();
      this.retryCount = 0;

      // System-Health-Check vor Start
      await this.performHealthCheck();

      // Initialisierung der Standard-Aktien falls nötig
      await this.initializeIfNeeded();

      // Starte verschiedene Timer für parallele Ausführung
      this.startDataIngestionTimer();
      this.startAnalysisTimer();
      this.startPredictionTimer();
      this.startPortfolioTimer();
      this.startRiskTimer();
      this.startHealthTimer();

      // Hauptüberwachungsschleife
      this.startMainLoop();

      this.logger.log('✅ Vollautomatik-Modus erfolgreich gestartet');
      if (this.config.notifications.enabled) {
        this.notificationService.info(
          'KAIROS Automation gestartet',
          `Vollautomatik-Modus wurde erfolgreich gestartet um ${new Date().toLocaleString()}`,
          'AUTOMATION',
        );
      }
    } catch (error) {
      this.logger.error('❌ Fehler beim Starten des Automation-Modus', error);
      this.isRunning = false;
      this.status.isRunning = false;
      throw error;
    }
  }

  /**
   * Stoppt den Vollautomatik-Modus
   */
  async stopAutomation(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Automation läuft nicht');
      return;
    }

    this.logger.log('🛑 Stoppe Vollautomatik-Modus');

    this.shouldStop = true;
    this.isRunning = false;
    this.status.isRunning = false;

    // Alle Timer stoppen
    this.clearAllTimers();

    this.logger.log('✅ Vollautomatik-Modus gestoppt');
    if (this.config.notifications.enabled) {
      this.notificationService.info(
        'KAIROS Automation gestoppt',
        `Vollautomatik-Modus wurde gestoppt um ${new Date().toLocaleString()}`,
        'AUTOMATION',
      );
    }
  }

  /**
   * Hauptüberwachungsschleife
   */
  private startMainLoop(): void {
    this.automationLoop = setInterval(async () => {
      if (this.shouldStop) return;
      try {
        await this.performMaintenanceCycle();
        this.status.successfulCycles++;
        this.retryCount = 0; // Reset bei Erfolg
      } catch (error) {
        this.logger.error('Fehler in Hauptschleife', error);
        this.status.failedCycles++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unbekannter Fehler';
        this.status.errors.push(`${new Date().toISOString()}: ${errorMessage}`);

        await this.handleError(error, 'main-loop');
      }

      this.status.currentCycle++;
      this.status.lastActivity = new Date();
    }, 60 * 1000); // Jede Minute
  }

  /**
   * Startet Timer für Datenerfassung
   */
  private startDataIngestionTimer(): void {
    this.dataIngestionTimer = setInterval(async () => {
      if (this.shouldStop) return;
      await this.executeDataIngestion();
    }, this.config.dataIngestionIntervalMs);

    // Sofortige Ausführung
    setTimeout(() => this.executeDataIngestion(), 1000);
  }

  /**
   * Startet Timer für technische Analyse
   */
  private startAnalysisTimer(): void {
    this.analysisTimer = setInterval(async () => {
      if (this.shouldStop) return;
      await this.executeAnalysis();
    }, this.config.analysisIntervalMs);

    // Verzögerte erste Ausführung (nach Datenerfassung)
    setTimeout(() => this.executeAnalysis(), 60 * 1000);
  }

  /**
   * Startet Timer für ML-Vorhersagen
   */
  private startPredictionTimer(): void {
    this.predictionTimer = setInterval(async () => {
      if (this.shouldStop) return;
      await this.executePredictions();
    }, this.config.predictionIntervalMs);

    // Verzögerte erste Ausführung
    setTimeout(() => this.executePredictions(), 2 * 60 * 1000);
  }

  /**
   * Startet Timer für Portfolio-Management
   */
  private startPortfolioTimer(): void {
    this.portfolioTimer = setInterval(async () => {
      if (this.shouldStop) return;
      await this.executePortfolioManagement();
    }, this.config.portfolioRebalanceIntervalMs);

    // Verzögerte erste Ausführung
    setTimeout(() => this.executePortfolioManagement(), 5 * 60 * 1000);
  }

  /**
   * Startet Timer für Risikomanagement
   */
  private startRiskTimer(): void {
    this.riskTimer = setInterval(async () => {
      if (this.shouldStop) return;
      await this.executeRiskManagement();
    }, this.config.riskCheckIntervalMs);

    // Verzögerte erste Ausführung
    setTimeout(() => this.executeRiskManagement(), 3 * 60 * 1000);
  }

  /**
   * Startet Timer für Gesundheitschecks
   */
  private startHealthTimer(): void {
    this.healthTimer = setInterval(async () => {
      if (this.shouldStop) return;
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Führt Datenerfassung aus
   */
  private async executeDataIngestion(): Promise<void> {
    const component = 'dataIngestion';
    this.status.components[component].status = 'active';

    try {
      this.logger.debug('🔄 Führe automatische Datenerfassung aus');

      // Prüfe ob Marktzeiten (delegiere an TasksService)
      const taskStatus = await this.tasksService.getTaskStatus();
      if (!taskStatus.scheduling.isMarketHours) {
        this.logger.debug(
          'Außerhalb Handelszeiten - Datenerfassung übersprungen',
        );
        this.status.components[component].status = 'idle';
        return;
      }

      await this.dataIngestionService.fetchLatestDataForAllTrackedStocks();

      this.status.components[component].status = 'idle';
      this.status.components[component].lastRun = new Date();
      this.logger.debug('✅ Automatische Datenerfassung abgeschlossen');
    } catch (error) {
      this.status.components[component].status = 'error';
      this.status.components[component].errors++;
      await this.handleError(error, component);
    }
  }

  /**
   * Führt technische Analyse aus
   */
  private async executeAnalysis(): Promise<void> {
    const component = 'analysis';
    this.status.components[component].status = 'active';

    try {
      this.logger.debug('📊 Führe automatische technische Analyse aus');

      await this.analysisEngineService.enrichLatestData();

      this.status.components[component].status = 'idle';
      this.status.components[component].lastRun = new Date();
      this.logger.debug('✅ Automatische technische Analyse abgeschlossen');
    } catch (error) {
      this.status.components[component].status = 'error';
      this.status.components[component].errors++;
      await this.handleError(error, component);
    }
  }

  /**
   * Führt ML-Vorhersagen aus
   */
  private async executePredictions(): Promise<void> {
    const component = 'prediction';
    this.status.components[component].status = 'active';

    try {
      this.logger.debug('🔮 Führe automatische Vorhersagen aus');

      const activeStocks = await this.prismaService.stock.findMany({
        where: { isActive: true },
      });

      for (const stock of activeStocks) {
        try {
          await this.mlPredictionService.predictNext(stock.ticker);
          // Kurze Pause zwischen Vorhersagen
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.warn(`Fehler bei Vorhersage für ${stock.ticker}`, error);
        }
      }

      this.status.components[component].status = 'idle';
      this.status.components[component].lastRun = new Date();
      this.logger.debug('✅ Automatische Vorhersagen abgeschlossen');
    } catch (error) {
      this.status.components[component].status = 'error';
      this.status.components[component].errors++;
      await this.handleError(error, component);
    }
  }

  /**
   * Führt Portfolio-Management aus
   */
  private async executePortfolioManagement(): Promise<void> {
    const component = 'portfolio';
    this.status.components[component].status = 'active';

    try {
      this.logger.debug('💼 Führe automatisches Portfolio-Management aus');

      // Hole alle aktiven Portfolios
      const portfolios = await this.portfolioService.getAllPortfolios();
      for (const portfolio of portfolios) {
        try {
          // Portfolio-Metriken aktualisieren
          // await this.portfolioService.updatePortfolioMetrics(portfolio);

          // Basis-Portfolio-Überwachung
          this.logger.debug(`Portfolio ${portfolio.name} überwacht`);
        } catch (error) {
          this.logger.warn(`Fehler bei Portfolio ${portfolio.id}`, error);
        }
      }

      this.status.components[component].status = 'idle';
      this.status.components[component].lastRun = new Date();
      this.logger.debug('✅ Automatisches Portfolio-Management abgeschlossen');
    } catch (error) {
      this.status.components[component].status = 'error';
      this.status.components[component].errors++;
      await this.handleError(error, component);
    }
  }

  /**
   * Führt Risikomanagement aus
   */
  private async executeRiskManagement(): Promise<void> {
    const component = 'riskManagement';
    this.status.components[component].status = 'active';

    try {
      this.logger.debug('⚠️ Führe automatisches Risikomanagement aus');

      // Systemweite Risikoanalyse
      const portfolios = await this.portfolioService.getAllPortfolios();
      for (const portfolio of portfolios) {
        try {
          // Standard Risikolimits definieren (falls nicht vorhanden)
          const defaultRiskLimits = {
            maxPositionSize: 0.1, // 10% maximale Positionsgröße
            maxSectorExposure: 0.3, // 30% maximale Sektorgewichtung
            maxDrawdown: 0.15, // 15% maximaler Drawdown
            minLiquidity: 0.7, // 70% minimale Liquidität
            maxLeverage: 2.0, // 2x maximaler Hebel
            maxCorrelation: 0.8, // 80% maximale Korrelation
            stopLossLevel: 0.08, // 8% Stop-Loss Level
          };

          const riskAssessment =
            await this.riskManagementService.assessPortfolioRisk(
              portfolio,
              defaultRiskLimits,
            );

          // Warnung bei hohem Risiko
          if (
            riskAssessment.riskLevel === 'HIGH' ||
            riskAssessment.riskLevel === 'CRITICAL'
          ) {
            this.logger.warn(
              `${riskAssessment.riskLevel} Risiko in Portfolio ${portfolio.id} erkannt`,
            );

            if (this.config.notifications.enabled) {
              this.notificationService.warning(
                `${riskAssessment.riskLevel} Risiko in Portfolio ${portfolio.name}`,
                `Risiko-Score: ${riskAssessment.riskScore}, Level: ${riskAssessment.riskLevel}`,
                'RISK_MANAGEMENT',
              );
            }
          }
        } catch (error) {
          this.logger.warn(
            `Fehler bei Risikoanalyse für Portfolio ${portfolio.id}`,
            error,
          );
        }
      }

      this.status.components[component].status = 'idle';
      this.status.components[component].lastRun = new Date();
      this.logger.debug('✅ Automatisches Risikomanagement abgeschlossen');
    } catch (error) {
      this.status.components[component].status = 'error';
      this.status.components[component].errors++;
      await this.handleError(error, component);
    }
  }

  /**
   * Führt Gesundheitscheck aus
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // System-Performance messen
      const memoryUsage = process.memoryUsage();
      this.status.performance.memoryUsageMB = Math.round(
        memoryUsage.heapUsed / 1024 / 1024,
      );

      // Datenbank-Check
      await this.prismaService.stock.count();

      // Cache-Status
      // Weitere Health-Checks können hier hinzugefügt werden

      this.logger.debug(
        `💓 System-Health: ${this.status.performance.memoryUsageMB}MB RAM`,
      );
    } catch (error) {
      this.logger.error('Health-Check fehlgeschlagen', error);
      await this.handleError(error, 'health-check');
    }
  }

  /**
   * Wartungszyklus
   */ private async performMaintenanceCycle(): Promise<void> {
    // Cache-Statistiken loggen (falls verfügbar)
    // await this.cacheService.cleanup(); // Private method - nicht direkt aufrufbar

    // Alte Logs bereinigen (behalte nur letzte 100 Fehler)
    if (this.status.errors.length > 100) {
      this.status.errors = this.status.errors.slice(-100);
    }

    // Performance-Statistiken aktualisieren
    await this.updatePerformanceStats();
  }

  /**
   * Initialisierung bei Bedarf
   */
  private async initializeIfNeeded(): Promise<void> {
    try {
      const stockCount = await this.prismaService.stock.count();

      if (stockCount === 0) {
        this.logger.log(
          'Keine Aktien gefunden - initialisiere Standard-Aktien',
        );
        await this.tasksService.initializeDefaultStocks();
      }
    } catch (error) {
      this.logger.error('Fehler bei Initialisierung', error);
    }
  }

  /**
   * Fehlerbehandlung
   */
  private async handleError(error: any, component: string): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unbekannter Fehler';
    this.logger.error(`Fehler in ${component}: ${errorMessage}`, error);

    this.retryCount++;

    // Kritischer Fehler - stoppe Automation
    if (
      this.config.stopOnCriticalError &&
      this.retryCount >= this.config.maxRetries
    ) {
      this.logger.error('Maximale Wiederholungen erreicht - stoppe Automation');

      if (this.config.notifications.enabled) {
        this.notificationService.critical(
          'KAIROS Automation gestoppt',
          `Kritischer Fehler: ${errorMessage}. Automation wurde gestoppt.`,
          'AUTOMATION',
        );
      }

      await this.stopAutomation();
      return;
    }

    // Benachrichtigung bei Fehlern
    if (
      this.config.notifications.enabled &&
      this.status.components[component as keyof typeof this.status.components]
        ?.errors >= this.config.notifications.errorThreshold
    ) {
      this.notificationService.error(
        `Fehler in ${component}`,
        `Wiederholte Fehler aufgetreten: ${errorMessage}`,
        'AUTOMATION',
      );
    }

    // Retry-Delay
    if (this.retryCount < this.config.maxRetries) {
      await new Promise(resolve =>
        setTimeout(resolve, this.config.retryDelayMs),
      );
    }
  }

  /**
   * Performance-Statistiken aktualisieren
   */
  private async updatePerformanceStats(): Promise<void> {
    // Hier könnten detailliertere Performance-Metriken berechnet werden
    this.status.performance.lastCycleTimeMs =
      Date.now() - (this.status.lastActivity?.getTime() || Date.now());
  }

  /**
   * Alle Timer stoppen
   */
  private clearAllTimers(): void {
    if (this.automationLoop) clearInterval(this.automationLoop);
    if (this.dataIngestionTimer) clearInterval(this.dataIngestionTimer);
    if (this.analysisTimer) clearInterval(this.analysisTimer);
    if (this.predictionTimer) clearInterval(this.predictionTimer);
    if (this.portfolioTimer) clearInterval(this.portfolioTimer);
    if (this.riskTimer) clearInterval(this.riskTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
  }

  /**
   * Gibt den aktuellen Status zurück
   */
  getStatus(): AutomationStatus {
    return { ...this.status };
  }

  /**
   * Gibt die aktuelle Konfiguration zurück
   */
  getConfig(): AutomationConfig {
    return { ...this.config };
  }

  /**
   * Aktualisiert die Konfiguration zur Laufzeit
   */
  updateConfig(newConfig: Partial<AutomationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Konfiguration aktualisiert', newConfig);
  }

  /**
   * Prüft ob Automation läuft
   */
  isAutomationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Detaillierter Status-Report
   */
  async getDetailedStatus(): Promise<any> {
    const basicStatus = this.getStatus();
    const taskStatus = await this.tasksService.getTaskStatus();

    return {
      automation: basicStatus,
      tasks: taskStatus,
      config: this.config,
      uptime: basicStatus.startTime
        ? Date.now() - basicStatus.startTime.getTime()
        : 0,
    };
  }
}
