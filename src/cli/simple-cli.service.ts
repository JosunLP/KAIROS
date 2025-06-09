import { Injectable, Logger } from "@nestjs/common";
import { DataIngestionService } from "../data-ingestion/data-ingestion.service";
import { AnalysisEngineService } from "../analysis-engine/analysis-engine.service";
import { MlPredictionService } from "../ml-prediction/ml-prediction.service";
import { PrismaService } from "../persistence/prisma.service";
import { PortfolioService } from "../portfolio/portfolio.service";
import { BacktestService } from "../portfolio/backtest.service";
import { RiskManagementService } from "../portfolio/risk-management.service";
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
    private readonly portfolioService: PortfolioService,
    private readonly backtestService: BacktestService,
    private readonly riskManagementService: RiskManagementService,
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
        case "portfolio-create":
          await this.handlePortfolioCreateCommand(args[3]);
          break;
        case "portfolio-list":
          await this.handlePortfolioListCommand();
          break;
        case "portfolio-add":
          await this.handlePortfolioAddPositionCommand(
            args[3],
            args[4],
            parseFloat(args[5] || "1"),
          );
          break;
        case "portfolio-remove":
          await this.handlePortfolioRemovePositionCommand(args[3], args[4]);
          break;
        case "portfolio-analyze":
          await this.handlePortfolioAnalyzeCommand(args[3]);
          break;
        case "backtest":
          await this.handleBacktestCommand(args[3], args[4], args[5]);
          break;
        case "risk-analysis":
          await this.handleRiskAnalysisCommand(args[3]);
          break;
        case "persistent-start":
          await this.startPersistentMode();
          break;
        case "persistent-stop":
          await this.stopPersistentMode();
          break;
        case "dashboard":
          await this.handleDashboardCommand();
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
      console.log(
        "💡 Verwenden Sie 'train-status' für Details oder 'train-stop' zum Beenden",
      );
      return;
    }

    console.log("🧠 Starte Hintergrund-Training...");
    console.log("💡 Das Training läuft im Hintergrund. CLI bleibt verfügbar.");
    console.log(
      "💡 Verwenden Sie 'train-status' für Updates oder 'train-stop' zum Beenden",
    );

    try {
      // Training im Hintergrund starten (non-blocking)
      this.mlPredictionService
        .startTraining()
        .then((success) => {
          if (success) {
            console.log("\n✅ Hintergrund-Training erfolgreich abgeschlossen");
          } else {
            console.log("\n⚠️ Hintergrund-Training wurde abgebrochen");
          }
          console.log("kairos> "); // Prompt wiederherstellen
        })
        .catch((error) => {
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
        console.log(
          "💡 Verwenden Sie 'kairos train-start' um Training zu starten",
        );
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
        const progress = (
          (status.currentEpoch / status.totalEpochs) *
          100
        ).toFixed(1);
        console.log(
          `📈 Fortschritt: ${status.currentEpoch}/${status.totalEpochs} (${progress}%)`,
        );
      }

      if (status.loss !== undefined) {
        console.log(`💔 Loss: ${status.loss.toFixed(4)}`);
      }

      if (status.accuracy !== undefined) {
        console.log(`🎯 Accuracy: ${(status.accuracy * 100).toFixed(2)}%`);
      }

      console.log(
        "\n💡 Verwenden Sie 'kairos train-stop' zum sicheren Beenden",
      );
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
    console.log("🎯 KAIROS - KI-gestützte Aktienanalyse");
    console.log("=====================================");
    console.log("");
    console.log("📊 GRUNDLEGENDE BEFEHLE:");
    console.log("  status               - System-Status anzeigen");
    console.log("  dashboard            - Übersicht aller Daten");
    console.log("  list                 - Alle verfolgten Aktien auflisten");
    console.log("  track <TICKER>       - Aktie zur Verfolgung hinzufügen");
    console.log("");
    console.log("🤖 ML-VORHERSAGEN:");
    console.log("  predict <TICKER>     - Preis-Vorhersage für Aktie");
    console.log("  train                - Einmaliges ML-Training starten");
    console.log("  train-start          - Kontinuierliches Training starten");
    console.log("  train-stop           - Training beenden");
    console.log("  train-status         - Training-Status anzeigen");
    console.log("");
    console.log("💼 PORTFOLIO-MANAGEMENT:");
    console.log(
      "  portfolio-create <NAME>                    - Neues Portfolio erstellen",
    );
    console.log(
      "  portfolio-list                             - Alle Portfolios auflisten",
    );
    console.log(
      "  portfolio-add <ID> <TICKER> <QUANTITY>     - Position hinzufügen",
    );
    console.log(
      "  portfolio-remove <ID> <TICKER>             - Position entfernen",
    );
    console.log(
      "  portfolio-analyze <ID>                     - Portfolio analysieren",
    );
    console.log("");
    console.log("📈 BACKTESTING & RISIKO:");
    console.log(
      "  backtest <STRATEGY> <START> <END>         - Backtest durchführen",
    );
    console.log("  risk-analysis <PORTFOLIO_ID>              - Risiko-Analyse");
    console.log("");
    console.log("🔧 SYSTEM:");
    console.log("  persistent-start     - Kontinuierlichen Modus starten");
    console.log("  persistent-stop      - Kontinuierlichen Modus beenden");
    console.log("");
    console.log("📋 BEISPIELE:");
    console.log("  kairos track AAPL");
    console.log("  kairos predict AAPL");
    console.log("  kairos portfolio-create 'Mein Portfolio'");
    console.log("  kairos backtest rsi 2024-01-01 2024-12-31");
    console.log("");
    console.log("💡 Verfügbare Strategien: rsi, sma, macd");

    if (this.persistentMode) {
      console.log("");
      console.log("🔄 Persistenter Modus aktiv - CLI bleibt geöffnet");
      console.log("💡 Verwenden Sie 'exit' oder 'quit' zum Beenden");
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
        const progress =
          status.currentEpoch && status.totalEpochs
            ? `${status.currentEpoch}/${status.totalEpochs}`
            : "N/A";

        const loss = status.loss !== undefined ? status.loss.toFixed(4) : "N/A";
        const accuracy =
          status.accuracy !== undefined
            ? (status.accuracy * 100).toFixed(2) + "%"
            : "N/A";

        // Zeige Status in der gleichen Zeile an (überschreibt vorherige)
        process.stdout.write(
          `\r🧠 Training: ${progress} | Loss: ${loss} | Acc: ${accuracy} | Eingabe: `,
        );
      }
    }, 2000); // Update alle 2 Sekunden
  }

  /**
   * Portfolio-Management Commands
   */
  private async handlePortfolioCreateCommand(name: string): Promise<void> {
    if (!name) {
      console.log("❌ Portfolio-Name ist erforderlich");
      console.log("💡 Verwendung: portfolio-create <NAME>");
      return;
    }

    try {
      const portfolio = await this.portfolioService.createPortfolioWithCapital(
        name,
        10000,
      ); // Default: $10,000
      console.log("✅ Portfolio erstellt:");
      console.log(`📊 Name: ${portfolio.name}`);
      console.log(
        `💰 Startkapital: $${(portfolio.initialValue || 0).toFixed(2)}`,
      );
      console.log(`🆔 ID: ${portfolio.id}`);
    } catch (error) {
      console.log("❌ Fehler beim Erstellen des Portfolios");
      this.logger.error("Fehler beim Erstellen des Portfolios", error);
    }
  }

  private async handlePortfolioListCommand(): Promise<void> {
    try {
      const portfolios = await this.portfolioService.getAllPortfolios();

      if (portfolios.length === 0) {
        console.log("📋 Keine Portfolios gefunden");
        console.log(
          "💡 Erstellen Sie ein Portfolio mit: portfolio-create <NAME>",
        );
        return;
      }

      console.log("📋 Ihre Portfolios:");
      console.log("===================");

      for (const portfolio of portfolios) {
        const metrics =
          await this.portfolioService.calculatePortfolioMetrics(portfolio);
        const positionCount = portfolio.positions.length;

        console.log(
          `📊 ${portfolio.name} (${portfolio.id.substring(0, 8)}...)`,
        );
        console.log(`   💰 Aktueller Wert: $${metrics.totalValue.toFixed(2)}`);
        console.log(
          `   📈 Rendite: ${(metrics.totalReturn * 100).toFixed(2)}%`,
        );
        console.log(`   📋 Positionen: ${positionCount}`);
        console.log(
          `   📅 Erstellt: ${portfolio.createdAt.toLocaleDateString()}`,
        );
        console.log("");
      }
    } catch (error) {
      console.log("❌ Fehler beim Abrufen der Portfolios");
      this.logger.error("Fehler beim Abrufen der Portfolios", error);
    }
  }

  private async handlePortfolioAddPositionCommand(
    portfolioId: string,
    ticker: string,
    quantity: number,
  ): Promise<void> {
    if (!portfolioId || !ticker || !quantity) {
      console.log("❌ Portfolio-ID, Ticker und Anzahl sind erforderlich");
      console.log(
        "💡 Verwendung: portfolio-add <PORTFOLIO_ID> <TICKER> <QUANTITY>",
      );
      return;
    }

    try {
      // Prüfe ob Aktie verfolgt wird
      const stock = await this.prismaService.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });

      if (!stock) {
        console.log(`❌ Aktie ${ticker.toUpperCase()} wird nicht verfolgt`);
        console.log(
          `💡 Fügen Sie die Aktie zuerst hinzu: track ${ticker.toUpperCase()}`,
        );
        return;
      }

      // Aktuellen Preis abrufen
      const latestData = await this.prismaService.historicalData.findFirst({
        where: { stockId: stock.id },
        orderBy: { timestamp: "desc" },
      });

      if (!latestData) {
        console.log(
          `❌ Keine Preisdaten für ${ticker.toUpperCase()} verfügbar`,
        );
        return;
      }

      const position = await this.portfolioService.addPosition(
        portfolioId,
        ticker.toUpperCase(),
        quantity,
        latestData.close,
      );

      console.log("✅ Position hinzugefügt:");
      console.log(`📊 Portfolio: ${portfolioId.substring(0, 8)}...`);
      console.log(
        `📈 ${ticker.toUpperCase()}: ${quantity} Aktien @ $${latestData.close.toFixed(2)}`,
      );
      console.log(
        `💰 Gesamtwert: $${(quantity * latestData.close).toFixed(2)}`,
      );
    } catch (error) {
      console.log("❌ Fehler beim Hinzufügen der Position");
      this.logger.error("Fehler beim Hinzufügen der Position", error);
    }
  }

  private async handlePortfolioRemovePositionCommand(
    portfolioId: string,
    ticker: string,
  ): Promise<void> {
    if (!portfolioId || !ticker) {
      console.log("❌ Portfolio-ID und Ticker sind erforderlich");
      console.log("💡 Verwendung: portfolio-remove <PORTFOLIO_ID> <TICKER>");
      return;
    }

    try {
      await this.portfolioService.removePosition(
        portfolioId,
        ticker.toUpperCase(),
      );
      console.log("✅ Position entfernt:");
      console.log(`📊 Portfolio: ${portfolioId.substring(0, 8)}...`);
      console.log(`❌ ${ticker.toUpperCase()} Position geschlossen`);
    } catch (error) {
      console.log("❌ Fehler beim Entfernen der Position");
      this.logger.error("Fehler beim Entfernen der Position", error);
    }
  }

  private async handlePortfolioAnalyzeCommand(
    portfolioId: string,
  ): Promise<void> {
    if (!portfolioId) {
      console.log("❌ Portfolio-ID ist erforderlich");
      console.log("💡 Verwendung: portfolio-analyze <PORTFOLIO_ID>");
      return;
    }

    try {
      const portfolio = await this.portfolioService.getPortfolio(portfolioId);
      if (!portfolio) {
        console.log("❌ Portfolio nicht gefunden");
        return;
      }

      const metrics =
        await this.portfolioService.calculatePortfolioMetrics(portfolio);

      // Standard-Risiko-Limits definieren
      const riskLimits = {
        maxPositionSize: 20.0, // 20% max position size
        maxSectorExposure: 30.0, // 30% max sector exposure
        maxDrawdown: 15.0, // 15% max drawdown
        minLiquidity: 5.0, // 5% minimum cash
        maxLeverage: 1.0, // No leverage
        maxCorrelation: 0.7, // 70% max correlation
        stopLossLevel: 10.0, // 10% stop loss
      };

      const riskAssessment =
        await this.riskManagementService.assessPortfolioRisk(
          portfolio,
          riskLimits,
        );

      console.log(`📊 Portfolio-Analyse: ${portfolio.name}`);
      console.log("========================================");
      console.log("");

      console.log("💰 Performance-Metriken:");
      console.log(`   Gesamtwert: $${metrics.totalValue.toFixed(2)}`);
      console.log(
        `   Tagesrendite: ${(metrics.dailyReturn * 100).toFixed(2)}%`,
      );
      console.log(
        `   Gesamtrendite: ${(metrics.totalReturn * 100).toFixed(2)}%`,
      );
      console.log(`   Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(
        `   Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`,
      );
      console.log(`   Volatilität: ${(metrics.volatility * 100).toFixed(2)}%`);
      console.log("");

      console.log("⚠️ Risiko-Bewertung:");
      console.log(`   Risiko-Level: ${riskAssessment.riskLevel}`);
      console.log(`   Risiko-Score: ${riskAssessment.riskScore}/100`);
      console.log("");

      if (riskAssessment.alerts.length > 0) {
        console.log("🚨 Risiko-Warnungen:");
        riskAssessment.alerts.forEach((alert) => {
          console.log(`   ${alert.severity}: ${alert.message}`);
        });
        console.log("");
      }

      if (riskAssessment.recommendations.length > 0) {
        console.log("💡 Empfehlungen:");
        riskAssessment.recommendations.forEach((rec) => {
          console.log(`   • ${rec}`);
        });
      }
    } catch (error) {
      console.log("❌ Fehler bei der Portfolio-Analyse");
      this.logger.error("Fehler bei der Portfolio-Analyse", error);
    }
  }

  private async handleBacktestCommand(
    strategy: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    if (!strategy || !startDate || !endDate) {
      console.log("❌ Strategie, Start- und Enddatum sind erforderlich");
      console.log("💡 Verwendung: backtest <STRATEGY> <START_DATE> <END_DATE>");
      console.log("💡 Beispiel: backtest rsi 2024-01-01 2024-12-31");
      console.log("💡 Verfügbare Strategien: rsi, sma, macd");
      return;
    }

    try {
      // Einfache vordefinierte Strategien
      const strategies: Record<string, any> = {
        rsi: {
          name: "RSI Überverkauft/Überkauft",
          buySignals: ["rsi_oversold"],
          sellSignals: ["rsi_overbought"],
          riskManagement: {
            stopLoss: 5.0,
            takeProfit: 10.0,
            maxPositionSize: 20.0,
          },
        },
        sma: {
          name: "Simple Moving Average Crossover",
          buySignals: ["sma_bullish_cross"],
          sellSignals: ["sma_bearish_cross"],
          riskManagement: {
            stopLoss: 3.0,
            takeProfit: 8.0,
            maxPositionSize: 25.0,
          },
        },
        macd: {
          name: "MACD Signal",
          buySignals: ["macd_bullish"],
          sellSignals: ["macd_bearish"],
          riskManagement: {
            stopLoss: 4.0,
            takeProfit: 12.0,
            maxPositionSize: 15.0,
          },
        },
      };

      const selectedStrategy = strategies[strategy.toLowerCase()];
      if (!selectedStrategy) {
        console.log(`❌ Unbekannte Strategie: ${strategy}`);
        console.log("💡 Verfügbare Strategien: rsi, sma, macd");
        return;
      }

      const config = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        initialCapital: 10000,
        strategy: selectedStrategy,
        riskParameters: {
          maxPositionSize: selectedStrategy.riskManagement.maxPositionSize,
          maxExposure: 80.0,
          stopLoss: selectedStrategy.riskManagement.stopLoss,
          takeProfit: selectedStrategy.riskManagement.takeProfit,
          maxDrawdown: 20.0,
        },
        tradingCosts: {
          commission: 5.0,
          spread: 0.1,
          slippage: 0.05,
        },
      };

      console.log(`🔄 Starte Backtest für Strategie: ${selectedStrategy.name}`);
      console.log(`📅 Zeitraum: ${startDate} bis ${endDate}`);
      console.log(`💰 Startkapital: $${config.initialCapital.toFixed(2)}`);
      console.log("");

      // Alle verfolgten Aktien für Backtest holen
      const stocks = await this.prismaService.stock.findMany({
        select: { ticker: true },
      });

      if (stocks.length === 0) {
        console.log("❌ Keine Aktien verfügbar für Backtest");
        console.log("💡 Fügen Sie zuerst Aktien mit 'track <TICKER>' hinzu");
        return;
      }

      const tickers = stocks.map((s) => s.ticker);
      const results = await this.backtestService.runBacktest(tickers, config);

      // Nimm das letzte Ergebnis als Gesamt-Ergebnis (Overall Performance)
      const result = results[results.length - 1];
      if (!result) {
        console.log("❌ Keine Backtest-Ergebnisse erhalten");
        return;
      }

      console.log("📊 Backtest-Ergebnisse:");
      console.log("========================");
      console.log(`📈 Endkapital: $${result.finalCapital.toFixed(2)}`);
      console.log(
        `💰 Gesamtrendite: ${(result.totalReturn * 100).toFixed(2)}%`,
      );
      console.log(`📊 Anzahl Trades: ${result.totalTrades}`);
      console.log(
        `✅ Gewinn-Trades: ${result.profitableTrades} (${((result.profitableTrades / result.totalTrades) * 100).toFixed(1)}%)`,
      );
      console.log(
        `❌ Verlust-Trades: ${result.totalTrades - result.profitableTrades}`,
      );
      console.log(`💔 Max Drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%`);
      console.log(`📊 Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
      console.log(`📈 Volatilität: ${(result.volatility * 100).toFixed(2)}%`);
    } catch (error) {
      console.log("❌ Fehler beim Backtest");
      this.logger.error("Fehler beim Backtest", error);
    }
  }

  private async handleRiskAnalysisCommand(portfolioId: string): Promise<void> {
    if (!portfolioId) {
      console.log("❌ Portfolio-ID ist erforderlich");
      console.log("💡 Verwendung: risk-analysis <PORTFOLIO_ID>");
      return;
    }

    try {
      const portfolio = await this.portfolioService.getPortfolio(portfolioId);
      if (!portfolio) {
        console.log("❌ Portfolio nicht gefunden");
        return;
      }

      // Standard-Risiko-Limits definieren
      const riskLimits = {
        maxPositionSize: 20.0,
        maxSectorExposure: 30.0,
        maxDrawdown: 15.0,
        minLiquidity: 5.0,
        maxLeverage: 1.0,
        maxCorrelation: 0.7,
        stopLossLevel: 10.0,
      };

      const riskAssessment =
        await this.riskManagementService.assessPortfolioRisk(
          portfolio,
          riskLimits,
        );
      const riskMetrics =
        await this.riskManagementService.calculateRiskMetrics(portfolio);

      console.log(`⚠️ Risiko-Analyse: ${portfolio.name}`);
      console.log("================================");
      console.log("");

      console.log("📊 Risiko-Übersicht:");
      console.log(`   Risiko-Level: ${riskAssessment.riskLevel}`);
      console.log(`   Risiko-Score: ${riskAssessment.riskScore}/100`);
      console.log("");

      console.log("📈 Risiko-Kennzahlen:");
      console.log(
        `   Portfolio-Risiko: ${(riskMetrics.portfolioRisk * 100).toFixed(2)}%`,
      );
      console.log(`   VaR (1 Tag, 95%): $${riskMetrics.varDaily.toFixed(2)}`);
      console.log(
        `   VaR (1 Woche, 95%): $${riskMetrics.varWeekly.toFixed(2)}`,
      );
      console.log(`   Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(2)}`);
      console.log(`   Sortino Ratio: ${riskMetrics.sortinoRatio.toFixed(2)}`);
      console.log(
        `   Max Drawdown: ${(riskMetrics.maxDrawdown * 100).toFixed(2)}%`,
      );
      console.log(
        `   Volatilität: ${(riskMetrics.volatility * 100).toFixed(2)}%`,
      );
      console.log(`   Beta: ${riskMetrics.beta.toFixed(2)}`);
      console.log(
        `   Konzentrations-Risiko: ${(riskMetrics.concentrationRisk * 100).toFixed(2)}%`,
      );
      console.log("");

      if (riskAssessment.alerts.length > 0) {
        console.log("🚨 Aktive Risiko-Warnungen:");
        riskAssessment.alerts.forEach((alert) => {
          const icon =
            alert.severity === "CRITICAL"
              ? "🔴"
              : alert.severity === "HIGH"
                ? "🟠"
                : "🟡";
          console.log(`   ${icon} ${alert.type}: ${alert.message}`);
          console.log(
            `      Wert: ${alert.value} | Grenzwert: ${alert.threshold}`,
          );
        });
        console.log("");
      }

      if (riskAssessment.recommendations.length > 0) {
        console.log("💡 Risiko-Management Empfehlungen:");
        riskAssessment.recommendations.forEach((rec) => {
          console.log(`   • ${rec}`);
        });
      }
    } catch (error) {
      console.log("❌ Fehler bei der Risiko-Analyse");
      this.logger.error("Fehler bei der Risiko-Analyse", error);
    }
  }

  /**
   * Dashboard Command - Zeigt System-Übersicht
   */
  private async handleDashboardCommand(): Promise<void> {
    console.log("🎯 KAIROS Dashboard");
    console.log("===================");
    console.log("");

    try {
      // System Status
      console.log("🖥️ System Status:");
      const trainingStatus = this.mlPredictionService.getTrainingStatus();
      if (trainingStatus.isTraining) {
        console.log("   🟢 ML-Training läuft");
        if (trainingStatus.currentEpoch && trainingStatus.totalEpochs) {
          const progress = (
            (trainingStatus.currentEpoch / trainingStatus.totalEpochs) *
            100
          ).toFixed(1);
          console.log(`   📈 Fortschritt: ${progress}%`);
        }
      } else {
        console.log("   🔴 ML-Training inaktiv");
      }
      console.log(
        `   🔄 Persistent Mode: ${this.persistentMode ? "Aktiv" : "Inaktiv"}`,
      );
      console.log("");

      // Verfolgte Aktien
      const stocks = await this.prismaService.stock.findMany();
      console.log(`📊 Verfolgte Aktien: ${stocks.length}`);
      if (stocks.length > 0) {
        const recentStocks = stocks.slice(0, 5);
        recentStocks.forEach((stock) => {
          console.log(`   📈 ${stock.ticker} - ${stock.name}`);
        });
        if (stocks.length > 5) {
          console.log(`   ... und ${stocks.length - 5} weitere`);
        }
      }
      console.log("");

      // Portfolio-Übersicht
      const portfolios = await this.portfolioService.getAllPortfolios();
      console.log(`💼 Portfolios: ${portfolios.length}`);
      if (portfolios.length > 0) {
        for (const portfolio of portfolios.slice(0, 3)) {
          try {
            const metrics =
              await this.portfolioService.calculatePortfolioMetrics(portfolio);
            console.log(
              `   📊 ${portfolio.name}: $${metrics.totalValue.toFixed(2)} (${(metrics.totalReturn * 100).toFixed(2)}%)`,
            );
          } catch (error) {
            console.log(
              `   📊 ${portfolio.name}: Fehler beim Laden der Metriken`,
            );
          }
        }
        if (portfolios.length > 3) {
          console.log(`   ... und ${portfolios.length - 3} weitere`);
        }
      }
      console.log("");

      // Neueste Daten
      const latestData = await this.prismaService.historicalData.findFirst({
        orderBy: { timestamp: "desc" },
        include: { stock: true },
      });

      if (latestData) {
        console.log("📅 Neueste Daten:");
        console.log(
          `   📈 ${latestData.stock.ticker}: $${latestData.close.toFixed(2)}`,
        );
        console.log(`   🕐 ${latestData.timestamp.toLocaleDateString()}`);
      }
      console.log("");

      // Schnelle Aktionen
      console.log("🚀 Schnelle Aktionen:");
      console.log("   • kairos track <TICKER> - Aktie hinzufügen");
      console.log("   • kairos predict <TICKER> - Vorhersage erstellen");
      console.log("   • kairos portfolio-create <NAME> - Portfolio erstellen");
      console.log("   • kairos train-start - ML-Training starten");
      console.log("   • kairos help - Alle Befehle anzeigen");
    } catch (error) {
      console.log("❌ Fehler beim Laden des Dashboards");
      this.logger.error("Fehler beim Dashboard", error);
    }
  }
}
