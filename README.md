# 🚀 KAIROS - KI-gestützte Aktienanalyse-CLI

KAIROS ist eine professionelle Command-Line-Interface (CLI) Anwendung für die KI-gestützte Analyse von Aktienmärkten. Sie kombiniert moderne Technologien wie NestJS, TypeScript, TensorFlow.js und technische Indikatoren, um fundierte Marktprognosen zu erstellen.

## 🌟 Features

- 📊 **Automatische Datenerfassung** von mehreren Finanzmarkt-APIs
- 🤖 **Machine Learning-Prognosen** mit LSTM-Neuronalen Netzen
- 📈 **Technische Indikatoren** (SMA, EMA, RSI, MACD, Bollinger Bands)
- ⏰ **Automatisierte Zeitpläne** für Datenerfassung und Training
- 💾 **PostgreSQL-Datenbank** für robuste Datenspeicherung
- 🐳 **Docker-Integration** für einfache Deployment
- 🎯 **Modulare Architektur** nach Enterprise-Standards
- 🔄 **Resilienz** mit Retry-Mechanismen und Fehlerbehandlung

## 🛠️ Technologie-Stack

- **Runtime**: Node.js mit TypeScript
- **Framework**: NestJS (Enterprise-ready)
- **Datenbank**: PostgreSQL mit Prisma ORM
- **Machine Learning**: TensorFlow.js
- **CLI**: nestjs-commander
- **Scheduling**: node-cron
- **Container**: Docker & Docker Compose
- **APIs**: Alpha Vantage, Polygon.io, Finnhub

## 🚀 Quick Start

### Option 1: Docker (Empfohlen)

```bash
# Repository klonen
git clone <repository-url>
cd KAIROS

# Entwicklungsumgebung konfigurieren
cp env.dev.example .env
# Bearbeiten Sie .env und tragen Sie Ihre API-Schlüssel ein

# Docker-Container starten
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Status prüfen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
```

### Option 2: Lokale Installation

```bash
# Repository klonen
git clone <repository-url>
cd KAIROS

# Abhängigkeiten installieren und Setup
npm run setup

# Umgebungsvariablen konfigurieren
cp env.example .env
# Bearbeiten Sie .env und tragen Sie Ihre API-Schlüssel ein
```

**Benötigte API-Schlüssel** (mindestens einer):

- [Alpha Vantage](https://www.alphavantage.co/support/#api-key) (kostenlos)
- [Polygon.io](https://polygon.io/) (kostenpflichtig, bessere Qualität)
- [Finnhub](https://finnhub.io/) (kostenlos mit Limits)

### 3. Erste Schritte

#### Mit Docker:

```bash
# CLI-Hilfe anzeigen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec kairos npm run kairos -- --help

# Erste Aktie hinzufügen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec kairos npm run kairos -- track AAPL

# Status prüfen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec kairos npm run kairos -- status
```

#### Lokal:

```bash
# Projekt kompilieren
npm run build

# CLI-Hilfe anzeigen
npm run kairos -- --help

# Erste Aktie hinzufügen
npm run kairos -- track AAPL

# Status prüfen
npm run kairos -- status
```

## 🐳 Docker Setup

### Entwicklungsumgebung

```bash
# Entwicklungsumgebung starten
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Logs anzeigen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Container stoppen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### Staging-Umgebung

```bash
# Staging-Umgebung starten
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Logs anzeigen
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs -f
```

### Produktionsumgebung

```bash
# Produktionsumgebung starten
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Logs anzeigen
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

### Umgebungsvariablen

Alle Docker-Container verwenden die lokale `.env` Datei:

```bash
# Entwicklungsumgebung konfigurieren
cp env.dev.example .env

# Bearbeiten Sie .env mit Ihren Einstellungen
nano .env
```

**Wichtige Umgebungsvariablen:**

- `DATABASE_URL`: PostgreSQL-Verbindungsstring
- `ALPHA_VANTAGE_API_KEY`: API-Schlüssel für Alpha Vantage
- `LOG_LEVEL`: Logging-Level (debug, info, warn, error)
- `NODE_ENV`: Umgebung (development, staging, production)

## 📚 CLI-Befehle

### Grundlegende Befehle

```bash
# System-Status anzeigen
kairos status

# Aktie zur Beobachtung hinzufügen
kairos track <TICKER>

# Alle verfolgten Aktien anzeigen
kairos list

# Prognose für eine Aktie erstellen
kairos predict <TICKER> [--days 1-30]

# ML-Modell trainieren
kairos train [--force]
```

### Beispiele

```bash
# Apple zur Beobachtung hinzufügen
kairos track AAPL

# 7-Tage-Prognose für Microsoft
kairos predict MSFT --days 7

# Modell neu trainieren (überschreibt vorhandenes)
kairos train --force
```

## 🏗️ Architektur

```structure
KAIROS/
├── src/
│   ├── cli/                 # CLI-Interface
│   ├── data-ingestion/      # Datenerfassung
│   ├── persistence/         # Datenbank-Layer
│   ├── analysis-engine/     # Technische Analyse
│   ├── ml-prediction/       # Machine Learning
│   ├── scheduling/          # Automatisierung
│   ├── config/              # Konfiguration
│   └── common/              # Typen & Utils
├── prisma/                  # Datenbankschema
├── models/                  # ML-Modelle
├── docker/                  # Docker-Konfiguration
├── scripts/                 # Setup-Scripts
└── logs/                    # Log-Dateien
```

## 🔧 Entwicklung

### Lokale Entwicklung

```bash
# Entwicklungsmodus starten
npm run start:dev

# Tests ausführen
npm test

# Linting
npm run lint

# Prisma Studio (Datenbank-GUI)
npm run prisma:studio
```

### Docker-Entwicklung

```bash
# Entwicklungsumgebung mit Hot-Reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Container-Shell öffnen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec kairos sh

# Datenbank-Shell öffnen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec postgres psql -U kairos_dev -d kairos_dev

# Prisma Studio starten
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up prisma-studio
```

### Datenbankoperationen

```bash
# Prisma Client neu generieren
npm run prisma:generate

# Datenbank-Migrationen
npm run prisma:migrate

# Datenbank zurücksetzen
npm run prisma:reset

# Mit Docker:
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec kairos npx prisma db push
```

## 📊 Monitoring & Logs

### System-Status

```bash
# Mit Docker
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec kairos npm run kairos -- status

# Lokal
kairos status
```

### Log-Dateien

- **Docker**: `docker-compose logs -f kairos`
- **Lokal**: Optional in `./logs/kairos.log` (konfigurierbar)

### Health Checks

```bash
# Application Health
curl http://localhost:3000/health

# ML Service Health
curl http://localhost:8081/health
```

## 🔒 Sicherheit

- ✅ API-Schlüssel werden nicht im Code gespeichert
- ✅ Umgebungsvariablen für sensible Daten
- ✅ Rate-Limiting für API-Aufrufe
- ✅ Retry-Mechanismen mit exponentialem Backoff
- ✅ Eingabevalidierung und Fehlerbehandlung
- ✅ Sichere Docker-Konfiguration

## 🎯 Geplante Features

- [ ] Web-Dashboard für Visualisierungen
- [ ] Erweiterte technische Indikatoren
- [ ] Portfolio-Management
- [ ] Backtesting-Engine
- [ ] REST API für externe Integration
- [ ] Cloud-Deployment (Azure Functions)
- [ ] Real-time WebSocket-Feeds

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne eine Pull Request

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe `LICENSE` für Details.

## ⚠️ Disclaimer

KAIROS ist ein Werkzeug für Bildungszwecke und technische Analyse. Es stellt **keine Anlageberatung** dar. Investitionen in Wertpapiere bergen Risiken. Konsultieren Sie einen Finanzberater vor Investitionsentscheidungen.

## 📞 Support

Bei Fragen oder Problemen:

- 📖 Dokumentation lesen
- 🐛 Issues auf GitHub erstellen
- 💬 Diskussionen im Repository

---

## **Happy Trading! 📈**

## ⏰ Automatisierte Cron Jobs

KAIROS führt verschiedene Aufgaben automatisch über Cron Jobs aus. Diese Jobs sorgen für kontinuierliche Datenerfassung, Analyse und ML-Training.

### 📋 Verfügbare Cron Jobs

| Job                        | Zeitplan       | Beschreibung                                             | Timeout |
| -------------------------- | -------------- | -------------------------------------------------------- | ------- |
| **Datenerfassung**         | `*/15 * * * *` | Holt aktuelle Marktdaten alle 15 Min (nur Handelszeiten) | 5 Min   |
| **Technische Analyse**     | `0 * * * *`    | Berechnet technische Indikatoren jede Stunde             | 10 Min  |
| **ML-Training**            | `0 2 * * *`    | Trainiert ML-Modelle täglich um 2:00 Uhr                 | 1 Std   |
| **Vorhersage-Validierung** | `0 3 * * *`    | Validiert Vorhersagen täglich um 3:00 Uhr                | 30 Min  |
| **Datenbereinigung**       | `0 4 * * 0`    | Bereinigt alte Daten sonntags um 4:00 Uhr                | 30 Min  |
| **Tägliche Vorhersagen**   | `0 6 * * *`    | Erstellt tägliche Vorhersagen um 6:00 Uhr                | 30 Min  |
| **Datenintegrität**        | `0 1 * * *`    | Überprüft Datenintegrität täglich um 1:00 Uhr            | 10 Min  |

### 🔧 Cron Job Konfiguration

Alle Cron Jobs können über Umgebungsvariablen konfiguriert werden:

```bash
# Cron Job Konfiguration kopieren
cp .env.cron.example .env.cron

# In Ihrer .env Datei hinzufügen:
# Quelle: .env.cron
```

**Beispiel-Konfiguration:**

```bash
# Datenerfassung (alle 30 Minuten)
DATA_INGESTION_CRON=*/30 * * * *

# ML-Training nur werktags
ML_TRAINING_CRON=0 2 * * 1-5

# Monitoring aktivieren
ENABLE_CRON_MONITORING=true
CRON_FAILURE_THRESHOLD=3
```

### 📊 Cron Job Management

KAIROS bietet ein Management-Script für Cron Jobs:

```bash
# Status aller Cron Jobs anzeigen
node scripts/cron-manager.js status

# Logs für alle Jobs anzeigen
node scripts/cron-manager.js logs

# Logs für spezifischen Job
node scripts/cron-manager.js logs ml-training

# Konfiguration testen
node scripts/cron-manager.js test

# Nächste geplante Ausführungen
node scripts/cron-manager.js schedule

# Hilfe anzeigen
node scripts/cron-manager.js help
```

### 🔍 Monitoring & Alerting

Die Cron Jobs werden automatisch überwacht:

- **✅ Erfolgreiche Ausführungen** werden geloggt
- **❌ Fehlgeschlagene Jobs** werden mit Details protokolliert
- **⏰ Timeout-Überwachung** für langläufige Jobs
- **🚨 Benachrichtigungen** bei wiederholten Fehlern (konfigurierbar)
- **📊 Metriken** für Performance-Analyse

**Monitoring-Features:**

```typescript
// Job-Statistiken abrufen
const stats = cronMonitoring.getJobStatistics();

// Spezifische Job-Metriken
const metrics = cronMonitoring.getJobMetrics('ml-training');

// Job-Historie
const history = cronMonitoring.getJobHistory('data-ingestion');
```

### 🚀 Produktionsempfehlungen

Für den Live-Betrieb empfehlen wir folgende Anpassungen:

**1. Optimierte Zeitpläne:**

```bash
# Datenerfassung nur während Kernhandelszeiten
DATA_INGESTION_CRON=*/30 9-17 * * 1-5

# ML-Training nur werktags
ML_TRAINING_CRON=0 2 * * 1-5

# Gestaffelte Jobs zur Ressourcenoptimierung
TECHNICAL_ANALYSIS_CRON=5 * * * *
DAILY_PREDICTION_CRON=10 6 * * *
```

**2. Monitoring konfigurieren:**

```bash
ENABLE_CRON_MONITORING=true
ENABLE_CRON_NOTIFICATIONS=true
CRON_FAILURE_THRESHOLD=2
NOTIFICATION_EMAIL=admin@your-domain.com
```

**3. Erweiterte Timeouts:**

```bash
# Produktionsumgebung hat mehr Daten
CRON_JOB_TIMEOUT=600000  # 10 Minuten
ML_TRAINING_TIMEOUT=7200000  # 2 Stunden
```

### ⚠️ Troubleshooting

**Häufige Probleme:**

1. **Jobs laufen nicht:**

   ```bash
   # Cron Expression validieren
   node scripts/cron-manager.js validate

   # NestJS Schedule Module prüfen
   npm run start:dev
   ```

2. **Timeout-Fehler:**

   ```bash
   # Timeout erhöhen
   CRON_JOB_TIMEOUT=900000  # 15 Minuten
   ```

3. **API-Rate-Limits:**

   ```bash
   # Datenerfassung reduzieren
   DATA_INGESTION_CRON=*/30 * * * *
   ```

4. **Speicherprobleme:**

   ```bash
   # Jobs staffeln
   ML_TRAINING_CRON=0 2 * * *
   PREDICTION_VALIDATION_CRON=0 4 * * *
   ```

**Debug-Befehle:**

```bash
# Live-Logs verfolgen
tail -f logs/kairos.log

# Job-Status prüfen
node scripts/cron-manager.js status

# Konfiguration testen
node scripts/cron-manager.js test
```

### 🔐 Cron Job Sicherheit

- **🔐 Umgebungsvariablen** für alle kritischen Konfigurationen
- **🚨 Fehler-Alerting** bei kritischen Problemen
- **📊 Audit-Logs** für alle Job-Ausführungen
- **⏰ Timeout-Schutz** verhindert hängende Prozesse
- **🔄 Automatische Wiederholung** bei temporären Fehlern
