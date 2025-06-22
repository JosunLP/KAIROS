import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';
import { PredictionResult, TrainingStatus } from '../common/types';
import { DataIngestionService } from '../data-ingestion/data-ingestion.service';
import { PrismaService } from '../persistence/prisma.service';
import {
  MLClientService,
  TrainingData as MLTrainingData,
  PredictionRequest,
} from './ml-client.service';

export interface TrainingData {
  features: number[][];
  labels: number[];
}

export interface ModelArchitecture {
  sequenceLength: number;
  featuresCount: number;
  lstmUnits: number[];
  denseUnits: number[];
  dropoutRate: number;
  learningRate: number;
}

export interface TrainingMetrics {
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
  epoch: number;
  timeElapsed: number;
}

export interface PredictionMetrics {
  confidence: number;
  volatility: number;
  trendStrength: number;
  riskScore: number;
}

export interface ExtendedTrainingStatus extends TrainingStatus {
  startTime?: Date;
  currentEpoch?: number;
  totalEpochs?: number;
  shouldStop?: boolean;
}

@Injectable()
export class MlPredictionService {
  private readonly logger = new Logger(MlPredictionService.name);
  private readonly modelDir = path.join(process.cwd(), 'models');
  private models: Map<string, tf.LayersModel> = new Map();
  private trainingStatus: ExtendedTrainingStatus = {
    isTraining: false,
    progress: 0,
    epoch: 0,
    loss: 0,
    accuracy: 0,
    estimatedTimeRemaining: 0,
    status: 'IDLE',
  };
  private trainingAbortController?: AbortController;

  // Enhanced performance metrics
  private performanceMetrics: {
    lastTrainingDuration?: number;
    lastPredictionDuration?: number;
    totalPredictions: number;
    successfulPredictions: number;
    averageConfidence: number;
    modelAccuracy?: number;
    lastTrainingLoss?: number;
    trainingHistory: TrainingMetrics[];
  } = {
    totalPredictions: 0,
    successfulPredictions: 0,
    averageConfidence: 0,
    trainingHistory: [],
  };

  // Enhanced memory management
  private memoryUsageMonitor = {
    tensorCount: 0,
    maxTensorCount: 0,
    memoryUsageMB: 0,
    lastCleanup: Date.now(),
    cleanupThreshold: 100, // MB
  };

  // Model architecture configurations
  private readonly defaultArchitecture: ModelArchitecture = {
    sequenceLength: 30,
    featuresCount: 8, // Erweitert für mehr Features
    lstmUnits: [64, 32],
    denseUnits: [16, 8],
    dropoutRate: 0.2,
    learningRate: 0.001,
  };

  // Training configuration
  private readonly trainingConfig = {
    epochs: parseInt(
      this.configService.get<string>('ML_TRAINING_EPOCHS', '100'),
    ),
    batchSize: parseInt(this.configService.get<string>('ML_BATCH_SIZE', '32')),
    validationSplit: parseFloat(
      this.configService.get<string>('ML_VALIDATION_SPLIT', '0.2'),
    ),
    earlyStoppingPatience: 10,
    minDelta: 0.001,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly dataIngestionService: DataIngestionService,
    private readonly mlClientService: MLClientService,
  ) {
    // Erstelle Model-Verzeichnis falls es nicht existiert
    if (!fs.existsSync(this.modelDir)) {
      fs.mkdirSync(this.modelDir, { recursive: true });
    }
  }

  /**
   * Prüft ob ein trainiertes Modell existiert
   */
  async checkModelExists(): Promise<boolean> {
    try {
      const modelPath = this.getModelPath();
      const fs = await import('fs');
      return fs.existsSync(modelPath);
    } catch (error) {
      this.logger.error('Fehler beim Prüfen des Modells:', error);
      return false;
    }
  }

  /**
   * Trainiert das ML-Modell mit allen verfügbaren Daten
   */
  async trainModel(): Promise<boolean> {
    try {
      this.logger.log('🤖 Starte ML-Modell-Training...');

      // SCHRITT 1: Frische Daten von APIs holen
      await this.fetchFreshDataForTraining();

      // SCHRITT 2: Trainingsdaten sammeln
      const trainingData = await this.prepareTrainingData();

      this.validateTrainingData(trainingData);

      if (trainingData.length < 100) {
        this.logger.warn(
          'Nicht genügend Daten für Training (mindestens 100 benötigt)',
        );
        return false;
      }

      // Modell erstellen und trainieren
      const model = await this.createAndTrainModel(trainingData);

      // Modell speichern
      await this.saveModel(model);

      this.logger.log('✅ ML-Modell erfolgreich trainiert und gespeichert');
      return true;
    } catch (error) {
      this.logger.error('Fehler beim Training:', error);
      return false;
    }
  }

  /**
   * Startet das Training mit erweiterten Kontrollfunktionen
   */
  async startTraining(): Promise<boolean> {
    if (this.trainingStatus.isTraining) {
      this.logger.warn('Training läuft bereits');
      return false;
    }

    try {
      this.trainingStatus = {
        isTraining: true,
        progress: 0,
        epoch: 0,
        loss: 0,
        accuracy: 0,
        estimatedTimeRemaining: 0,
        status: 'TRAINING',
        startTime: new Date(),
        currentEpoch: 0,
        totalEpochs: 100,
        shouldStop: false,
      };

      this.trainingAbortController = new AbortController();

      this.logger.log('🤖 Starte erweiteres ML-Modell-Training...');

      // SCHRITT 1: Frische Daten von APIs holen
      await this.fetchFreshDataForTraining();

      // SCHRITT 2: Trainingsdaten sammeln
      const trainingData = await this.prepareTrainingData();

      this.validateTrainingData(trainingData);

      if (trainingData.length < 100) {
        this.logger.warn(
          'Nicht genügend Daten für Training (mindestens 100 benötigt)',
        );
        this.trainingStatus.isTraining = false;
        return false;
      }

      // Modell erstellen und trainieren mit Abort-Kontrolle
      const model = await this.createAndTrainModelWithControl(trainingData);

      if (!this.trainingStatus.shouldStop && model) {
        // Modell speichern
        await this.saveModel(model);
        this.logger.log('✅ ML-Modell erfolgreich trainiert und gespeichert');
      } else {
        this.logger.log('⚠️ Training wurde abgebrochen');
      }

      this.trainingStatus.isTraining = false;
      return !this.trainingStatus.shouldStop;
    } catch (error) {
      this.logger.error('Fehler beim Training:', error);
      this.trainingStatus.isTraining = false;
      return false;
    }
  }

  /**
   * Stoppt das laufende Training sicher
   */
  async stopTraining(): Promise<boolean> {
    if (!this.trainingStatus.isTraining) {
      this.logger.warn('Kein Training läuft derzeit');
      return false;
    }

    this.logger.log('🛑 Beende Training sicher...');
    this.trainingStatus.shouldStop = true;

    if (this.trainingAbortController) {
      this.trainingAbortController.abort();
    }

    // Warte bis Training beendet ist
    while (this.trainingStatus.isTraining) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.log('✅ Training sicher beendet');
    return true;
  }

  /**
   * Gibt den aktuellen Training-Status zurück
   */
  getTrainingStatus(): ExtendedTrainingStatus {
    return { ...this.trainingStatus };
  }

  /**
   * Erstellt eine Prognose für eine Aktie
   */
  async predictNext(
    ticker: string,
    days: number = 1,
  ): Promise<PredictionResult | null> {
    try {
      this.logger.log(`🔮 Erstelle ${days}-Tage-Prognose für ${ticker}...`);

      // Modell laden
      const model = await this.loadModel();
      if (!model) {
        this.logger.warn('Kein trainiertes Modell verfügbar');
        return null;
      }

      // Aktuelle Daten für Prognose vorbereiten
      const inputData = await this.prepareInputData(ticker);
      if (!inputData) {
        this.logger.warn(`Nicht genügend Daten für Prognose von ${ticker}`);
        return null;
      }

      // Prognose erstellen
      const prediction = await this.makePrediction(
        model,
        inputData,
        days,
        ticker,
      );

      this.logger.log(`✅ Prognose für ${ticker} erstellt`);
      return prediction;
    } catch (error) {
      this.logger.error(`Fehler bei der Prognose für ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Gibt den Pfad für das Modell zurück
   */
  private getModelPath(): string {
    return './models/kairos-model';
  }

  /**
   * Lädt das gespeicherte Modell
   */
  private async loadModel(): Promise<tf.LayersModel | null> {
    try {
      const modelPath = this.getModelPath();
      const exists = await this.checkModelExists();

      if (!exists) {
        return null;
      }

      return await tf.loadLayersModel(`file://${modelPath}/model.json`);
    } catch (error) {
      this.logger.error('Fehler beim Laden des Modells:', error);
      return null;
    }
  }

  /**
   * Speichert das trainierte Modell
   */
  private async saveModel(model: tf.LayersModel): Promise<void> {
    try {
      const modelPath = this.getModelPath();

      // Verzeichnis erstellen falls nicht vorhanden
      const fs = await import('fs');
      if (!fs.existsSync('./models')) {
        fs.mkdirSync('./models', { recursive: true });
      }

      await model.save(`file://${modelPath}`);
      this.logger.log(`Modell gespeichert unter: ${modelPath}`);
    } catch (error) {
      this.logger.error('Fehler beim Speichern des Modells:', error);
      throw error;
    }
  }

  /**
   * Bereitet die Trainingsdaten vor mit verbesserter Validierung
   */
  private async prepareTrainingData(): Promise<any[]> {
    try {
      this.logger.log('📊 Bereite Trainingsdaten vor...');

      const data = await this.prisma.historicalData.findMany({
        where: {
          AND: [
            { sma20: { not: null } },
            { ema50: { not: null } },
            { rsi14: { not: null } },
            { macd: { not: null } },
          ],
        },
        orderBy: { timestamp: 'asc' },
        include: { stock: true },
      });

      if (data.length === 0) {
        throw new Error(
          'Keine Daten mit vollständigen technischen Indikatoren gefunden',
        );
      }

      this.logger.log(`Gefunden: ${data.length} Datenpunkte mit Indikatoren`);

      const transformedData = this.transformDataForTraining(data);

      // Validiere transformierte Daten
      this.validateTrainingData(transformedData);

      this.logger.log(
        `✅ ${transformedData.length} Trainingssequenzen vorbereitet`,
      );
      return transformedData;
    } catch (error) {
      this.logger.error('Fehler beim Vorbereiten der Trainingsdaten:', error);
      throw error;
    }
  }

  /**
   * Transformiert Rohdaten für das Training
   */
  private transformDataForTraining(data: any[]): any[] {
    const sequenceLength = 30; // 30 Tage Eingabe
    const sequences = [];

    for (let i = sequenceLength; i < data.length; i++) {
      const sequence = data.slice(i - sequenceLength, i);
      const target = data[i];

      // Features extrahieren
      const features = sequence.map(item => [
        item.close,
        item.volume,
        item.sma20 || 0,
        item.ema50 || 0,
        item.rsi14 || 0,
        item.macd || 0,
      ]);

      // Ziel: Preis-Richtung (1 für Aufwärts, 0 für Abwärts)
      const previousClose = sequence[sequence.length - 1].close;
      const currentClose = target.close;
      const direction = currentClose > previousClose ? 1 : 0;

      sequences.push({
        input: features,
        output: direction,
        ticker: target.stock.ticker,
        timestamp: target.timestamp,
      });
    }

    return sequences;
  }

  /**
   * Erstellt eine verbesserte LSTM-Modellarchitektur
   */
  private createImprovedModel(
    sequenceLength: number,
    featuresCount: number,
  ): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Erste LSTM-Schicht mit mehr Units und Regularisierung
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: [sequenceLength, featuresCount],
          recurrentDropout: 0.1,
          dropout: 0.1,
        }),
        tf.layers.batchNormalization(),

        // Zweite LSTM-Schicht
        tf.layers.lstm({
          units: 32,
          returnSequences: true,
          recurrentDropout: 0.1,
          dropout: 0.1,
        }),
        tf.layers.batchNormalization(),

        // Dritte LSTM-Schicht
        tf.layers.lstm({
          units: 16,
          returnSequences: false,
          recurrentDropout: 0.1,
          dropout: 0.1,
        }),

        // Dense-Schichten mit Regularisierung
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        }),
        tf.layers.dropout({ rate: 0.3 }),

        tf.layers.dense({
          units: 16,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        }),
        tf.layers.dropout({ rate: 0.2 }),

        // Output-Schicht
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    return model;
  }

  /**
   * Erstellt und trainiert das LSTM-Modell mit verbesserter Architektur
   */
  private async createAndTrainModel(
    trainingData: any[],
  ): Promise<tf.LayersModel> {
    const startTime = Date.now();
    const sequenceLength = 30;
    const featuresCount = 6; // close, volume, sma20, ema50, rsi14, macd

    try {
      // Verwende verbesserte Modellarchitektur
      const model = this.createImprovedModel(sequenceLength, featuresCount);

      // Modell kompilieren mit angepassten Hyperparametern
      model.compile({
        optimizer: tf.train.adam(0.0005), // Niedrigere Learning Rate
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      });

      // Daten für Training vorbereiten
      const inputs = trainingData.map(item => item.input);
      const outputs = trainingData.map(item => item.output);

      const xs = tf.tensor3d(inputs);
      const ys = tf.tensor2d(outputs, [outputs.length, 1]);

      // Training mit Early Stopping und erweiterten Parametern
      await model.fit(xs, ys, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              this.logger.log(
                `Epoche ${epoch}: Loss ${logs?.loss?.toFixed(4)}, Accuracy ${logs?.acc?.toFixed(4)}`,
              );
            }
          },
        },
      });

      // Speicher freigeben
      xs.dispose();
      ys.dispose();

      // Performance-Tracking
      this.performanceMetrics.lastTrainingDuration = Date.now() - startTime;
      this.monitorMemoryUsage();

      return model;
    } catch (error) {
      this.logger.error('Fehler beim Erstellen/Trainieren des Modells:', error);
      throw error;
    }
  }

  /**
   * Erstellt und trainiert das LSTM-Modell mit Abort-Kontrolle
   */
  private async createAndTrainModelWithControl(
    trainingData: any[],
  ): Promise<tf.LayersModel | null> {
    const sequenceLength = 30;
    const featuresCount = 6; // close, volume, sma20, ema50, rsi14, macd

    // Modell-Architektur definieren
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [sequenceLength, featuresCount],
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false,
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 25, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    // Modell kompilieren
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    // Daten für Training vorbereiten
    const inputs = trainingData.map(item => item.input);
    const outputs = trainingData.map(item => item.output);

    const xs = tf.tensor3d(inputs);
    const ys = tf.tensor2d(outputs, [outputs.length, 1]);

    try {
      // Training mit Callback für Status-Updates und Abort-Kontrolle
      await model.fit(xs, ys, {
        epochs: this.trainingStatus.totalEpochs || 100,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0, // Deaktiviere Standard-Logging
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            this.trainingStatus.currentEpoch = epoch + 1;
            this.trainingStatus.loss = logs?.loss || 0;
            this.trainingStatus.accuracy = logs?.acc || 0;

            this.logger.log(
              `📊 Epoche ${epoch + 1}/${this.trainingStatus.totalEpochs} - ` +
                `Loss: ${logs?.loss?.toFixed(4)}, Accuracy: ${logs?.acc?.toFixed(4)}`,
            );

            // Prüfe ob Training abgebrochen werden soll
            if (this.trainingStatus.shouldStop) {
              this.logger.log('🛑 Training wird abgebrochen...');
              throw new Error('Training aborted by user');
            }

            // Kurze Pause um anderen Operationen Zeit zu geben
            await new Promise(resolve => setTimeout(resolve, 10));
          },
        },
      });

      // Cleanup
      xs.dispose();
      ys.dispose();

      return model;
    } catch (error) {
      // Cleanup bei Fehler
      xs.dispose();
      ys.dispose();

      if (
        error instanceof Error &&
        error.message === 'Training aborted by user'
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Holt frische Daten vor dem Training
   */
  private async fetchFreshDataForTraining(): Promise<void> {
    try {
      this.logger.log('📡 Hole frische Daten für Training...');

      // Prüfe ob überwachte Aktien vorhanden sind
      const trackedStocks = await this.prisma.stock.findMany({
        where: { isActive: true },
      });

      if (trackedStocks.length === 0) {
        this.logger.log(
          '⚠️ Keine überwachten Aktien gefunden. Füge Beispiel-Aktien hinzu...',
        );

        // Füge einige Standard-Aktien für Demo-Zwecke hinzu
        const defaultStocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];

        for (const ticker of defaultStocks) {
          if (this.trainingStatus.shouldStop) break;

          try {
            await this.dataIngestionService.addNewStock(ticker);
            this.logger.log(`✅ ${ticker} hinzugefügt`);

            // Kurze Pause zwischen API-Aufrufen
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            this.logger.warn(
              `Fehler beim Hinzufügen von ${ticker}:`,
              error instanceof Error ? error.message : String(error),
            );
            continue;
          }
        }
      } else {
        // Aktualisiere Daten für alle verfolgten Aktien
        this.logger.log(
          `📊 Aktualisiere Daten für ${trackedStocks.length} verfolgte Aktien...`,
        );
        await this.dataIngestionService.fetchLatestDataForAllTrackedStocks();
      }

      this.logger.log('✅ Frische Daten erfolgreich abgerufen');
    } catch (error) {
      this.logger.error('Fehler beim Abrufen frischer Daten:', error);
      throw error;
    }
  }

  /**
   * Bereitet Eingabedaten für eine Prognose vor
   */
  private async prepareInputData(ticker: string): Promise<number[][] | null> {
    try {
      const data = await this.prisma.historicalData.findMany({
        where: {
          stock: { ticker },
          AND: [
            { sma20: { not: null } },
            { ema50: { not: null } },
            { rsi14: { not: null } },
            { macd: { not: null } },
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: 30, // Letzte 30 Datenpunkte
      });

      if (data.length < 30) {
        return null;
      }

      // Reihenfolge umkehren (älteste zuerst)
      data.reverse();

      return data.map(item => [
        item.close,
        Number(item.volume),
        item.sma20 || 0,
        item.ema50 || 0,
        item.rsi14 || 0,
        item.macd || 0,
      ]);
    } catch (error) {
      this.logger.error('Fehler beim Vorbereiten der Eingabedaten:', error);
      return null;
    }
  }
  /**
   * Erstellt eine Prognose mit dem Modell
   */
  private async makePrediction(
    model: tf.LayersModel,
    inputData: number[][],
    days: number,
    ticker: string,
  ): Promise<PredictionResult> {
    try {
      const input = tf.tensor3d([inputData]);
      const prediction = model.predict(input) as tf.Tensor;
      const result = await prediction.data();

      // Speicher freigeben
      input.dispose();
      prediction.dispose();
      const confidence = result[0];
      const direction = confidence > 0.5 ? 1 : -1;
      return {
        symbol: ticker,
        prediction: direction,
        confidence,
        timestamp: new Date(),
        model: 'lstm-v1',
        features: {},
      };
    } catch (error) {
      this.logger.error('Fehler bei der Prognose-Erstellung:', error);
      throw error;
    }
  }

  /**
   * Überwacht Speicherverbrauch und Tensor-Lecks
   */
  private monitorMemoryUsage(): void {
    const currentTensorCount = tf.memory().numTensors;
    this.memoryUsageMonitor.tensorCount = currentTensorCount;

    if (currentTensorCount > this.memoryUsageMonitor.maxTensorCount) {
      this.memoryUsageMonitor.maxTensorCount = currentTensorCount;
    }

    if (currentTensorCount > 1000) {
      this.logger.warn(
        `Hohe Anzahl von Tensoren im Speicher: ${currentTensorCount}`,
      );
    }
  }

  /**
   * Gibt Performance-Metriken zurück
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      memoryUsage: this.memoryUsageMonitor,
      trainingStatus: this.trainingStatus,
    };
  }

  /**
   * Validiert Eingabedaten vor der Verarbeitung
   */
  private validateTrainingData(data: any[]): boolean {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Trainingsdaten sind leer oder ungültig');
    }

    // Prüfe auf konsistente Datenstruktur
    for (const item of data.slice(0, 10)) {
      // Prüfe erste 10 Einträge
      if (
        !item.input ||
        !Array.isArray(item.input) ||
        item.output === undefined
      ) {
        throw new Error('Inkonsistente Datenstruktur in Trainingsdaten');
      }
    }

    return true;
  }

  /**
   * Säubert Speicher von nicht verwendeten Tensoren
   */
  private cleanupMemory(): void {
    const memoryBefore = tf.memory();
    tf.disposeVariables();
    const memoryAfter = tf.memory();

    if (memoryBefore.numTensors !== memoryAfter.numTensors) {
      this.logger.log(
        `Speicher bereinigt: ${memoryBefore.numTensors} → ${memoryAfter.numTensors} Tensoren`,
      );
    }
  }

  /**
   * Validiert gespeicherte Prognosen gegen tatsächliche Marktentwicklung
   */
  async validatePredictions(): Promise<void> {
    this.logger.log('🔍 Beginne Validierung der Prognosen...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Validiere Prognosen der letzten 7 Tage

      // Hole alle Prognosen, die validiert werden können
      const predictions = await this.prisma.prediction.findMany({
        where: {
          targetDate: { lte: new Date() },
          actualPrice: null, // Noch nicht validiert
          timestamp: { gte: cutoffDate },
        },
        include: { stock: true },
      });

      if (predictions.length === 0) {
        this.logger.log('Keine Prognosen zur Validierung gefunden');
        return;
      }

      this.logger.log(`Validiere ${predictions.length} Prognosen...`);

      let correctPredictions = 0;
      let totalValidated = 0;

      for (const prediction of predictions) {
        try {
          // Hole den tatsächlichen Preis zum Zieldatum
          const actualData = await this.prisma.historicalData.findFirst({
            where: {
              stockId: prediction.stockId,
              timestamp: {
                gte: prediction.targetDate,
                lte: new Date(
                  prediction.targetDate.getTime() + 24 * 60 * 60 * 1000,
                ), // +1 Tag
              },
            },
            orderBy: { timestamp: 'asc' },
          });

          if (actualData) {
            // Bestimme tatsächliche Richtung
            const predictedDirection =
              prediction.predictedDirection ||
              (prediction.confidence && prediction.confidence > 0.5
                ? 'UP'
                : 'DOWN');

            let actualDirection = 'NEUTRAL';
            if (prediction.predictedPrice) {
              actualDirection =
                actualData.close > prediction.predictedPrice ? 'UP' : 'DOWN';
            }

            // Aktualisiere die Prognose mit tatsächlichen Daten
            await this.prisma.prediction.update({
              where: { id: prediction.id },
              data: {
                actualPrice: actualData.close,
                actualDirection,
                accuracy: predictedDirection === actualDirection ? 1.0 : 0.0,
              },
            });

            if (predictedDirection === actualDirection) {
              correctPredictions++;
            }
            totalValidated++;
          } else {
            this.logger.warn(
              `Keine aktuellen Daten für ${prediction.stock.ticker} am ${prediction.targetDate.toISOString()}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Fehler bei der Validierung von Prognose ${prediction.id}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      const accuracy =
        totalValidated > 0 ? (correctPredictions / totalValidated) * 100 : 0;

      this.logger.log(
        `✅ Prognose-Validierung abgeschlossen: ${correctPredictions}/${totalValidated} korrekt (${accuracy.toFixed(1)}%)`,
      );

      // Speichere Validierungs-Metriken
      await this.saveValidationMetrics(
        accuracy,
        totalValidated,
        correctPredictions,
      );
    } catch (error) {
      this.logger.error('Fehler bei der Prognose-Validierung:', error);
      throw error;
    }
  }

  /**
   * Speichert Validierungs-Metriken in der Datenbank
   */
  private async saveValidationMetrics(
    accuracy: number,
    totalValidated: number,
    correctPredictions: number,
  ): Promise<void> {
    try {
      await this.prisma.trainingLog.create({
        data: {
          modelVersion: 'validation-metrics',
          status: 'COMPLETED',
          accuracy: accuracy / 100,
          trainingSize: totalValidated,
          features: JSON.stringify({
            correctPredictions,
            totalValidated,
            accuracyPercentage: accuracy,
          }),
        },
      });
    } catch (error) {
      this.logger.error(
        'Fehler beim Speichern der Validierungs-Metriken:',
        error,
      );
    }
  }

  // ==========================================
  // ML Service Integration Methods
  // ==========================================

  /**
   * Trainiert ein Modell mit dem externen ML-Service
   */
  async trainModelWithMLService(
    ticker: string,
    _modelName?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Training Modell für ${ticker} mit ML-Service...`);

      // Prüfe ob ML-Service verfügbar ist
      if (!(await this.mlClientService.isServiceAvailable())) {
        await this.mlClientService.waitForService();
      }

      // Lade Trainingsdaten
      const trainingData = await this.prepareTrainingDataForMLService(ticker);

      const mlTrainingData: MLTrainingData = {
        features: trainingData.features,
        labels: trainingData.labels,
      };

      const result = await this.mlClientService.trainModel(
        ticker,
        mlTrainingData,
      );

      this.logger.log(
        `Modell für ${ticker} erfolgreich trainiert: ${result.status}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Fehler beim Training mit ML-Service für ${ticker}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Macht Vorhersagen mit dem externen ML-Service
   */
  async predictWithMLService(
    ticker: string,
    modelName: string,
    features?: number[],
  ): Promise<PredictionResult> {
    try {
      this.logger.log(`Vorhersage für ${ticker} mit ML-Service...`);

      // Bereite Features vor falls nicht gegeben
      const predictionFeatures =
        features || (await this.prepareFeaturesForPrediction(ticker));

      const request: PredictionRequest = {
        ticker,
        features: predictionFeatures,
        modelName: modelName || `${ticker}_model`,
      };

      const response = await this.mlClientService.predict(request);

      const result: PredictionResult = {
        symbol: ticker,
        prediction: response.prediction,
        confidence: response.confidence || 0.5,
        timestamp: new Date(),
        model: response.model || 'ml-service',
        features: {},
      };

      this.logger.log(
        `Vorhersage für ${ticker} erfolgreich: ${response.prediction}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Fehler bei Vorhersage mit ML-Service für ${ticker}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Listet verfügbare Modelle vom ML-Service auf
   */
  async listAvailableMLModels(): Promise<any> {
    try {
      const models = await this.mlClientService.listModels();
      return {
        models,
        count: models.length,
      };
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der verfügbaren Modelle:', error);
      return { models: [], count: 0 };
    }
  }

  /**
   * Bereitet Trainingsdaten für den ML-Service vor
   */
  private async prepareTrainingDataForMLService(
    ticker: string,
  ): Promise<TrainingData> {
    // Verwende die Prisma-Datenbank direkt
    const data = await this.prisma.historicalData.findMany({
      where: {
        stock: {
          ticker: ticker,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: 200,
    });

    if (data.length < 50) {
      throw new Error(
        `Nicht genügend Daten für ${ticker}: ${data.length} Datenpunkte`,
      );
    }

    const features: number[][] = [];
    const labels: number[] = [];

    // Erstelle Features und Labels
    for (
      let i = this.defaultArchitecture.sequenceLength;
      i < data.length;
      i++
    ) {
      const sequence = data.slice(
        i - this.defaultArchitecture.sequenceLength,
        i,
      );

      // Features: [close, volume, sma20, ema50, rsi14, macd, bollUpper, bollLower]
      const featureRow = sequence
        .map((item: any) => [
          item.close,
          Number(item.volume),
          item.sma20 || item.close,
          item.ema50 || item.close,
          item.rsi14 || 50,
          item.macd || 0,
          item.bollUpper || item.close,
          item.bollLower || item.close,
        ])
        .flat();

      features.push(featureRow);
      labels.push(data[i].close); // Nächster Schlusskurs als Ziel
    }

    return { features, labels };
  }

  /**
   * Bereitet Features für eine einzelne Vorhersage vor
   */
  private async prepareFeaturesForPrediction(
    ticker: string,
  ): Promise<number[]> {
    const data = await this.prisma.historicalData.findMany({
      where: {
        stock: {
          ticker: ticker,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: this.defaultArchitecture.sequenceLength + 10,
    });

    if (data.length < this.defaultArchitecture.sequenceLength) {
      throw new Error(
        `Nicht genügend Daten für Vorhersage: ${data.length} Datenpunkte`,
      );
    }

    // Nimm die letzten N Datenpunkte
    const sequence = data.slice(-this.defaultArchitecture.sequenceLength);

    // Erstelle Feature-Array
    const features = sequence
      .map((item: any) => [
        item.close,
        Number(item.volume),
        item.sma20 || item.close,
        item.ema50 || item.close,
        item.rsi14 || 50,
        item.macd || 0,
        item.bollUpper || item.close,
        item.bollLower || item.close,
      ])
      .flat();

    return features;
  }

  /**
   * Überprüft den Status des ML-Services
   */
  async checkMLServiceStatus(): Promise<any> {
    try {
      const status = await this.mlClientService.healthCheck();
      this.logger.log('ML-Service ist verfügbar');
      return status;
    } catch (error: any) {
      this.logger.warn('ML-Service nicht verfügbar:', error.message);
      throw error;
    }
  }

  /**
   * Hybrid-Training: Verwendet sowohl lokales TensorFlow als auch ML-Service
   */
  async hybridTraining(ticker: string): Promise<{
    localResult: any;
    mlServiceResult: any;
  }> {
    try {
      this.logger.log(`Hybrid-Training für ${ticker} gestartet...`);

      // Lokales Training (bestehende Methode ohne Parameter)
      const localPromise = this.trainModel();

      // ML-Service Training
      const mlServicePromise = this.trainModelWithMLService(ticker);

      // Beide parallel ausführen
      const [localResult, mlServiceResult] = await Promise.allSettled([
        localPromise,
        mlServicePromise,
      ]);

      const result = {
        localResult:
          localResult.status === 'fulfilled' ? localResult.value : null,
        mlServiceResult:
          mlServiceResult.status === 'fulfilled' ? mlServiceResult.value : null,
      };

      this.logger.log(`Hybrid-Training für ${ticker} abgeschlossen`);
      return result;
    } catch (error) {
      this.logger.error(`Fehler beim Hybrid-Training für ${ticker}:`, error);
      throw error;
    }
  }
}
