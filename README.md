# 🚀 KAIROS - KI-gestützte Aktienanalyse-CLI

KAIROS ist eine professionelle Command-Line-Interface (CLI) Anwendung für die KI-gestützte Analyse von Aktienmärkten. Sie kombiniert moderne Technologien wie NestJS, TypeScript, TensorFlow.js und technische Indikatoren, um fundierte Marktprognosen zu erstellen.

## 🌟 Features

- 📊 **Automatische Datenerfassung** von mehreren Finanzmarkt-APIs
- 🤖 **Machine Learning-Prognosen** mit LSTM-Neuronalen Netzen
- 📈 **Technische Indikatoren** (SMA, EMA, RSI, MACD, Bollinger Bands)
- ⏰ **Automatisierte Zeitpläne** für Datenerfassung und Training
- 💾 **SQLite-Datenbank** für lokale Datenspeicherung
- 🎯 **Modulare Architektur** nach Enterprise-Standards
- 🔄 **Resilienz** mit Retry-Mechanismen und Fehlerbehandlung

## 🛠️ Technologie-Stack

- **Runtime**: Node.js mit TypeScript
- **Framework**: NestJS (Enterprise-ready)
- **Datenbank**: SQLite mit Prisma ORM
- **Machine Learning**: TensorFlow.js
- **CLI**: nestjs-commander
- **Scheduling**: node-cron
- **APIs**: Alpha Vantage, Polygon.io, Finnhub

## 🚀 Quick Start

### 1. Installation

```bash
# Repository klonen
git clone <repository-url>
cd KAIROS

# Abhängigkeiten installieren und Setup
npm run setup
```

### 2. Konfiguration

```bash
# Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeiten Sie .env und tragen Sie Ihre API-Schlüssel ein
```

**Benötigte API-Schlüssel** (mindestens einer):

- [Alpha Vantage](https://www.alphavantage.co/support/#api-key) (kostenlos)
- [Polygon.io](https://polygon.io/) (kostenpflichtig, bessere Qualität)
- [Finnhub](https://finnhub.io/) (kostenlos mit Limits)

### 3. Erste Schritte

```bash
# Projekt kompilieren
npm run build

# CLI-Hilfe anzeigen
npm run kairos -- --help

# Erste Aktie hinzufügen
npm run kairos -- track AAPL

# Status prüfen
npm run kairos -- status

# ML-Modell trainieren
npm run kairos -- train

# Prognose erstellen
npm run kairos -- predict AAPL
```

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

``` structure
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

### Datenbankoperationen

```bash
# Prisma Client neu generieren
npm run prisma:generate

# Datenbank-Migrationen
npm run prisma:migrate

# Datenbank zurücksetzen
npm run prisma:reset
```

## 📊 Monitoring & Logs

### Datenbankstatus prüfen

```bash
kairos status
```

### Log-Dateien

- **Konsole**: Echtzeitausgabe während der Ausführung
- **Datei**: Optional in `./logs/kairos.log` (konfigurierbar)

## 🔒 Sicherheit

- ✅ API-Schlüssel werden nicht im Code gespeichert
- ✅ Umgebungsvariablen für sensible Daten
- ✅ Rate-Limiting für API-Aufrufe
- ✅ Retry-Mechanismen mit exponentialem Backoff
- ✅ Eingabevalidierung und Fehlerbehandlung

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
