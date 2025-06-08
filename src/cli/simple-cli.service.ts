import { Injectable, Logger } from "@nestjs/common";
import { DataIngestionService } from "../data-ingestion/data-ingestion.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import { MlPredictionService } from "../ml-prediction/ml-prediction.service";
import { PrismaService } from "../persistence/prisma.service";
import { PredictionResult } from "../common/types";

@Injectable()
export class SimpleCliService {
  private readonly logger = new Logger(SimpleCliService.name);

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
        case "list":
          await this.handleListCommand();
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
    console.log("Verfügbare Befehle:");
    console.log("");
    console.log("  status           Zeigt den aktuellen Status der Anwendung");
    console.log("  track <TICKER>   Fügt eine Aktie zur Verfolgung hinzu");
    console.log("  predict <TICKER> Erstellt eine KI-Prognose für eine Aktie");
    console.log(
      "  train            Trainiert das ML-Modell mit aktuellen Daten",
    );
    console.log("  list             Zeigt alle verfolgten Aktien an");
    console.log("");
    console.log("Beispiele:");
    console.log("  kairos track AAPL");
    console.log("  kairos predict MSFT");
    console.log("  kairos list");
  }
}
