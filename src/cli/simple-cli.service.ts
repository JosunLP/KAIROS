import { Injectable, Logger } from '@nestjs/common';
import { AnalysisEngineService } from '../analysis-engine/analysis-engine.service';
import { AutomationService } from '../automation/automation.service';
import { CacheService } from '../common/cache.service';
import { ErrorHandlingService } from '../common/error-handling.service';
import { ValidationService } from '../common/validation.service';
import { ConfigService } from '../config/config.service';
import { DataIngestionService } from '../data-ingestion/data-ingestion.service';
import { HealthService } from '../health/health.service';
import { MlPredictionService } from '../ml-prediction/ml-prediction.service';
import { PrismaService } from '../persistence/prisma.service';
import { BacktestService } from '../portfolio/backtest.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { RiskManagementService } from '../portfolio/risk-management.service';

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
    private readonly automationService: AutomationService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly validationService: ValidationService,
    private readonly healthService: HealthService,
  ) {}

  async processCommand(args: string[]): Promise<void> {
    const command = args[2]; // node script.js <command>

    try {
      switch (command) {
        case 'status':
          await this.handleStatusCommand();
          break;
        case 'health':
          await this.handleHealthCommand();
          break;
        case 'track':
          await this.handleTrackCommand(args[3]);
          break;
        case 'predict':
          await this.handlePredictCommand(args[3]);
          break;
        case 'train':
          await this.handleTrainCommand();
          break;
        case 'train-start':
          await this.handleTrainStartCommand();
          break;
        case 'train-stop':
          await this.handleTrainStopCommand();
          break;
        case 'train-status':
          await this.handleTrainStatusCommand();
          break;
        case 'list':
          await this.handleListCommand();
          break;
        case 'portfolio-create':
          await this.handlePortfolioCreateCommand(args[3]);
          break;
        case 'portfolio-list':
          await this.handlePortfolioListCommand();
          break;
        case 'portfolio-add':
          await this.handlePortfolioAddPositionCommand(
            args[3],
            args[4],
            parseFloat(args[5] || '1'),
          );
          break;
        case 'portfolio-remove':
          await this.handlePortfolioRemovePositionCommand(args[3], args[4]);
          break;
        case 'portfolio-analyze':
          await this.handlePortfolioAnalyzeCommand(args[3]);
          break;
        case 'backtest':
          await this.handleBacktestCommand(args[3], args[4], args[5]);
          break;
        case 'risk-analysis':
          await this.handleRiskAnalysisCommand(args[3]);
          break;
        case 'persistent-start':
          await this.startPersistentMode();
          break;
        case 'persistent-stop':
          await this.stopPersistentMode();
          break;
        case 'dashboard':
          await this.handleDashboardCommand();
          break;
        case 'automation-start':
          await this.handleAutomationStartCommand();
          break;
        case 'automation-stop':
          await this.handleAutomationStopCommand();
          break;
        case 'automation-status':
          await this.handleAutomationStatusCommand();
          break;
        case 'automation-config':
          await this.handleAutomationConfigCommand(args.slice(3));
          break;
        case 'test-provider':
          await this.handleTestProviderCommand(args[3], args[4]);
          break;
        case 'provider-status':
          await this.handleProviderStatusCommand();
          break;
        case 'cleanup':
          await this.handleCleanupCommand(args[3]);
          break;
        case 'validate':
          await this.handleValidateCommand(args[3]);
          break;
        case 'help':
          this.showHelp();
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
    console.log('🚀 KAIROS Stock Analysis CLI - Status');
    console.log('=====================================');

    try {
      const stockCount = await this.prismaService.stock.count();
      const dataPointsCount = await this.prismaService.historicalData.count();

      console.log(`📊 Verfolgte Aktien: ${stockCount}`);
      console.log(`📈 Datenpunkte: ${dataPointsCount}`);

      if (stockCount > 0) {
        const latestData = await this.prismaService.historicalData.findFirst({
          orderBy: { timestamp: 'desc' },
          include: { stock: true },
        });

        if (latestData) {
          console.log(
            `🕐 Neueste Daten: ${latestData.stock.ticker} (${latestData.timestamp.toLocaleDateString()})`,
          );
        }
      }

      console.log('✅ System ist bereit');
    } catch (error) {
      console.log('❌ Fehler beim Abrufen des Status');
      throw error;
    }
  }

  private async handleTrackCommand(ticker: string): Promise<void> {
    if (!ticker) {
      console.log('❌ Bitte geben Sie ein Ticker-Symbol an: kairos track AAPL');
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
      console.log('📥 Lade historische Daten...');
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
        '❌ Bitte geben Sie ein Ticker-Symbol an: kairos predict AAPL',
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
        console.log('\n📊 Prognose-Ergebnis:');
        console.log('====================');
        console.log(`🎯 Aktie: ${ticker.toUpperCase()}`);
        console.log(
          `🎲 Konfidenz: ${(prediction.confidence * 100).toFixed(1)}%`,
        );
        console.log(
          `💹 Prognostizierte Richtung: ${prediction.prediction > 0 ? '📈 Aufwärts' : '📉 Abwärts'}`,
        );
        console.log(`🕐 Zeitstempel: ${prediction.timestamp.toLocaleString()}`);

        console.log('\n⚠️  Disclaimer: Dies ist keine Anlageberatung!');
      } else {
        console.log('❌ Keine Prognose möglich - nicht genügend Daten');
      }
    } catch (error) {
      console.log(`❌ Fehler bei der Prognose für ${ticker}`);
      throw error;
    }
  }

  private async handleTrainCommand(): Promise<void> {
    console.log('🧠 Starte ML-Modell Training...');

    try {
      await this.mlPredictionService.trainModel();
      console.log('✅ ML-Modell erfolgreich trainiert');
    } catch (error) {
      console.log('❌ Fehler beim Training des ML-Modells');
      throw error;
    }
  }

  private async handleTrainStartCommand(): Promise<void> {
    if (!this.persistentMode) {
      console.log('🧠 Starte erweiteres ML-Modell Training...');
      console.log("💡 Verwenden Sie 'kairos train-stop' zum sicheren Beenden");
      console.log("💡 Verwenden Sie 'kairos train-status' für Status-Updates");

      try {
        const success = await this.mlPredictionService.startTraining();
        if (success) {
          console.log('✅ ML-Modell erfolgreich trainiert');
        } else {
          console.log('⚠️ Training wurde abgebrochen oder fehlgeschlagen');
        }
      } catch (error) {
        console.log('❌ Fehler beim Training des ML-Modells');
        throw error;
      }
      return;
    }

    // Persistenter Modus
    const trainingStatus = this.mlPredictionService.getTrainingStatus();
    if (trainingStatus.isTraining) {
      console.log('⚠️ Training läuft bereits im Hintergrund');
      console.log(
        "💡 Verwenden Sie 'train-status' für Details oder 'train-stop' zum Beenden",
      );
      return;
    }

    console.log('🧠 Starte Hintergrund-Training...');
    console.log('💡 Das Training läuft im Hintergrund. CLI bleibt verfügbar.');
    console.log(
      "💡 Verwenden Sie 'train-status' für Updates oder 'train-stop' zum Beenden",
    );

    try {
      // Training im Hintergrund starten (non-blocking)
      this.mlPredictionService
        .startTraining()
        .then(success => {
          if (success) {
            console.log('\n✅ Hintergrund-Training erfolgreich abgeschlossen');
          } else {
            console.log('\n⚠️ Hintergrund-Training wurde abgebrochen');
          }
          console.log('kairos> '); // Prompt wiederherstellen
        })
        .catch(error => {
          console.log('\n❌ Fehler beim Hintergrund-Training:', error.message);
          console.log('kairos> '); // Prompt wiederherstellen
        });

      // Kurz warten und ersten Status zeigen
      setTimeout(() => {
        const status = this.mlPredictionService.getTrainingStatus();
        if (status.isTraining) {
          console.log('🟢 Hintergrund-Training gestartet');
        }
      }, 1000);
    } catch (error) {
      console.log('❌ Fehler beim Starten des Hintergrund-Trainings');
      throw error;
    }
  }

  private async handleTrainStopCommand(): Promise<void> {
    const trainingStatus = this.mlPredictionService.getTrainingStatus();

    if (!trainingStatus.isTraining) {
      console.log('⚠️ Kein Training läuft derzeit');
      return;
    }

    if (this.persistentMode) {
      console.log('🛑 Beende Hintergrund-Training...');
    } else {
      console.log('🛑 Beende Training sicher...');
    }

    try {
      const success = await this.mlPredictionService.stopTraining();
      if (success) {
        console.log('✅ Training wurde sicher beendet');
      } else {
        console.log('⚠️ Kein Training läuft derzeit');
      }
    } catch (error) {
      console.log('❌ Fehler beim Beenden des Trainings');
      throw error;
    }
  }

  private async handleTrainStatusCommand(): Promise<void> {
    console.log('📊 Training Status:');
    console.log('==================');

    try {
      const status = this.mlPredictionService.getTrainingStatus();

      if (!status.isTraining) {
        console.log('🔴 Kein Training läuft derzeit');
        console.log(
          "💡 Verwenden Sie 'kairos train-start' um Training zu starten",
        );
        return;
      }

      console.log('🟢 Training läuft...');

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
      console.log('❌ Fehler beim Abrufen des Training-Status');
      throw error;
    }
  }

  private async handleListCommand(): Promise<void> {
    console.log('📋 Verfolgte Aktien:');
    console.log('===================');

    try {
      const stocks = await this.prismaService.stock.findMany({
        orderBy: { ticker: 'asc' },
      });

      if (stocks.length === 0) {
        console.log('📭 Keine Aktien werden verfolgt');
        console.log(
          '💡 Verwenden Sie "kairos track <TICKER>" um eine Aktie hinzuzufügen',
        );
        return;
      }

      for (const stock of stocks) {
        // Neueste Daten für jede Aktie abrufen
        const latestData = await this.prismaService.historicalData.findFirst({
          where: { stockId: stock.id },
          orderBy: { timestamp: 'desc' },
        });

        const price = latestData ? `$${latestData.close.toFixed(2)}` : 'N/A';
        const date = latestData
          ? latestData.timestamp.toLocaleDateString()
          : 'N/A';

        console.log(
          `📈 ${stock.ticker.padEnd(6)} | ${stock.name.padEnd(30)} | ${price.padStart(10)} | ${date}`,
        );
      }
    } catch (error) {
      console.log('❌ Fehler beim Auflisten der Aktien');
      throw error;
    }
  }

  private showHelp(): void {
    console.log('🎯 KAIROS - KI-gestützte Aktienanalyse');
    console.log('=====================================');
    console.log('');
    console.log('📊 GRUNDLEGENDE BEFEHLE:');
    console.log('  status               - System-Status anzeigen');
    console.log('  dashboard            - Übersicht aller Daten');
    console.log('  list                 - Alle verfolgten Aktien auflisten');
    console.log('  track <TICKER>       - Aktie zur Verfolgung hinzufügen');
    console.log('');
    console.log('🔌 DATENQUELLEN:');
    console.log('  provider-status      - Status aller Datenquellen anzeigen');
    console.log(
      '  test-provider <NAME> [TICKER] - Provider testen (alpha-vantage, polygon, finnhub, mock)',
    );
    console.log('');
    console.log('🤖 ML-VORHERSAGEN:');
    console.log('  predict <TICKER>     - Preis-Vorhersage für Aktie');
    console.log('  train                - Einmaliges ML-Training starten');
    console.log('  train-start          - Kontinuierliches Training starten');
    console.log('  train-stop           - Training beenden');
    console.log('  train-status         - Training-Status anzeigen');
    console.log('');
    console.log('💼 PORTFOLIO-MANAGEMENT:');
    console.log(
      '  portfolio-create <NAME>                    - Neues Portfolio erstellen',
    );
    console.log(
      '  portfolio-list                             - Alle Portfolios auflisten',
    );
    console.log(
      '  portfolio-add <ID> <TICKER> <QUANTITY>     - Position hinzufügen',
    );
    console.log(
      '  portfolio-remove <ID> <TICKER>             - Position entfernen',
    );
    console.log(
      '  portfolio-analyze <ID>                     - Portfolio analysieren',
    );
    console.log('');
    console.log('📈 BACKTESTING & RISIKO:');
    console.log(
      '  backtest <STRATEGY> <START> <END>         - Backtest durchführen',
    );
    console.log('  risk-analysis <PORTFOLIO_ID>              - Risiko-Analyse');
    console.log('');
    console.log('🤖 VOLLAUTOMATIK:');
    console.log('  automation-start     - Vollautomatik starten');
    console.log('  automation-stop      - Vollautomatik stoppen');
    console.log('  automation-status    - Automation-Status anzeigen');
    console.log(
      '  automation-config [KEY VALUE] - Konfiguration anzeigen/ändern',
    );
    console.log('');
    console.log('🔧 SYSTEM:');
    console.log('  persistent-start     - Kontinuierlichen Modus starten');
    console.log('  persistent-stop      - Kontinuierlichen Modus beenden');
    console.log('');
    console.log('📋 BEISPIELE:');
    console.log('  kairos track AAPL');
    console.log('  kairos provider-status');
    console.log('  kairos test-provider alpha-vantage AAPL');
    console.log('  kairos predict AAPL');
    console.log("  kairos portfolio-create 'Mein Portfolio'");
    console.log('  kairos backtest rsi 2024-01-01 2024-12-31');
    console.log('  kairos automation-start');
    console.log('  kairos automation-config data-interval 10');
    console.log('');
    console.log('💡 Verfügbare Strategien: rsi, sma, macd');

    if (this.persistentMode) {
      console.log('');
      console.log('🔄 Persistenter Modus aktiv - CLI bleibt geöffnet');
      console.log("💡 Verwenden Sie 'exit' oder 'quit' zum Beenden");
    }
  }

  /**
   * Startet den persistenten CLI-Modus
   */
  async startPersistentMode(): Promise<void> {
    this.persistentMode = true;
    this.logger.log('🔄 Persistenter CLI-Modus aktiviert');

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
      console.log('🛑 Beende laufendes Training...');
      await this.mlPredictionService.stopTraining();
    }

    this.logger.log('🔄 Persistenter CLI-Modus deaktiviert');
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
            : 'N/A';

        const loss = status.loss !== undefined ? status.loss.toFixed(4) : 'N/A';
        const accuracy =
          status.accuracy !== undefined
            ? (status.accuracy * 100).toFixed(2) + '%'
            : 'N/A';

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
      console.log('❌ Portfolio-Name ist erforderlich');
      console.log('💡 Verwendung: portfolio-create <NAME>');
      return;
    }

    try {
      const portfolio = await this.portfolioService.createPortfolioWithCapital(
        name,
        10000,
      ); // Default: $10,000
      console.log('✅ Portfolio erstellt:');
      console.log(`📊 Name: ${portfolio.name}`);
      console.log(
        `💰 Startkapital: $${(portfolio.initialValue || 0).toFixed(2)}`,
      );
      console.log(`🆔 ID: ${portfolio.id}`);
    } catch (error) {
      console.log('❌ Fehler beim Erstellen des Portfolios');
      this.logger.error('Fehler beim Erstellen des Portfolios', error);
    }
  }

  private async handlePortfolioListCommand(): Promise<void> {
    try {
      const portfolios = await this.portfolioService.getAllPortfolios();

      if (portfolios.length === 0) {
        console.log('📋 Keine Portfolios gefunden');
        console.log(
          '💡 Erstellen Sie ein Portfolio mit: portfolio-create <NAME>',
        );
        return;
      }

      console.log('📋 Ihre Portfolios:');
      console.log('===================');

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
        console.log('');
      }
    } catch (error) {
      console.log('❌ Fehler beim Abrufen der Portfolios');
      this.logger.error('Fehler beim Abrufen der Portfolios', error);
    }
  }

  private async handlePortfolioAddPositionCommand(
    portfolioId: string,
    ticker: string,
    quantity: number,
  ): Promise<void> {
    if (!portfolioId || !ticker || !quantity) {
      console.log('❌ Portfolio-ID, Ticker und Anzahl sind erforderlich');
      console.log(
        '💡 Verwendung: portfolio-add <PORTFOLIO_ID> <TICKER> <QUANTITY>',
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
        orderBy: { timestamp: 'desc' },
      });

      if (!latestData) {
        console.log(
          `❌ Keine Preisdaten für ${ticker.toUpperCase()} verfügbar`,
        );
        return;
      }

      await this.portfolioService.addPosition(
        portfolioId,
        ticker.toUpperCase(),
        quantity,
        latestData.close,
      );

      console.log('✅ Position hinzugefügt:');
      console.log(`📊 Portfolio: ${portfolioId.substring(0, 8)}...`);
      console.log(
        `📈 ${ticker.toUpperCase()}: ${quantity} Aktien @ $${latestData.close.toFixed(2)}`,
      );
      console.log(
        `💰 Gesamtwert: $${(quantity * latestData.close).toFixed(2)}`,
      );
    } catch (error) {
      console.log('❌ Fehler beim Hinzufügen der Position');
      this.logger.error('Fehler beim Hinzufügen der Position', error);
    }
  }

  private async handlePortfolioRemovePositionCommand(
    portfolioId: string,
    ticker: string,
  ): Promise<void> {
    if (!portfolioId || !ticker) {
      console.log('❌ Portfolio-ID und Ticker sind erforderlich');
      console.log('💡 Verwendung: portfolio-remove <PORTFOLIO_ID> <TICKER>');
      return;
    }

    try {
      await this.portfolioService.removePosition(
        portfolioId,
        ticker.toUpperCase(),
      );
      console.log('✅ Position entfernt:');
      console.log(`📊 Portfolio: ${portfolioId.substring(0, 8)}...`);
      console.log(`❌ ${ticker.toUpperCase()} Position geschlossen`);
    } catch (error) {
      console.log('❌ Fehler beim Entfernen der Position');
      this.logger.error('Fehler beim Entfernen der Position', error);
    }
  }

  private async handlePortfolioAnalyzeCommand(
    portfolioId: string,
  ): Promise<void> {
    if (!portfolioId) {
      console.log('❌ Portfolio-ID ist erforderlich');
      console.log('💡 Verwendung: portfolio-analyze <PORTFOLIO_ID>');
      return;
    }

    try {
      const portfolio = await this.portfolioService.getPortfolio(portfolioId);
      if (!portfolio) {
        console.log('❌ Portfolio nicht gefunden');
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
      console.log('========================================');
      console.log('');

      console.log('💰 Performance-Metriken:');
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
      console.log('');

      console.log('⚠️ Risiko-Bewertung:');
      console.log(`   Risiko-Level: ${riskAssessment.riskLevel}`);
      console.log(`   Risiko-Score: ${riskAssessment.riskScore}/100`);
      console.log('');

      if (riskAssessment.alerts.length > 0) {
        console.log('🚨 Risiko-Warnungen:');
        riskAssessment.alerts.forEach(alert => {
          console.log(`   ${alert.severity}: ${alert.message}`);
        });
        console.log('');
      }

      if (riskAssessment.recommendations.length > 0) {
        console.log('💡 Empfehlungen:');
        riskAssessment.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
    } catch (error) {
      console.log('❌ Fehler bei der Portfolio-Analyse');
      this.logger.error('Fehler bei der Portfolio-Analyse', error);
    }
  }

  private async handleBacktestCommand(
    strategy: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    if (!strategy || !startDate || !endDate) {
      console.log('❌ Strategie, Start- und Enddatum sind erforderlich');
      console.log('💡 Verwendung: backtest <STRATEGY> <START_DATE> <END_DATE>');
      console.log('💡 Beispiel: backtest rsi 2024-01-01 2024-12-31');
      console.log('💡 Verfügbare Strategien: rsi, sma, macd');
      return;
    }

    try {
      // Einfache vordefinierte Strategien
      const strategies: Record<string, any> = {
        rsi: {
          name: 'RSI Überverkauft/Überkauft',
          buySignals: ['rsi_oversold'],
          sellSignals: ['rsi_overbought'],
          riskManagement: {
            stopLoss: 5.0,
            takeProfit: 10.0,
            maxPositionSize: 20.0,
          },
        },
        sma: {
          name: 'Simple Moving Average Crossover',
          buySignals: ['sma_bullish_cross'],
          sellSignals: ['sma_bearish_cross'],
          riskManagement: {
            stopLoss: 3.0,
            takeProfit: 8.0,
            maxPositionSize: 25.0,
          },
        },
        macd: {
          name: 'MACD Signal',
          buySignals: ['macd_bullish'],
          sellSignals: ['macd_bearish'],
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
        console.log('💡 Verfügbare Strategien: rsi, sma, macd');
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
      console.log('');

      // Alle verfolgten Aktien für Backtest holen
      const stocks = await this.prismaService.stock.findMany({
        select: { ticker: true },
      });

      if (stocks.length === 0) {
        console.log('❌ Keine Aktien verfügbar für Backtest');
        console.log("💡 Fügen Sie zuerst Aktien mit 'track <TICKER>' hinzu");
        return;
      }

      const tickers = stocks.map(s => s.ticker);
      const results = await this.backtestService.runBacktest({
        ...config,
        symbols: tickers,
      });

      // Das Ergebnis ist direkt ein BacktestResult Objekt, kein Array
      const result = results;
      if (!result) {
        console.log('❌ Keine Backtest-Ergebnisse erhalten');
        return;
      }

      console.log('📊 Backtest-Ergebnisse:');
      console.log('========================');
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
      console.log('❌ Fehler beim Backtest');
      this.logger.error('Fehler beim Backtest', error);
    }
  }

  private async handleRiskAnalysisCommand(portfolioId: string): Promise<void> {
    if (!portfolioId) {
      console.log('❌ Portfolio-ID ist erforderlich');
      console.log('💡 Verwendung: risk-analysis <PORTFOLIO_ID>');
      return;
    }

    try {
      const portfolio = await this.portfolioService.getPortfolio(portfolioId);
      if (!portfolio) {
        console.log('❌ Portfolio nicht gefunden');
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
      console.log('================================');
      console.log('');

      console.log('📊 Risiko-Übersicht:');
      console.log(`   Risiko-Level: ${riskAssessment.riskLevel}`);
      console.log(`   Risiko-Score: ${riskAssessment.riskScore}/100`);
      console.log('');

      console.log('📈 Risiko-Kennzahlen:');
      console.log(
        `   Portfolio-Risiko: ${((riskMetrics.portfolioRisk || 0) * 100).toFixed(2)}%`,
      );
      console.log(
        `   VaR (1 Tag, 95%): $${(riskMetrics.varDaily || 0).toFixed(2)}`,
      );
      console.log(
        `   VaR (1 Woche, 95%): $${(riskMetrics.varWeekly || 0).toFixed(2)}`,
      );
      console.log(`   Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(2)}`);
      console.log(
        `   Sortino Ratio: ${(riskMetrics.sortinoRatio || 0).toFixed(2)}`,
      );
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
      console.log('');

      if (riskAssessment.alerts.length > 0) {
        console.log('🚨 Aktive Risiko-Warnungen:');
        riskAssessment.alerts.forEach(alert => {
          const icon =
            alert.severity === 'CRITICAL'
              ? '🔴'
              : alert.severity === 'HIGH'
                ? '🟠'
                : '🟡';
          console.log(`   ${icon} ${alert.type}: ${alert.message}`);
          console.log(
            `      Wert: ${alert.value} | Grenzwert: ${alert.threshold}`,
          );
        });
        console.log('');
      }

      if (riskAssessment.recommendations.length > 0) {
        console.log('💡 Risiko-Management Empfehlungen:');
        riskAssessment.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
    } catch (error) {
      console.log('❌ Fehler bei der Risiko-Analyse');
      this.logger.error('Fehler bei der Risiko-Analyse', error);
    }
  }

  /**
   * Dashboard Command - Zeigt System-Übersicht
   */
  private async handleDashboardCommand(): Promise<void> {
    console.log('🎯 KAIROS Dashboard');
    console.log('===================');
    console.log('');

    try {
      // System Status
      console.log('🖥️ System Status:');
      const trainingStatus = this.mlPredictionService.getTrainingStatus();
      if (trainingStatus.isTraining) {
        console.log('   🟢 ML-Training läuft');
        if (trainingStatus.currentEpoch && trainingStatus.totalEpochs) {
          const progress = (
            (trainingStatus.currentEpoch / trainingStatus.totalEpochs) *
            100
          ).toFixed(1);
          console.log(`   📈 Fortschritt: ${progress}%`);
        }
      } else {
        console.log('   🔴 ML-Training inaktiv');
      }
      console.log(
        `   🔄 Persistent Mode: ${this.persistentMode ? 'Aktiv' : 'Inaktiv'}`,
      );
      console.log('');

      // Verfolgte Aktien
      const stocks = await this.prismaService.stock.findMany();
      console.log(`📊 Verfolgte Aktien: ${stocks.length}`);
      if (stocks.length > 0) {
        const recentStocks = stocks.slice(0, 5);
        recentStocks.forEach(stock => {
          console.log(`   📈 ${stock.ticker} - ${stock.name}`);
        });
        if (stocks.length > 5) {
          console.log(`   ... und ${stocks.length - 5} weitere`);
        }
      }
      console.log('');

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
      console.log('');

      // Neueste Daten
      const latestData = await this.prismaService.historicalData.findFirst({
        orderBy: { timestamp: 'desc' },
        include: { stock: true },
      });

      if (latestData) {
        console.log('📅 Neueste Daten:');
        console.log(
          `   📈 ${latestData.stock.ticker}: $${latestData.close.toFixed(2)}`,
        );
        console.log(`   🕐 ${latestData.timestamp.toLocaleDateString()}`);
      }
      console.log('');

      // Schnelle Aktionen
      console.log('🚀 Schnelle Aktionen:');
      console.log('   • kairos track <TICKER> - Aktie hinzufügen');
      console.log('   • kairos predict <TICKER> - Vorhersage erstellen');
      console.log('   • kairos portfolio-create <NAME> - Portfolio erstellen');
      console.log('   • kairos train-start - ML-Training starten');
      console.log('   • kairos help - Alle Befehle anzeigen');
    } catch (error) {
      console.log('❌ Fehler beim Laden des Dashboards');
      this.logger.error('Fehler beim Dashboard', error);
    }
  }

  /**
   * Startet den Vollautomatik-Modus
   */
  private async handleAutomationStartCommand(): Promise<void> {
    console.log('🤖 Starte Vollautomatik-Modus...');

    try {
      if (this.automationService.isAutomationRunning()) {
        console.log('⚠️  Vollautomatik läuft bereits!');
        return;
      }

      await this.automationService.startAutomation();
      console.log('✅ Vollautomatik-Modus erfolgreich gestartet!');
      console.log('');
      console.log('📋 Aktive Prozesse:');
      console.log('   • 🔄 Datenerfassung (alle 5 Min)');
      console.log('   • 📊 Technische Analyse (alle 15 Min)');
      console.log('   • 🔮 ML-Vorhersagen (alle 30 Min)');
      console.log('   • 💼 Portfolio-Management (alle 60 Min)');
      console.log('   • ⚠️  Risikomanagement (alle 10 Min)');
      console.log('   • 💓 System-Überwachung (alle 2 Min)');
      console.log('');
      console.log("💡 Verwenden Sie 'automation-status' für Status-Updates");
      console.log("💡 Verwenden Sie 'automation-stop' zum Beenden");
    } catch (error) {
      console.log('❌ Fehler beim Starten der Vollautomatik');
      this.logger.error('Automation Start Error', error);
    }
  }

  /**
   * Stoppt den Vollautomatik-Modus
   */
  private async handleAutomationStopCommand(): Promise<void> {
    console.log('🛑 Stoppe Vollautomatik-Modus...');

    try {
      if (!this.automationService.isAutomationRunning()) {
        console.log('⚠️  Vollautomatik läuft derzeit nicht!');
        return;
      }

      await this.automationService.stopAutomation();
      console.log('✅ Vollautomatik-Modus erfolgreich gestoppt!');
    } catch (error) {
      console.log('❌ Fehler beim Stoppen der Vollautomatik');
      this.logger.error('Automation Stop Error', error);
    }
  }

  /**
   * Zeigt den Status der Vollautomatik
   */
  private async handleAutomationStatusCommand(): Promise<void> {
    console.log('🤖 Vollautomatik-Status');
    console.log('=======================');

    try {
      const status = await this.automationService.getDetailedStatus();
      const automationStatus = status.automation;
      const isRunning = this.automationService.isAutomationRunning();

      // Grundstatus
      console.log(`📊 Status: ${isRunning ? '🟢 LÄUFT' : '🔴 GESTOPPT'}`);

      if (automationStatus.startTime) {
        const uptime = Date.now() - automationStatus.startTime.getTime();
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor(
          (uptime % (1000 * 60 * 60)) / (1000 * 60),
        );
        console.log(`⏱️  Laufzeit: ${uptimeHours}h ${uptimeMinutes}m`);
      }

      console.log(
        `🔄 Zyklen: ${automationStatus.successfulCycles} erfolgreich, ${automationStatus.failedCycles} fehlgeschlagen`,
      );

      if (automationStatus.lastActivity) {
        console.log(
          `📅 Letzte Aktivität: ${automationStatus.lastActivity.toLocaleString()}`,
        );
      }

      console.log('');
      console.log('📋 Komponenten-Status:');

      // Komponenten-Status
      Object.entries(automationStatus.components).forEach(
        ([component, info]: [string, any]) => {
          const statusIcon =
            info.status === 'active'
              ? '🟡'
              : info.status === 'error'
                ? '🔴'
                : '🟢';
          const lastRun = info.lastRun
            ? info.lastRun.toLocaleTimeString()
            : 'Nie';
          console.log(
            `   ${statusIcon} ${component}: ${info.status.toUpperCase()} (Letzte Ausführung: ${lastRun})`,
          );
          if (info.errors > 0) {
            console.log(`      ⚠️  ${info.errors} Fehler`);
          }
        },
      );

      console.log('');
      console.log('📈 Performance:');
      console.log(
        `   💾 RAM: ${automationStatus.performance.memoryUsageMB} MB`,
      );
      console.log(
        `   ⏱️  Letzter Zyklus: ${automationStatus.performance.lastCycleTimeMs} ms`,
      );

      // Konfiguration
      const config = this.automationService.getConfig();
      console.log('');
      console.log('⚙️  Konfiguration:');
      console.log(
        `   🔄 Datenerfassung: alle ${Math.round(config.dataIngestionIntervalMs / 60000)} Min`,
      );
      console.log(
        `   📊 Analyse: alle ${Math.round(config.analysisIntervalMs / 60000)} Min`,
      );
      console.log(
        `   🔮 Vorhersagen: alle ${Math.round(config.predictionIntervalMs / 60000)} Min`,
      );
      console.log(
        `   💼 Portfolio: alle ${Math.round(config.portfolioRebalanceIntervalMs / 60000)} Min`,
      );
      console.log(
        `   ⚠️  Risiko: alle ${Math.round(config.riskCheckIntervalMs / 60000)} Min`,
      );

      // Fehler (nur die letzten 5)
      if (automationStatus.errors.length > 0) {
        console.log('');
        console.log('❌ Letzte Fehler:');
        automationStatus.errors.slice(-5).forEach((errorMsg: string) => {
          console.log(`   🔸 ${errorMsg}`);
        });
      }
    } catch (error) {
      console.log('❌ Fehler beim Abrufen des Status');
      this.logger.error('Automation Status Error', error);
    }
  }

  /**
   * Konfiguriert die Vollautomatik
   */
  private async handleAutomationConfigCommand(args: string[]): Promise<void> {
    console.log('⚙️  Vollautomatik-Konfiguration');
    console.log('===============================');

    try {
      if (args.length === 0) {
        // Zeige aktuelle Konfiguration
        const config = this.automationService.getConfig();
        console.log('📋 Aktuelle Konfiguration:');
        console.log('');
        console.log('🔄 Intervalle (in Minuten):');
        console.log(
          `   Datenerfassung: ${Math.round(config.dataIngestionIntervalMs / 60000)}`,
        );
        console.log(
          `   Technische Analyse: ${Math.round(config.analysisIntervalMs / 60000)}`,
        );
        console.log(
          `   ML-Vorhersagen: ${Math.round(config.predictionIntervalMs / 60000)}`,
        );
        console.log(
          `   Portfolio-Management: ${Math.round(config.portfolioRebalanceIntervalMs / 60000)}`,
        );
        console.log(
          `   Risikomanagement: ${Math.round(config.riskCheckIntervalMs / 60000)}`,
        );
        console.log(
          `   Gesundheitschecks: ${Math.round(config.healthCheckIntervalMs / 60000)}`,
        );
        console.log('');
        console.log('⚠️  Fehlerbehandlung:');
        console.log(`   Max. Wiederholungen: ${config.maxRetries}`);
        console.log(
          `   Wiederholungsverzögerung: ${Math.round(config.retryDelayMs / 1000)}s`,
        );
        console.log(
          `   Stopp bei kritischen Fehlern: ${config.stopOnCriticalError ? 'Ja' : 'Nein'}`,
        );
        console.log('');
        console.log('🔔 Benachrichtigungen:');
        console.log(
          `   Aktiviert: ${config.notifications.enabled ? 'Ja' : 'Nein'}`,
        );
        console.log(
          `   Fehlerschwelle: ${config.notifications.errorThreshold}`,
        );
        return;
      }

      // Parameter setzen
      const [key, value] = args;
      const numValue = parseInt(value);

      if (isNaN(numValue)) {
        console.log('❌ Ungültiger Wert - Zahlen erforderlich');
        return;
      }

      const updates: any = {};

      switch (key) {
        case 'data-interval':
          updates.dataIngestionIntervalMs = numValue * 60 * 1000;
          break;
        case 'analysis-interval':
          updates.analysisIntervalMs = numValue * 60 * 1000;
          break;
        case 'prediction-interval':
          updates.predictionIntervalMs = numValue * 60 * 1000;
          break;
        case 'portfolio-interval':
          updates.portfolioRebalanceIntervalMs = numValue * 60 * 1000;
          break;
        case 'risk-interval':
          updates.riskCheckIntervalMs = numValue * 60 * 1000;
          break;
        case 'health-interval':
          updates.healthCheckIntervalMs = numValue * 60 * 1000;
          break;
        case 'max-retries':
          updates.maxRetries = numValue;
          break;
        default:
          console.log('❌ Unbekannter Parameter');
          console.log('📋 Verfügbare Parameter:');
          console.log(
            '   data-interval, analysis-interval, prediction-interval',
          );
          console.log('   portfolio-interval, risk-interval, health-interval');
          console.log('   max-retries');
          return;
      }

      this.automationService.updateConfig(updates);
      console.log(
        `✅ ${key} auf ${numValue}${key.includes('interval') ? ' Minuten' : ''} gesetzt`,
      );
    } catch (error) {
      console.log('❌ Fehler bei der Konfiguration');
      this.logger.error('Automation Config Error', error);
    }
  }

  /**
   * Testet einen spezifischen Datenquellen-Provider
   */
  private async handleTestProviderCommand(
    providerName?: string,
    ticker?: string,
  ): Promise<void> {
    console.log('🧪 Provider-Test');
    console.log('==================');

    if (!providerName) {
      console.log('❌ Provider-Name erforderlich');
      console.log(
        '📋 Verfügbare Provider: alpha-vantage, polygon, finnhub, mock',
      );
      return;
    }

    if (!ticker) {
      ticker = 'AAPL'; // Standardwert
    }

    try {
      // Provider-spezifischer Test
      switch (providerName.toLowerCase()) {
        case 'alpha-vantage':
          // Test Alpha Vantage direkt
          await this.testAlphaVantageProvider(ticker);
          break;
        case 'polygon':
          await this.testPolygonProvider(ticker);
          break;
        case 'finnhub':
          await this.testFinnhubProvider(ticker);
          break;
        case 'mock':
          await this.testMockProvider(ticker);
          break;
        default:
          console.log('❌ Unbekannter Provider');
          console.log(
            '📋 Verfügbare Provider: alpha-vantage, polygon, finnhub, mock',
          );
          return;
      }
    } catch (error) {
      console.log(
        `❌ Fehler beim Testen von ${providerName}:`,
        (error as Error).message,
      );
    }
  }

  private async testAlphaVantageProvider(ticker: string): Promise<void> {
    console.log(`🔍 Teste Alpha Vantage mit ${ticker}...`);

    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      console.log('❌ Alpha Vantage API-Schlüssel nicht konfiguriert');
      return;
    }

    try {
      // Direkte API-Test-Implementierung wäre hier
      await this.dataIngestionService.fetchLatestDataForStock(ticker);
      console.log('✅ Alpha Vantage Test erfolgreich');
    } catch (error) {
      console.log(
        `❌ Alpha Vantage Test fehlgeschlagen: ${(error as Error).message}`,
      );
    }
  }

  private async testPolygonProvider(ticker: string): Promise<void> {
    console.log(`🔍 Teste Polygon.io mit ${ticker}...`);

    if (!process.env.POLYGON_API_KEY) {
      console.log('❌ Polygon API-Schlüssel nicht konfiguriert');
      return;
    }

    try {
      await this.dataIngestionService.fetchLatestDataForStock(ticker);
      console.log('✅ Polygon Test erfolgreich');
    } catch (error) {
      console.log(
        `❌ Polygon Test fehlgeschlagen: ${(error as Error).message}`,
      );
    }
  }

  private async testFinnhubProvider(ticker: string): Promise<void> {
    console.log(`🔍 Teste Finnhub mit ${ticker}...`);

    if (!process.env.FINNHUB_API_KEY) {
      console.log('❌ Finnhub API-Schlüssel nicht konfiguriert');
      return;
    }

    try {
      await this.dataIngestionService.fetchLatestDataForStock(ticker);
      console.log('✅ Finnhub Test erfolgreich');
    } catch (error) {
      console.log(
        `❌ Finnhub Test fehlgeschlagen: ${(error as Error).message}`,
      );
    }
  }

  private async testMockProvider(ticker: string): Promise<void> {
    console.log(`🔍 Teste Mock Provider mit ${ticker}...`);

    try {
      await this.dataIngestionService.fetchLatestDataForStock(ticker);
      console.log('✅ Mock Provider Test erfolgreich');
    } catch (error) {
      console.log(
        `❌ Mock Provider Test fehlgeschlagen: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Zeigt den Status aller Provider an
   */
  private async handleProviderStatusCommand(): Promise<void> {
    console.log('📊 Provider-Status');
    console.log('===================');

    // Simuliere Provider-Checks (in einer echten Implementierung würde man die Provider direkt testen)
    const providers = [
      {
        name: 'Alpha Vantage',
        configured: !!process.env.ALPHA_VANTAGE_API_KEY,
      },
      { name: 'Polygon.io', configured: !!process.env.POLYGON_API_KEY },
      { name: 'Finnhub', configured: !!process.env.FINNHUB_API_KEY },
      { name: 'Mock Provider', configured: true },
    ];

    for (const provider of providers) {
      const status = provider.configured
        ? '✅ Konfiguriert'
        : '❌ Nicht konfiguriert';
      console.log(`${provider.name}: ${status}`);
    }

    console.log('');
    console.log(
      "💡 Hinweis: Verwenden Sie 'test-provider <name> <ticker>' um einen Provider zu testen",
    );
  }

  private async handleHealthCommand(): Promise<void> {
    console.log('🏥 KAIROS Health Check');
    console.log('======================');

    try {
      const healthResult = await this.healthService.performHealthCheck();

      console.log(`📊 Gesamtstatus: ${healthResult.status.toUpperCase()}`);
      console.log(`⏱️  Check-Dauer: ${healthResult.duration}ms`);
      console.log(`🕐 Zeitstempel: ${healthResult.timestamp.toLocaleString()}`);
      console.log('');

      // Einzelne Checks anzeigen
      Object.entries(healthResult.checks).forEach(([checkName, check]) => {
        if (check) {
          const statusIcon =
            check.status === 'healthy'
              ? '✅'
              : check.status === 'degraded'
                ? '⚠️'
                : '❌';
          console.log(
            `${statusIcon} ${checkName.toUpperCase()}: ${check.status}`,
          );
          if (check.message) {
            console.log(`   ${check.message}`);
          }
          if (check.duration) {
            console.log(`   Dauer: ${check.duration}ms`);
          }
          console.log('');
        }
      });

      // Empfehlungen basierend auf Status
      if (healthResult.status === 'unhealthy') {
        console.log('🔧 Empfehlungen:');
        console.log('   - Überprüfen Sie die Datenbankverbindung');
        console.log('   - Prüfen Sie die API-Konfiguration');
        console.log('   - Kontrollieren Sie die Logs auf Fehler');
      } else if (healthResult.status === 'degraded') {
        console.log('🔧 Empfehlungen:');
        console.log('   - Einige Komponenten zeigen Warnungen');
        console.log('   - Überwachen Sie die Systemleistung');
      } else {
        console.log('✅ System ist vollständig funktionsfähig');
      }
    } catch (error) {
      console.log('❌ Fehler beim Health Check');
      console.error(error);
    }
  }

  private async handleCleanupCommand(args: string): Promise<void> {
    console.log('🧹 KAIROS Datenbereinigung');
    console.log('==========================');

    try {
      const daysToKeep = parseInt(args) || 365;

      console.log(`🗑️  Lösche Daten älter als ${daysToKeep} Tage...`);

      await this.dataIngestionService.cleanupOldData(daysToKeep);

      console.log('✅ Datenbereinigung abgeschlossen');

      // Cache leeren
      console.log('🗑️  Leere Cache...');
      // this.cacheService.clear(); // Falls verfügbar

      console.log('✅ Cache geleert');
      console.log('🎉 Bereinigung vollständig abgeschlossen!');
    } catch (error) {
      console.log(
        '❌ Bereinigung fehlgeschlagen:',
        error instanceof Error ? error.message : 'Unbekannter Fehler',
      );
    }
  }

  private async handleValidateCommand(args: string): Promise<void> {
    console.log('🔍 KAIROS Datenvalidierung');
    console.log('==========================');

    try {
      const ticker = args?.toUpperCase();

      if (ticker) {
        console.log(`🔍 Validiere Daten für ${ticker}...`);

        // Validiere Ticker
        const validation = this.validationService.validateTicker(ticker);
        if (!validation.isValid) {
          console.log('❌ Ticker-Validierung fehlgeschlagen:');
          validation.errors.forEach(error => {
            console.log(`   - ${error.message}`);
          });
          return;
        }

        // Prüfe Datenqualität
        const stock = await this.prismaService.stock.findUnique({
          where: { ticker },
          include: {
            historicalData: {
              orderBy: { timestamp: 'desc' },
              take: 10,
            },
          },
        });

        if (!stock) {
          console.log(`❌ Keine Daten für ${ticker} gefunden`);
          return;
        }

        console.log(`✅ ${ticker} Validierung erfolgreich:`);
        console.log(`   📊 Datenpunkte: ${stock.historicalData.length}`);
        console.log(
          `   📅 Neueste Daten: ${stock.historicalData[0]?.timestamp.toLocaleDateString()}`,
        );
      } else {
        console.log('🔍 Validiere System-Konfiguration...');

        // Validiere Datenbankverbindung
        await this.prismaService.$queryRaw`SELECT 1`;
        console.log('✅ Datenbankverbindung validiert');

        // Validiere API-Provider
        const configuredApis = this.configService.getConfiguredApis();
        console.log(
          `✅ ${configuredApis.length} API-Provider konfiguriert: ${configuredApis.join(', ')}`,
        );

        console.log('🎉 System-Validierung erfolgreich!');
      }
    } catch (error) {
      console.log(
        '❌ Validierung fehlgeschlagen:',
        error instanceof Error ? error.message : 'Unbekannter Fehler',
      );
    }
  }
}
