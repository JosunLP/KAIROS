# KAIROS Vollautomatik-Modus

Der Vollautomatik-Modus ermöglicht es, das KAIROS Trading-System kontinuierlich und autonom laufen zu lassen, ohne manuellen Eingriff.

## 🚀 Funktionsweise

### Automatisierte Prozesse

Der Vollautomatik-Modus startet folgende parallele Prozesse:

1. **🔄 Datenerfassung** (Standard: alle 5 Minuten)
   - Holt aktuelle Marktdaten für alle verfolgten Aktien
   - Läuft nur während der Handelszeiten
   - Automatische Wiederholung bei Fehlern

2. **📊 Technische Analyse** (Standard: alle 15 Minuten)
   - Berechnet technische Indikatoren
   - Aktualisiert Analyse-Datenbank
   - Parallel zu Datenerfassung

3. **🔮 ML-Vorhersagen** (Standard: alle 30 Minuten)
   - Generiert Prognosen für alle aktiven Aktien
   - Basiert auf aktuellsten Daten und Modellen
   - Speichert Vorhersagen in der Datenbank

4. **💼 Portfolio-Management** (Standard: alle 60 Minuten)
   - Überwacht alle Portfolios
   - Führt Performance-Analysen durch
   - Potentielle Rebalancing-Signale

5. **⚠️ Risikomanagement** (Standard: alle 10 Minuten)
   - Kontinuierliche Risikoüberwachung
   - Benachrichtigungen bei kritischen Werten
   - Compliance-Checks

6. **💓 System-Überwachung** (Standard: alle 2 Minuten)
   - Health-Checks aller Komponenten
   - Performance-Monitoring
   - Automatische Bereinigung

## 🔧 Konfiguration

### Umgebungsvariablen (.env)

```properties
# Vollautomatik ein-/ausschalten
AUTOMATION_ENABLED=false

# Intervalle (in Millisekunden)
AUTOMATION_DATA_INTERVAL_MS=300000      # 5 Minuten
AUTOMATION_ANALYSIS_INTERVAL_MS=900000  # 15 Minuten
AUTOMATION_PREDICTION_INTERVAL_MS=1800000 # 30 Minuten
AUTOMATION_PORTFOLIO_INTERVAL_MS=3600000  # 60 Minuten
AUTOMATION_RISK_INTERVAL_MS=600000        # 10 Minuten
AUTOMATION_HEALTH_INTERVAL_MS=120000      # 2 Minuten

# Fehlerbehandlung
AUTOMATION_MAX_RETRIES=3
AUTOMATION_RETRY_DELAY_MS=30000
AUTOMATION_STOP_ON_CRITICAL_ERROR=true

# Benachrichtigungen
AUTOMATION_NOTIFICATIONS_ENABLED=true
AUTOMATION_ERROR_THRESHOLD=5
```

### Laufzeit-Konfiguration

```bash
# Intervalle ändern (in Minuten)
kairos automation-config data-interval 10
kairos automation-config analysis-interval 20
kairos automation-config prediction-interval 45

# Fehlerbehandlung
kairos automation-config max-retries 5
```

## 📋 CLI-Kommandos

### Basis-Befehle

```bash
# Vollautomatik starten
kairos automation-start

# Vollautomatik stoppen
kairos automation-stop

# Status anzeigen
kairos automation-status

# Konfiguration anzeigen
kairos automation-config

# Konfiguration ändern
kairos automation-config data-interval 15
```

### Status-Informationen

Der `automation-status` Befehl zeigt:

- 📊 Aktueller Status (Läuft/Gestoppt)
- ⏱️ Laufzeit seit Start
- 🔄 Anzahl erfolgreicher/fehlgeschlagener Zyklen
- 📋 Status aller Komponenten
- 📈 Performance-Metriken
- ❌ Letzte Fehler
- ⚙️ Aktuelle Konfiguration

## 🛡️ Sicherheit & Fehlerbehandlung

### Automatische Wiederherstellung

- **Retry-Mechanismus**: Bei Fehlern wird automatisch wiederholt
- **Graceful Degradation**: Ein fehlerhafter Prozess stoppt nicht das ganze System
- **Isolation**: Jeder Prozess läuft in separaten Timern

### Benachrichtigungen

- **Info**: Beim Start/Stopp der Automation
- **Warning**: Bei erhöhtem Risiko in Portfolios
- **Error**: Bei wiederholten Fehlern
- **Critical**: Bei kritischen Systemfehlern

### Monitoring

- **Health-Checks**: Kontinuierliche Systemüberwachung
- **Performance-Tracking**: RAM-Verbrauch, Zykluszeiten
- **Error-Tracking**: Fehlerstatistiken und Historie
- **Component-Status**: Status jedes einzelnen Prozesses

## 🔄 Auto-Start

Der Vollautomatik-Modus kann beim Systemstart automatisch aktiviert werden:

```properties
# In .env setzen
AUTOMATION_ENABLED=true
```

Dies startet die Automation automatisch beim Start der Anwendung.

## 📊 Monitoring & Logs

### Logging

Alle Automation-Aktivitäten werden detailliert geloggt:

- 🔄 Prozess-Starts und -Abschlüsse
- ⚠️ Warnungen und Fehler
- 📊 Performance-Metriken
- 🔧 Konfigurationsänderungen

### Status-Dashboard

Das CLI-Dashboard (`kairos dashboard`) zeigt auch Automation-Status an:

- 🤖 Automation-Status
- 📊 Letzte Aktivitäten
- ⚠️ Aktuelle Warnungen
- 📈 System-Performance

## ⚙️ Erweiterte Konfiguration

### Marktzeiten

Die Datenerfassung respektiert automatisch die Handelszeiten:

- **Wochentage**: 9:00 - 17:30 (Berliner Zeit)
- **Wochenende**: Keine Datenerfassung
- **Feiertage**: Werden derzeit nicht berücksichtigt

### Standard-Aktien

Bei der ersten Ausführung werden automatisch Standard-Aktien hinzugefügt:

```properties
DEFAULT_TICKERS=AAPL,GOOGL,MSFT,AMZN,TSLA,NVDA
```

### Datenbereinigung

Automatische Bereinigung alter Daten:

```properties
DATA_RETENTION_DAYS=365
```

## 🚨 Troubleshooting

### Häufige Probleme

**Problem**: Automation startet nicht

- **Lösung**: Prüfen Sie die Datenbankverbindung und API-Schlüssel

**Problem**: Hoher Speicherverbrauch

- **Lösung**: Reduzieren Sie die Intervalle oder die Anzahl verfolgter Aktien

**Problem**: API-Limitierungen

- **Lösung**: Erhöhen Sie die Intervalle für Datenerfassung

### Debug-Informationen

```bash
# Detaillierte Status-Informationen
kairos automation-status

# System-Dashboard
kairos dashboard

# Log-Level erhöhen (in .env)
LOG_LEVEL=debug
```

## 🎯 Best Practices

1. **Starten Sie klein**: Beginnen Sie mit wenigen Aktien und größeren Intervallen
2. **Überwachen Sie**: Nutzen Sie `automation-status` regelmäßig
3. **Konfigurieren Sie**: Passen Sie Intervalle an Ihre Bedürfnisse an
4. **Backup**: Sichern Sie regelmäßig Ihre SQLite-Datenbank
5. **Updates**: Stoppen Sie die Automation vor System-Updates

## 📈 Performance-Optimierung

### Empfohlene Einstellungen

**Für kleine Systeme (1-4 GB RAM):**

```bash
kairos automation-config data-interval 10
kairos automation-config analysis-interval 30
kairos automation-config prediction-interval 60
```

**Für leistungsstarke Systeme (8+ GB RAM):**

```bash
kairos automation-config data-interval 2
kairos automation-config analysis-interval 5
kairos automation-config prediction-interval 15
```

### API-Optimierung

- Nutzen Sie mehrere API-Provider für bessere Verfügbarkeit
- Implementieren Sie Caching für häufig abgerufene Daten
- Respektieren Sie API-Limits

Das KAIROS Vollautomatik-System bietet eine robuste und skalierbare Lösung für den kontinuierlichen Betrieb Ihres Trading-Systems. Mit der richtigen Konfiguration läuft es stabil und autonom, während es kontinuierlich wertvolle Marktdaten sammelt und analysiert.
