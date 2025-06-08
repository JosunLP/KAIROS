import { Injectable, Logger } from "@nestjs/common";
import { DataIngestionService } from "../data-ingestion/data-ingestion.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import { MlPredictionService } from "../ml-prediction/ml-prediction.service";
import { PrismaService } from "../persistence/prisma.service";
import { PredictionResult } from "../common/types";

@Injectable()
export class SimpleCliService {
  private readonly logger = new Logger(SimpleCliService.name);
  private persistentMode = false;
  private backgroundTrainingInterval?: NodeJS.Timeout;

  constructor(
    private readonly dataIngestionService: DataIngestionService,
    private readonly analysisEngineService: AnalysisEngineService,
    private readonly mlPredictionService: MlPredictionService,
    private readonly prismaService: PrismaService,
  ) {}

  async processCommand(args: string[]): Promise<void> {
    const command = args[2]; // node script.js <command>

    try {
      switch (command) {
        case "status":
          await this.handleStatusCommand();
          break;
        case "track":
          await this.handleTrackCommand(args[3]);
          break;
        case "predict":
          await this.handlePredictCommand(args[3]);
          break;
        case "train":
          await this.handleTrainCommand();
          break;
        case "train-start":
          await this.handleTrainStartCommand();
          break;
        case "train-stop":
          await this.handleTrainStopCommand();
          break;
        case "train-status":
          await this.handleTrainStatusCommand();
          break;
        case "list":
          await this.handleListCommand();
          break;
        case "persistent-start":
          await this.startPersistentMode();
          break;
        case "persistent-stop":
          await this.stopPersistentMode();
          break;
        default:
          this.showHelp();
      }
    } catch (error) {
      this.logger.error(`Fehler beim Ausführen des Befehls ${command}:`, error);
      process.exit(1);
    }
  }

  private async handleStatusCommand(): Promise<void> {
    console.log("🚀 KAIROS Stock Analysis CLI - Status");
    console.log("=====================================");

    try {
      const stockCount = await this.prismaService.stock.count();
      const dataPointsCount = await this.prismaService.historicalData.count();

      console.log(`📊 Verfolgte Aktien: ${stockCount}`);
      console.log(`📈 Datenpunkte: ${dataPointsCount}`);

      if (stockCount > 0) {
        const latestData = await this.prismaService.historicalData.findFirst({
          orderBy: { timestamp: "desc" },
          include: { stock: true },
        });

        if (latestData) {
          console.log(
            `🕐 Neueste Daten: ${latestData.stock.ticker} (${latestData.timestamp.toLocaleDateString()})`,
          );
        }
      }

      console.log("✅ System ist bereit");
    } catch (error) {
      console.log("❌ Fehler beim Abrufen des Status");
      throw error;
    }
  }

  private async handleTrackCommand(ticker: string): Promise<void> {
    if (!ticker) {
      console.log("❌ Bitte geben Sie ein Ticker-Symbol an: kairos track AAPL");
      return;
    }

    console.log(`🎯 Füge ${ticker} zur Verfolgung hinzu...`);

    try {
      const existingStock = await this.prismaService.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });

      if (existingStock) {
        console.log(`⚠️  ${ticker} wird bereits verfolgt`);
        return;
      } // Aktie zur Datenbank hinzufügen
      await this.dataIngestionService.addNewStock(ticker.toUpperCase());
      // Historische Daten abrufen
      console.log("📥 Lade historische Daten...");
      await this.dataIngestionService.fetchHistoricalDataForStock(
        ticker.toUpperCase(),
      );

      console.log(`✅ ${ticker} wurde erfolgreich hinzugefügt`);
    } catch (error) {
      console.log(`❌ Fehler beim Hinzufügen von ${ticker}`);
      throw error;
    }
  }

  private async handlePredictCommand(ticker: string): Promise<void> {
    if (!ticker) {
      console.log(
        "❌ Bitte geben Sie ein Ticker-Symbol an: kairos predict AAPL",
      );
      return;
    }

    console.log(`🔮 Erstelle Prognose für ${ticker}...`);

    try {
      const stock = await this.prismaService.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });

      if (!stock) {
        console.log(
          `❌ ${ticker} wird nicht verfolgt. Fügen Sie es zuerst hinzu: kairos track ${ticker}`,
        );
        return;
      } // Aktuelle Daten abrufen
      await this.dataIngestionService.fetchLatestDataForStock(
        ticker.toUpperCase(),
      );

      // Prognose erstellen
      const prediction = await this.mlPredictionService.predictNext(
        ticker.toUpperCase(),
      );

      if (prediction) {
        console.log("\n📊 Prognose-Ergebnis:");
        console.log("====================");
        console.log(`🎯 Aktie: ${ticker.toUpperCase()}`);
        console.log(
          `🎲 Konfidenz: ${(prediction.confidence * 100).toFixed(1)}%`,
        );
        console.log(
          `💹 Prognostizierte Richtung: ${prediction.direction > 0 ? "📈 Aufwärts" : "📉 Abwärts"}`,
        );
        console.log(`🕐 Zeitstempel: ${prediction.timestamp.toLocaleString()}`);

        if (prediction.targetPrice) {
          console.log(
            `💰 Prognostizierter Preis: $${prediction.targetPrice.toFixed(2)}`,
          );
        }

        console.log("\n⚠️  Disclaimer: Dies ist keine Anlageberatung!");
      } else {
        console.log("❌ Keine Prognose möglich - nicht genügend Daten");
      }
    } catch (error) {
      console.log(`❌ Fehler bei der Prognose für ${ticker}`);
      throw error;
    }
  }

  private async handleTrainCommand(): Promise<void> {
    console.log("🧠 Starte ML-Modell Training...");

    try {
      await this.mlPredictionService.trainModel();
      console.log("✅ ML-Modell erfolgreich trainiert");
    } catch (error) {
      console.log("❌ Fehler beim Training des ML-Modells");
      throw error;
    }
  }

  private async handleTrainStartCommand(): Promise<void> {
    if (!this.persistentMode) {
      console.log("🧠 Starte erweiteres ML-Modell Training...");
      console.log("💡 Verwenden Sie 'kairos train-stop' zum sicheren Beenden");
      console.log("💡 Verwenden Sie 'kairos train-status' für Status-Updates");

      try {
        const success = await this.mlPredictionService.startTraining();
        if (success) {
          console.log("✅ ML-Modell erfolgreich trainiert");
        } else {
          console.log("⚠️ Training wurde abgebrochen oder fehlgeschlagen");
        }
      } catch (error) {
        console.log("❌ Fehler beim Training des ML-Modells");
        throw error;
      }
      return;
    }

    // Persistenter Modus
    const trainingStatus = this.mlPredictionService.getTrainingStatus();
    if (trainingStatus.isTraining) {
      console.log("⚠️ Training läuft bereits im Hintergrund");
      console.log("💡 Verwenden Sie 'train-status' für Details oder 'train-stop' zum Beenden");
      return;
    }

    console.log("🧠 Starte Hintergrund-Training...");
    console.log("💡 Das Training läuft im Hintergrund. CLI bleibt verfügbar.");
    console.log("💡 Verwenden Sie 'train-status' für Updates oder 'train-stop' zum Beenden");

    try {
      // Training im Hintergrund starten (non-blocking)
      this.mlPredictionService.startTraining().then((success) => {
        if (success) {
          console.log("\n✅ Hintergrund-Training erfolgreich abgeschlossen");
        } else {
          console.log("\n⚠️ Hintergrund-Training wurde abgebrochen");
        }
        console.log("kairos> "); // Prompt wiederherstellen
      }).catch((error) => {
        console.log("\n❌ Fehler beim Hintergrund-Training:", error.message);
        console.log("kairos> "); // Prompt wiederherstellen
      });

      // Kurz warten und ersten Status zeigen
      setTimeout(() => {
        const status = this.mlPredictionService.getTrainingStatus();
        if (status.isTraining) {
          console.log("🟢 Hintergrund-Training gestartet");
        }
      }, 1000);

    } catch (error) {
      console.log("❌ Fehler beim Starten des Hintergrund-Trainings");
      throw error;
    }
  }

  private async handleTrainStopCommand(): Promise<void> {
    const trainingStatus = this.mlPredictionService.getTrainingStatus();
    
    if (!trainingStatus.isTraining) {
      console.log("⚠️ Kein Training läuft derzeit");
      return;
    }

    if (this.persistentMode) {
      console.log("🛑 Beende Hintergrund-Training...");
    } else {
      console.log("🛑 Beende Training sicher...");
    }

    try {
      const success = await this.mlPredictionService.stopTraining();
      if (success) {
        console.log("✅ Training wurde sicher beendet");
      } else {
        console.log("⚠️ Kein Training läuft derzeit");
      }
    } catch (error) {
      console.log("❌ Fehler beim Beenden des Trainings");
      throw error;
    }
  }

  private async handleTrainStatusCommand(): Promise<void> {
    console.log("📊 Training Status:");
    console.log("==================");

    try {
      const status = this.mlPredictionService.getTrainingStatus();
      
      if (!status.isTraining) {
        console.log("🔴 Kein Training läuft derzeit");
        console.log("💡 Verwenden Sie 'kairos train-start' um Training zu starten");
        return;
      }

      console.log("🟢 Training läuft...");
      
      if (status.startTime) {
        const runningTime = Date.now() - status.startTime.getTime();
        const runningMinutes = Math.floor(runningTime / 60000);
        const runningSeconds = Math.floor((runningTime % 60000) / 1000);
        console.log(`🕐 Laufzeit: ${runningMinutes}m ${runningSeconds}s`);
      }
      
      if (status.currentEpoch && status.totalEpochs) {
        const progress = ((status.currentEpoch / status.totalEpochs) * 100).toFixed(1);
        console.log(`📈 Fortschritt: ${status.currentEpoch}/${status.totalEpochs} (${progress}%)`);
      }
      
      if (status.loss !== undefined) {
        console.log(`💔 Loss: ${status.loss.toFixed(4)}`);
      }
      
      if (status.accuracy !== undefined) {
        console.log(`🎯 Accuracy: ${(status.accuracy * 100).toFixed(2)}%`);
      }

      console.log("\n💡 Verwenden Sie 'kairos train-stop' zum sicheren Beenden");
    } catch (error) {
      console.log("❌ Fehler beim Abrufen des Training-Status");
      throw error;
    }
  }

  private async handleListCommand(): Promise<void> {
    console.log("📋 Verfolgte Aktien:");
    console.log("===================");

    try {
      const stocks = await this.prismaService.stock.findMany({
        orderBy: { ticker: "asc" },
      });

      if (stocks.length === 0) {
        console.log("📭 Keine Aktien werden verfolgt");
        console.log(
          '💡 Verwenden Sie "kairos track <TICKER>" um eine Aktie hinzuzufügen',
        );
        return;
      }

      for (const stock of stocks) {
        // Neueste Daten für jede Aktie abrufen
        const latestData = await this.prismaService.historicalData.findFirst({
          where: { stockId: stock.id },
          orderBy: { timestamp: "desc" },
        });

        const price = latestData ? `$${latestData.close.toFixed(2)}` : "N/A";
        const date = latestData
          ? latestData.timestamp.toLocaleDateString()
          : "N/A";

        console.log(
          `📈 ${stock.ticker.padEnd(6)} | ${stock.name.padEnd(30)} | ${price.padStart(10)} | ${date}`,
        );
      }
    } catch (error) {
      console.log("❌ Fehler beim Auflisten der Aktien");
      throw error;
    }
  }

  private showHelp(): void {
    console.log("🚀 KAIROS Stock Analysis CLI");
    console.log("============================");
    console.log("");
    
    if (this.persistentMode) {
      console.log("🔄 Persistenter Modus aktiv - CLI bleibt geöffnet");
      console.log("");
    }
    
    console.log("Verfügbare Befehle:");
    console.log("");
    console.log("  status           Zeigt den aktuellen Status der Anwendung");
    console.log("  track <TICKER>   Fügt eine Aktie zur Verfolgung hinzu");
    console.log("  predict <TICKER> Erstellt eine KI-Prognose für eine Aktie");
    console.log("  train            Trainiert das ML-Modell (einfach)");
    console.log("  train-start      Startet das erweiterte ML-Training");
    console.log("  train-stop       Beendet das laufende Training sicher");
    console.log("  train-status     Zeigt den aktuellen Training-Status");
    console.log("  list             Zeigt alle verfolgten Aktien an");
    
    if (this.persistentMode) {
      console.log("  exit             Beendet die Anwendung");
      console.log("  quit             Beendet die Anwendung");
    }
    
    console.log("");
    console.log("Beispiele:");
    
    if (this.persistentMode) {
      console.log("  track AAPL");
      console.log("  predict MSFT");
      console.log("  train-start");
      console.log("  train-status");
      console.log("  train-stop");
      console.log("  list");
      console.log("  exit");
    } else {
      console.log("  kairos track AAPL");
      console.log("  kairos predict MSFT");
      console.log("  kairos train-start");
      console.log("  kairos train-status");
      console.log("  kairos train-stop");
      console.log("  kairos list");
    }
    
    console.log("");
    
    if (this.persistentMode) {
      console.log("💡 Im persistenten Modus:");
      console.log("   - Training läuft im Hintergrund weiter");
      console.log("   - CLI bleibt für andere Befehle verfügbar");
      console.log("   - Verwenden Sie 'exit' zum Beenden");
    } else {
      console.log("💡 Tipp: Das erweiterte Training (train-start) kann sicher");
      console.log("   mit 'train-stop' beendet werden, ohne Daten zu verlieren.");
      console.log("💡 Starten Sie ohne Argumente für persistenten Modus.");
    }
  }

  /**
   * Startet den persistenten CLI-Modus
   */
  async startPersistentMode(): Promise<void> {
    this.persistentMode = true;
    this.logger.log("🔄 Persistenter CLI-Modus aktiviert");
    
    // Hintergrund-Training-Status-Updates starten
    this.startBackgroundStatusUpdates();
  }

  /**
   * Stoppt den persistenten CLI-Modus
   */
  async stopPersistentMode(): Promise<void> {
    this.persistentMode = false;
    
    // Hintergrund-Updates stoppen
    if (this.backgroundTrainingInterval) {
      clearInterval(this.backgroundTrainingInterval);
      this.backgroundTrainingInterval = undefined;
    }

    // Laufendes Training sicher beenden
    const trainingStatus = this.mlPredictionService.getTrainingStatus();
    if (trainingStatus.isTraining) {
      console.log("🛑 Beende laufendes Training...");
      await this.mlPredictionService.stopTraining();
    }

    this.logger.log("🔄 Persistenter CLI-Modus deaktiviert");
  }

  /**
   * Startet Hintergrund-Status-Updates für Training
   */
  private startBackgroundStatusUpdates(): void {
    this.backgroundTrainingInterval = setInterval(() => {
      const status = this.mlPredictionService.getTrainingStatus();
      
      if (status.isTraining && this.persistentMode) {
        // Status-Update in der Konsole (ohne neue Zeile zu stören)
        const progress = status.currentEpoch && status.totalEpochs 
          ? `${status.currentEpoch}/${status.totalEpochs}` 
          : "N/A";
        
        const loss = status.loss !== undefined ? status.loss.toFixed(4) : "N/A";
        const accuracy = status.accuracy !== undefined ? (status.accuracy * 100).toFixed(2) + "%" : "N/A";
        
        // Zeige Status in der gleichen Zeile an (überschreibt vorherige)
        process.stdout.write(`\r🧠 Training: ${progress} | Loss: ${loss} | Acc: ${accuracy} | Eingabe: `);
      }
    }, 2000); // Update alle 2 Sekunden
  }
}
