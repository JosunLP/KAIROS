# Projekt KAIROS: Konzept für eine KI-gestützte Aktienanalyse-CLI

## 1. Philosophische und Architektonische Grundpfeiler

Auf Enterprise-Niveau definieren wir zuerst die nicht-funktionalen Anforderungen:

* **Modularität:** Jede Komponente (Datenerfassung, Analyse, ML, CLI) ist ein eigenständiges Modul. Dies ermöglicht unabhängige Entwicklung, Tests und Wartung. **NestJS** ist hierfür die perfekte Wahl, da es auf diesem Prinzip aufbaut.
* **Skalierbarkeit:** Obwohl es als lokale CLI startet, sollte die Architektur es ermöglichen, einzelne Teile (z.B. die Datenverarbeitung) später in die Cloud (z.B. Azure Functions, wie du es bereits kennst) auszulagern.
* **Testbarkeit:** Jedes Modul muss durch Unit- und Integrationstests abgedeckt sein. Dependency Injection (ein Kernfeature von NestJS) ist hier der Schlüssel.
* **Resilienz:** Das System muss mit Fehlern (API-Ausfälle, fehlerhafte Daten, etc.) umgehen können, ohne abzustürzen. Logging und Wiederholungsmechanismen sind entscheidend.
* **Konfigurierbarkeit:** Keine hartcodierten Werte. API-Schlüssel, Ticker-Listen, Strategieparameter – alles muss extern konfigurierbar sein.

## 2. Technologiestack & Begründung

* **Runtime/Framework:** **Node.js mit NestJS**.
  * *Warum?* Bietet eine strukturierte, meinungsstarke Architektur, die an Angular und ASP.NET Core erinnert. Perfekt für deine Erfahrung. Dependency Injection, Module und eine saubere Trennung der Belange sind von Haus aus gegeben.
* **Sprache:** **TypeScript**.
  * *Warum?* Typsicherheit ist für ein datenintensives Projekt dieser Komplexität unerlässlich, um Laufzeitfehler zu minimieren.
* **Datenbank:** **SQLite mit Prisma**.
  * *Warum SQLite?* Es ist serverlos, dateibasiert und extrem schnell für lokale Anwendungsfälle. Es erfordert kein separates Setup und die Datenbank ist eine einfache Datei, die leicht gesichert werden kann.
  * *Warum Prisma?* Prisma bietet eine erstklassige TypeScript-Erfahrung mit Auto-Vervollständigung und Typsicherheit für Datenbankabfragen. Es ist moderner und oft einfacher zu handhaben als TypeORM, besonders für neue Projekte.
* **Machine Learning:** **TensorFlow.js** (im Node.js Backend).
  * *Warum?* Es ist das führende ML-Framework für JavaScript/TypeScript und kann direkt in deiner Node.js-Anwendung ohne Python-Bridge ausgeführt werden.
* **CLI-Framework:** **Commander.js** & **Inquirer.js**.
  * *Warum?* Commander ist der De-facto-Standard für die Erstellung von Befehlszeilenschnittstellen in Node.js. Inquirer.js kann für interaktive Abfragen (z.B. Konfiguration) hinzugefügt werden.
* **Scheduling:** **node-cron**.
  * *Warum?* Eine einfache und robuste Bibliothek, um wiederkehrende Aufgaben (z.B. Datenabruf) direkt in der Anwendung zu planen.

## 3. Architektur-Übersicht: Die NestJS-Module

Deine NestJS-Anwendung wird aus mehreren Kernmodulen bestehen:

```structure
/src
|-- app.module.ts
|
|-- cli/
|   |-- cli.module.ts       # Definiert die CLI-Befehle (Commander.js)
|   |-- cli.service.ts
|
|-- data-ingestion/
|   |-- data-ingestion.module.ts
|   |-- data-ingestion.service.ts # Holt Daten von externen APIs
|
|-- persistence/
|   |-- persistence.module.ts
|   |-- prisma.service.ts     # Prisma-Client-Wrapper
|   |-- schemas/              # Prisma-Schema-Definition
|
|-- analysis-engine/
|   |-- analysis-engine.module.ts
|   |-- analysis-engine.service.ts # Berechnet technische Indikatoren
|
|-- ml-prediction/
|   |-- ml-prediction.module.ts
|   |-- ml-prediction.service.ts # Trainiert Modelle und erstellt Prognosen
|
|-- scheduling/
|   |-- scheduling.module.ts
|   |-- tasks.service.ts      # Definiert die Cron-Jobs
|
`-- config/
    |-- config.module.ts
    |-- config.service.ts     # Lädt Konfiguration aus .env-Dateien
```

---

## 4. Detailausarbeitung der Module

### **a) Persistence Module (Datenbank)**

* **Schema (`schema.prisma`):**

    ```prisma
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "sqlite"
      url      = "file:./kairos.db"
    }

    model Stock {
      id     String @id @default(cuid())
      ticker String @unique
      name   String

      // Relationen
      historicalData HistoricalData[]
    }

    model HistoricalData {
      id        Int      @id @default(autoincrement())
      timestamp DateTime
      open      Float
      high      Float
      low       Float
      close     Float
      volume    BigInt

      // Berechnete Indikatoren
      sma20     Float?
      ema50     Float?
      rsi14     Float?
      macd      Float?

      // Relation
      stockId   String
      stock     Stock    @relation(fields: [stockId], references: [id])

      @@unique([stockId, timestamp]) // Verhindert Duplikate
    }
    ```

* **Service (`prisma.service.ts`):** Implementiert `OnModuleInit`, um eine Verbindung herzustellen und `OnModuleDestroy` für einen sauberen Shutdown.

### **b) Data Ingestion Module (Datenerfassung)**

* **Aufgabe:** Holt zuverlässig Marktdaten.
* **API-Quellen:**
  * **Alpha Vantage:** Guter kostenloser Tier für den Start.
  * **Polygon.io / Finnhub.io:** Bieten oft höhere Qualität und mehr Anfragen pro Minute in den bezahlten Tiers.
* **Implementierung (`data-ingestion.service.ts`):**
  * Verwendet `axios` für HTTP-Anfragen.
  * Implementiert einen robusten Wiederholungsmechanismus mit exponentiellem Backoff (z.B. mit `axios-retry`), um mit Ratenbegrenzungen und temporären API-Ausfällen umzugehen.
  * Transformiert die API-Antwort in das Prisma-Datenmodell, bevor es gespeichert wird.
  * Der Service wird vom `Scheduling Module` aufgerufen.

### **c) Analysis Engine Module (Technische Analyse)**

* **Aufgabe:** Berechnet aus den Rohdaten (OHLCV) wertvolle Features für das ML-Modell.
* **Bibliothek:** **`technicalindicators`**
* **Implementierung (`analysis-engine.service.ts`):**
  * Liest eine Reihe von `HistoricalData`-Einträgen aus der Datenbank.
  * Berechnet Indikatoren wie SMA (Simple Moving Average), EMA (Exponential Moving Average), RSI (Relative Strength Index), MACD (Moving Average Convergence Divergence).
  * Speichert die berechneten Werte in den entsprechenden Feldern der `HistoricalData`-Tabelle. Dieser Prozess wird als "Anreicherung" der Daten bezeichnet.

### **d) ML Prediction Module (Lernen und Prognose)**

Das ist das Herzstück.

* **Aufgabe:** Lernt Muster aus den historischen, angereicherten Daten und trifft Vorhersagen.
* **Bibliothek:** **`@tensorflow/tfjs-node`**
* **Workflow:**
    1. **Feature Engineering:** Wählt die Eingabedaten für das Modell aus. Nicht nur der Schlusskurs, sondern vor allem die berechneten Indikatoren (RSI, MACD etc.) und prozentuale Veränderungen sind wichtig.
    2. **Daten-Normalisierung:** Skaliert alle Eingabedaten auf einen Bereich zwischen 0 und 1 oder -1 und 1. Das ist für Neuronale Netze essenziell.
    3. **Modell-Architektur:** Ein **LSTM (Long Short-Term Memory)**-Netzwerk ist eine gute Wahl für Zeitreihendaten, da es sich Sequenzen "merken" kann.
    4. **Training (`trainModel` Methode):**
        * Wird periodisch (z.B. einmal täglich) vom `Scheduling Module` aufgerufen.
        * Lädt die neuesten Daten, bereitet sie vor und trainiert das LSTM-Modell.
        * Speichert das trainierte Modell auf der Festplatte (`model.save('file://./model-directory')`).
    5. **Prognose (`predictNext` Methode):**
        * Lädt das zuletzt gespeicherte Modell.
        * Nimmt die letzten `N` Datenpunkte (z.B. die letzten 30 Tage) als Input.
        * Gibt eine Prognose aus, z.B. "Kurs wird in den nächsten 24h um >1% steigen/fallen" (Klassifikation) oder den prognostizierten Preis (Regression).

### **e) Scheduling Module (Automatisierung)**

* **Aufgabe:** Orchestriert die wiederkehrenden Prozesse.
* **Implementierung (`tasks.service.ts`):**
  * Verwendet den `@Cron()`-Decorator von NestJS (`@nestjs/schedule`).
  * **Beispiel-Jobs:**
    * `@Cron('*/15 * * * *')`: Alle 15 Minuten: `dataIngestionService.fetchLatestDataForAllTrackedStocks()`.
    * `@Cron('0 * * * *')`: Jede volle Stunde: `analysisEngineService.enrichLatestData()`.
    * `@Cron('0 2 * * *')`: Jeden Tag um 2 Uhr nachts: `mlPredictionService.trainModel()`.

### **f) CLI Module (Benutzerschnittstelle)**

* **Aufgabe:** Stellt dem Benutzer Befehle zur Verfügung.
* **Implementierung:** Nutzt `nestjs-commander` oder ein ähnliches Paket, um NestJS-Services in CLI-Befehlen verfügbar zu machen.
* **Beispiel-Befehle:**
  * `kairos status`: Zeigt an, wann die letzte Datenerfassung/Analyse/Training lief und wie viele Datenpunkte vorhanden sind.
  * `kairos track <TICKER>`: Fügt eine neue Aktie zur Beobachtung hinzu.
  * `kairos predict <TICKER>`: Ruft `mlPredictionService.predictNext()` auf und gibt das Ergebnis formatiert aus.
  * `kairos backtest --strategy=rsi --from=2023-01-01`: (Fortgeschritten) Simuliert die Strategie auf historischen Daten, um ihre Profitabilität zu bewerten.

## 5. Enterprise-Level-Praktiken

* **Konfiguration (`ConfigModule`):** Nutzt `@nestjs/config`, um Variablen aus `.env`-Dateien zu laden. So bleiben API-Schlüssel und andere sensible Daten außerhalb des Git-Repositorys.
* **Logging:** Integriere einen robusten Logger wie **Pino** oder **Winston**. Konfiguriere ihn so, dass er strukturierte JSON-Logs ausgibt. Das ist für die spätere Analyse von Fehlern unerlässlich.
* **Testing (Jest):**
  * **Unit-Tests:** Jeder Service wird isoliert getestet. Abhängigkeiten (wie andere Services oder der Prisma-Client) werden gemockt.
  * **Integration-Tests:** Teste das Zusammenspiel von Modulen, z.B. ob nach dem Aufruf des `DataIngestionService` die Daten korrekt in der (Test-)Datenbank landen.
* **Docker:** Erstelle ein `Dockerfile` und eine `docker-compose.yml`. Damit kannst du die gesamte Anwendung inklusive der SQLite-Datenbank in einem Container ausführen. Das garantiert eine konsistente Umgebung und vereinfacht die Ausführung auf jedem System.

Dieses Konzept bietet eine solide, professionelle Grundlage. Du kannst klein anfangen, indem du zuerst die Datenerfassung und -speicherung implementierst, und dann schrittweise die Analyse-, ML- und CLI-Funktionen darauf aufbauen. Viel Erfolg bei diesem spannenden Vorhaben
