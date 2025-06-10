# KAIROS Vollautomatik - Schnellstart

## 🚀 Sofortiger Start

### 1. Vollautomatik aktivieren

```bash
# System starten
npm start

# In der KAIROS CLI:
kairos automation-start
```

### 2. Status prüfen

```bash
# Status der Automation anzeigen
kairos automation-status

# System-Dashboard
kairos dashboard
```

### 3. Optional: Konfiguration anpassen

```bash
# Intervalle anzeigen
kairos automation-config

# Datenerfassung auf 10 Minuten setzen
kairos automation-config data-interval 10

# Analyse auf 20 Minuten setzen
kairos automation-config analysis-interval 20
```

## ⚙️ Standard-Konfiguration

Der Vollautomatik-Modus startet mit folgenden Standard-Intervallen:

- 🔄 **Datenerfassung**: alle 5 Minuten
- 📊 **Technische Analyse**: alle 15 Minuten  
- 🔮 **ML-Vorhersagen**: alle 30 Minuten
- 💼 **Portfolio-Management**: alle 60 Minuten
- ⚠️ **Risikomanagement**: alle 10 Minuten
- 💓 **System-Überwachung**: alle 2 Minuten

## 🛑 Stoppen

```bash
# Vollautomatik stoppen
kairos automation-stop

# Oder CLI beenden
exit
```

## 📋 Wichtige Befehle

```bash
automation-start     # Vollautomatik starten
automation-stop      # Vollautomatik stoppen
automation-status    # Status anzeigen
automation-config    # Konfiguration verwalten
dashboard           # System-Übersicht
help               # Alle Befehle anzeigen
```

Das war's! Die Vollautomatik läuft nun kontinuierlich und führt alle Trading-Prozesse automatisch aus. 🎯
