import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "../config/config.service";
import { DataIngestionService } from "../data-ingestion/data-ingestion.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import { MlPredictionService } from "../ml-prediction/ml-prediction.service";
import { PrismaService } from "../persistence/prisma.service";
import { CronMonitoringService } from "./cron-monitoring.service";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly dataIngestion: DataIngestionService,
    private readonly analysisEngine: AnalysisEngineService,
    private readonly mlPrediction: MlPredictionService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cronMonitoring: CronMonitoringService,
  ) {}

  /**
   * Holt aktuelle Marktdaten alle 15 Minuten (während Handelszeiten)
   */
  @Cron('*/15 * * * *', {
    name: "fetchLatestData",
    timeZone: "Europe/Berlin",
  })
  async handleDataIngestion() {
    const jobName = 'data-ingestion';
    this.cronMonitoring.startJob(jobName);

    try {
      if (!this.isMarketHours()) {
        this.logger.debug(
          "Außerhalb der Handelszeiten - Datenerfassung übersprungen",
        );
        this.cronMonitoring.completeJob(jobName, { skipped: true, reason: 'outside-market-hours' });
        return;
      }

      this.logger.log("Starte geplante Datenerfassung");
      await this.dataIngestion.fetchLatestDataForAllTrackedStocks();
      
      this.cronMonitoring.completeJob(jobName, { processed: true });
      this.logger.log("Geplante Datenerfassung abgeschlossen");
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei geplanter Datenerfassung", error);
    }
  }

  /**
   * Berechnet technische Indikatoren jede Stunde
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: "calculateIndicators",
    timeZone: "Europe/Berlin",
  })
  async handleTechnicalAnalysis() {
    const jobName = 'technical-analysis';
    this.cronMonitoring.startJob(jobName);

    try {
      this.logger.log("Starte geplante technische Analyse");
      await this.analysisEngine.enrichLatestData();
      
      this.cronMonitoring.completeJob(jobName, { processed: true });
      this.logger.log("Geplante technische Analyse abgeschlossen");
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei geplanter technischer Analyse", error);
    }
  }

  /**
   * Trainiert ML-Modelle täglich um 2 Uhr nachts
   */
  @Cron("0 2 * * *", {
    name: "trainModels",
    timeZone: "Europe/Berlin",
  })
  async handleModelTraining() {
    const jobName = 'ml-training';
    this.cronMonitoring.startJob(jobName);

    try {
      this.logger.log("Starte geplantes ML-Training");
      await this.mlPrediction.trainModel();
      
      this.cronMonitoring.completeJob(jobName, { trained: true });
      this.logger.log("Geplantes ML-Training abgeschlossen");
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei geplantem ML-Training", error);
    }
  }

  /**
   * Validiert Vorhersagen täglich um 3 Uhr nachts
   */
  @Cron("0 3 * * *", {
    name: "validatePredictions",
    timeZone: "Europe/Berlin",
  })
  async handlePredictionValidation() {
    const jobName = 'prediction-validation';
    this.cronMonitoring.startJob(jobName);

    try {
      this.logger.log("Starte geplante Vorhersage-Validierung");
      await this.mlPrediction.validatePredictions();
      
      this.cronMonitoring.completeJob(jobName, { validated: true });
      this.logger.log("Geplante Vorhersage-Validierung abgeschlossen");
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei geplanter Vorhersage-Validierung", error);
    }
  }

  /**
   * Bereinigt alte Daten wöchentlich sonntags um 4 Uhr
   */
  @Cron("0 4 * * 0", {
    name: "cleanupOldData",
    timeZone: "Europe/Berlin",
  })
  async handleDataCleanup() {
    const jobName = 'data-cleanup';
    this.cronMonitoring.startJob(jobName);

    try {
      this.logger.log("Starte geplante Datenbereinigung");

      const retentionDays = 365; // Standardwert, kann später über ConfigService konfiguriert werden
      await this.prisma.cleanupOldData(retentionDays);

      this.cronMonitoring.completeJob(jobName, { retentionDays, cleaned: true });
      this.logger.log("Geplante Datenbereinigung abgeschlossen");
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei geplanter Datenbereinigung", error);
    }
  }

  /**
   * Erstellt täglich um 6 Uhr Vorhersagen für alle Aktien
   */
  @Cron("0 6 * * *", {
    name: "generateDailyPredictions",
    timeZone: "Europe/Berlin",
  })
  async handleDailyPredictions() {
    const jobName = 'daily-predictions';
    this.cronMonitoring.startJob(jobName);

    try {
      this.logger.log("Starte tägliche Vorhersage-Generierung");

      const activeStocks = await this.prisma.stock.findMany({
        where: { isActive: true },
      });

      let processedCount = 0;
      for (const stock of activeStocks) {
        try {
          await this.mlPrediction.predictNext(stock.ticker);
          processedCount++;
        } catch (error) {
          this.logger.error(`Fehler bei Vorhersage für ${stock.ticker}`, error);
        }
      }

      this.cronMonitoring.completeJob(jobName, { processedStocks: processedCount, totalStocks: activeStocks.length });
      this.logger.log(`Tägliche Vorhersage-Generierung abgeschlossen (${processedCount}/${activeStocks.length} erfolgreich)`);
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei täglicher Vorhersage-Generierung", error);
    }
  }

  /**
   * Führt eine Integritätsprüfung der Datenbank täglich um 1 Uhr durch
   */
  @Cron("0 1 * * *", {
    name: "databaseIntegrityCheck",
    timeZone: "Europe/Berlin",
  })
  async handleDatabaseIntegrityCheck() {
    const jobName = 'data-integrity';
    this.cronMonitoring.startJob(jobName);

    try {
      this.logger.log("Starte Datenbank-Integritätsprüfung");

      const isHealthy = await this.prisma.checkIntegrity();

      if (isHealthy) {
        this.cronMonitoring.completeJob(jobName, { healthy: true });
        this.logger.log("Datenbank-Integritätsprüfung erfolgreich");
      } else {
        this.cronMonitoring.completeJob(jobName, { healthy: false, warning: true });
        this.logger.warn("Datenbank-Integritätsprobleme erkannt");
      }
    } catch (error) {
      this.cronMonitoring.failJob(jobName, error as Error);
      this.logger.error("Fehler bei Datenbank-Integritätsprüfung", error);
    }
  }

  /**
   * Überwacht überfällige Cron Jobs alle 10 Minuten
   */
  @Cron("*/10 * * * *", {
    name: "monitorCronJobs",
    timeZone: "Europe/Berlin",
  })
  async handleCronJobMonitoring() {
    try {
      this.cronMonitoring.checkOverdueJobs();
    } catch (error) {
      this.logger.error("Fehler bei Cron Job Überwachung", error);
    }
  }

  /**
   * Ruft Cron Job Statistiken ab
   */
  getCronJobStatistics() {
    return this.cronMonitoring.getJobStatistics();
  }

  /**
   * Ruft Cron Job Metriken für einen spezifischen Job ab
   */
  getCronJobMetrics(jobName: string) {
    return this.cronMonitoring.getJobMetrics(jobName);
  }

  /**
   * Ruft die Historie eines Cron Jobs ab
   */
  getCronJobHistory(jobName: string) {
    return this.cronMonitoring.getJobHistory(jobName);
  }

  /**
   * Prüft ob aktuell Handelszeiten sind (vereinfacht)
   */
  private isMarketHours(): boolean {
    const now = new Date();
    const berlinTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }),
    );

    const hour = berlinTime.getHours();
    const day = berlinTime.getDay(); // 0 = Sonntag, 6 = Samstag

    // Wochenende
    if (day === 0 || day === 6) {
      return false;
    }

    // Handelszeiten: 9:00 - 17:30 (vereinfacht)
    return hour >= 9 && hour < 18;
  }

  /**
   * Gibt den Status aller geplanten Tasks zurück
   */
  async getTaskStatus(): Promise<any> {
    try {
      const stats = await this.dataIngestion.getDataStatistics();

      // Hole neueste Training-Logs
      const recentTraining = await this.prisma.trainingLog.findFirst({
        orderBy: { timestamp: "desc" },
      });

      // Hole neueste Vorhersagen
      const recentPredictions = await this.prisma.prediction.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Letzten 24h
          },
        },
      });

      return {
        dataIngestion: {
          totalStocks: stats.totalStocks,
          totalDataPoints: stats.totalDataPoints,
          oldestData: stats.oldestData,
          newestData: stats.newestData,
          availableProviders: stats.availableProviders,
        },
        training: {
          lastTraining: recentTraining?.timestamp,
          lastTrainingStatus: recentTraining?.status,
          lastTrainingLoss: recentTraining?.loss,
        },
        predictions: {
          predictionsLast24h: recentPredictions,
        },
        scheduling: {
          isMarketHours: this.isMarketHours(),
          currentTime: new Date(),
        },
      };
    } catch (error) {
      this.logger.error("Fehler beim Abrufen des Task-Status", error);
      throw error;
    }
  }

  /**
   * Führt eine einmalige Initialisierung neuer Standard-Aktien durch
   */
  async initializeDefaultStocks(): Promise<void> {
    try {
      const defaultTickers = "AAPL,GOOGL,MSFT,AMZN,TSLA"
        .split(",")
        .map((ticker: string) => ticker.trim());

      this.logger.log(
        `Initialisiere Standard-Aktien: ${defaultTickers.join(", ")}`,
      );

      for (const ticker of defaultTickers) {
        try {
          await this.dataIngestion.addStockToTracking(ticker);

          // Kurze Pause zwischen den API-Aufrufen
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          this.logger.error(
            `Fehler bei der Initialisierung von ${ticker}`,
            error,
          );
        }
      }

      this.logger.log("Standard-Aktien-Initialisierung abgeschlossen");
    } catch (error) {
      this.logger.error(
        "Fehler bei der Standard-Aktien-Initialisierung",
        error,
      );
      throw error;
    }
  }
}
