import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../persistence/prisma.service";
import { PredictionResult, TrainingStatus } from "../common/types";
import * as tf from "@tensorflow/tfjs";
import * as fs from "fs";
import * as path from "path";

export interface TrainingData {
  features: number[][];
  labels: number[];
}

@Injectable()
export class MlPredictionService {
  private readonly logger = new Logger(MlPredictionService.name);
  private readonly modelDir = path.join(process.cwd(), "models");
  private models: Map<string, tf.LayersModel> = new Map();
  private trainingStatus: TrainingStatus = { isTraining: false };
  private trainingAbortController?: AbortController;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
      const fs = await import("fs");
      return fs.existsSync(modelPath);
    } catch (error) {
      this.logger.error("Fehler beim Prüfen des Modells:", error);
      return false;
    }
  }

  /**
   * Trainiert das ML-Modell mit allen verfügbaren Daten
   */
  async trainModel(): Promise<boolean> {
    try {
      this.logger.log("🤖 Starte ML-Modell-Training...");

      // Trainingsdaten sammeln
      const trainingData = await this.prepareTrainingData();

      if (trainingData.length < 100) {
        this.logger.warn(
          "Nicht genügend Daten für Training (mindestens 100 benötigt)",
        );
        return false;
      }

      // Modell erstellen und trainieren
      const model = await this.createAndTrainModel(trainingData);

      // Modell speichern
      await this.saveModel(model);

      this.logger.log("✅ ML-Modell erfolgreich trainiert und gespeichert");
      return true;
    } catch (error) {
      this.logger.error("Fehler beim Training:", error);
      return false;
    }
  }

  /**
   * Startet das Training mit erweiterten Kontrollfunktionen
   */
  async startTraining(): Promise<boolean> {
    if (this.trainingStatus.isTraining) {
      this.logger.warn("Training läuft bereits");
      return false;
    }

    try {
      this.trainingStatus = {
        isTraining: true,
        startTime: new Date(),
        currentEpoch: 0,
        totalEpochs: 100,
        shouldStop: false
      };
      
      this.trainingAbortController = new AbortController();
      
      this.logger.log("🤖 Starte erweiteres ML-Modell-Training...");

      // Trainingsdaten sammeln
      const trainingData = await this.prepareTrainingData();

      if (trainingData.length < 100) {
        this.logger.warn(
          "Nicht genügend Daten für Training (mindestens 100 benötigt)",
        );
        this.trainingStatus.isTraining = false;
        return false;
      }

      // Modell erstellen und trainieren mit Abort-Kontrolle
      const model = await this.createAndTrainModelWithControl(trainingData);

      if (!this.trainingStatus.shouldStop && model) {
        // Modell speichern
        await this.saveModel(model);
        this.logger.log("✅ ML-Modell erfolgreich trainiert und gespeichert");
      } else {
        this.logger.log("⚠️ Training wurde abgebrochen");
      }

      this.trainingStatus.isTraining = false;
      return !this.trainingStatus.shouldStop;
    } catch (error) {
      this.logger.error("Fehler beim Training:", error);
      this.trainingStatus.isTraining = false;
      return false;
    }
  }

  /**
   * Stoppt das laufende Training sicher
   */
  async stopTraining(): Promise<boolean> {
    if (!this.trainingStatus.isTraining) {
      this.logger.warn("Kein Training läuft derzeit");
      return false;
    }

    this.logger.log("🛑 Beende Training sicher...");
    this.trainingStatus.shouldStop = true;
    
    if (this.trainingAbortController) {
      this.trainingAbortController.abort();
    }

    // Warte bis Training beendet ist
    while (this.trainingStatus.isTraining) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.log("✅ Training sicher beendet");
    return true;
  }

  /**
   * Gibt den aktuellen Training-Status zurück
   */
  getTrainingStatus(): TrainingStatus {
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
        this.logger.warn("Kein trainiertes Modell verfügbar");
        return null;
      }

      // Aktuelle Daten für Prognose vorbereiten
      const inputData = await this.prepareInputData(ticker);
      if (!inputData) {
        this.logger.warn(`Nicht genügend Daten für Prognose von ${ticker}`);
        return null;
      } // Prognose erstellen
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
    return "./models/kairos-model";
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
      this.logger.error("Fehler beim Laden des Modells:", error);
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
      const fs = await import("fs");
      if (!fs.existsSync("./models")) {
        fs.mkdirSync("./models", { recursive: true });
      }

      await model.save(`file://${modelPath}`);
      this.logger.log(`Modell gespeichert unter: ${modelPath}`);
    } catch (error) {
      this.logger.error("Fehler beim Speichern des Modells:", error);
      throw error;
    }
  }

  /**
   * Bereitet die Trainingsdaten vor
   */
  private async prepareTrainingData(): Promise<any[]> {
    try {
      const data = await this.prisma.historicalData.findMany({
        where: {
          AND: [
            { sma20: { not: null } },
            { ema50: { not: null } },
            { rsi14: { not: null } },
            { macd: { not: null } },
          ],
        },
        orderBy: { timestamp: "asc" },
        include: { stock: true },
      });

      return this.transformDataForTraining(data);
    } catch (error) {
      this.logger.error("Fehler beim Vorbereiten der Trainingsdaten:", error);
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
      const features = sequence.map((item) => [
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
   * Erstellt und trainiert das LSTM-Modell
   */
  private async createAndTrainModel(
    trainingData: any[],
  ): Promise<tf.LayersModel> {
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
        tf.layers.dense({ units: 25, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    // Modell kompilieren
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    // Daten für Training vorbereiten
    const inputs = trainingData.map((item) => item.input);
    const outputs = trainingData.map((item) => item.output);

    const xs = tf.tensor3d(inputs);
    const ys = tf.tensor2d(outputs, [outputs.length, 1]);

    // Training
    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 1,
    });

    // Speicher freigeben
    xs.dispose();
    ys.dispose();

    return model;
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
        tf.layers.dense({ units: 25, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    // Modell kompilieren
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    // Daten für Training vorbereiten
    const inputs = trainingData.map((item) => item.input);
    const outputs = trainingData.map((item) => item.output);

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
            this.trainingStatus.loss = logs?.loss;
            this.trainingStatus.accuracy = logs?.acc;

            this.logger.log(
              `📊 Epoche ${epoch + 1}/${this.trainingStatus.totalEpochs} - ` +
              `Loss: ${logs?.loss?.toFixed(4)}, Accuracy: ${logs?.acc?.toFixed(4)}`
            );

            // Prüfe ob Training abgebrochen werden soll
            if (this.trainingStatus.shouldStop) {
              this.logger.log("🛑 Training wird abgebrochen...");
              throw new Error("Training aborted by user");
            }

            // Kurze Pause um anderen Operationen Zeit zu geben
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      });

      // Cleanup
      xs.dispose();
      ys.dispose();

      return model;
    } catch (error) {
      // Cleanup bei Fehler
      xs.dispose();
      ys.dispose();
      
      if (error instanceof Error && error.message === "Training aborted by user") {
        return null;
      }
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
        orderBy: { timestamp: "desc" },
        take: 30, // Letzte 30 Datenpunkte
      });

      if (data.length < 30) {
        return null;
      }

      // Reihenfolge umkehren (älteste zuerst)
      data.reverse();

      return data.map((item) => [
        item.close,
        Number(item.volume),
        item.sma20 || 0,
        item.ema50 || 0,
        item.rsi14 || 0,
        item.macd || 0,
      ]);
    } catch (error) {
      this.logger.error("Fehler beim Vorbereiten der Eingabedaten:", error);
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
        ticker: ticker,
        confidence,
        direction,
        timestamp: new Date(),
        targetPrice: undefined, // Könnte in der Zukunft implementiert werden
      };
    } catch (error) {
      this.logger.error("Fehler bei der Prognose-Erstellung:", error);
      throw error;
    }
  }

  /**
   * Validiert gespeicherte Prognosen gegen tatsächliche Marktentwicklung
   */
  async validatePredictions(): Promise<void> {
    this.logger.log("Beginne Validierung der Prognosen...");
    try {
      // TODO: Implementierung der Prognose-Validierung
      // - Lade vergangene Prognosen aus der Datenbank
      // - Vergleiche mit tatsächlichen Kursentwicklungen
      // - Berechne Genauigkeitsmetriken
      // - Aktualisiere ML-Modell bei Bedarf
      this.logger.log("Prognose-Validierung abgeschlossen");
    } catch (error) {
      this.logger.error("Fehler bei der Prognose-Validierung:", error);
      throw error;
    }
  }
}
