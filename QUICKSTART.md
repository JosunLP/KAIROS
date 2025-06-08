# KAIROS Persistente CLI - Schnellstart

## Neue Architektur 🚀

Die KAIROS CLI wurde komplett überarbeitet für bessere Kontrolle über das ML-Training:

### Vorher ❌

```bash
npm start train-start  # Blockiert bis fertig
# Training läuft
# CLI nicht nutzbar
# Bei Abbruch: Datenverlust möglich
```

### Jetzt ✅

```bash
npm start              # Persistente CLI
kairos> train-start    # Hintergrund-Training
🧠 Training: 5/100 | Loss: 0.8234 | Acc: 67.5% | Eingabe: 
kairos> status         # CLI bleibt nutzbar!
kairos> train-status   # Live-Status
kairos> train-stop     # Sicherer Stopp
kairos> exit           # Beenden
```

## Schnellstart

### 1. Persistente CLI starten

```bash
cd "d:\git\KAIROS"
npm start
```

### 2. Training im Hintergrund starten

```bash
kairos> train-start
🧠 Starte Hintergrund-Training...
💡 Das Training läuft im Hintergrund. CLI bleibt verfügbar.
🟢 Hintergrund-Training gestartet
```

### 3. Während Training: CLI weiter nutzen

```bash
kairos> status
📊 Verfolgte Aktien: 3
📈 Datenpunkte: 1250
✅ System ist bereit

kairos> list
📋 Verfolgte Aktien:
📈 AAPL   | Apple Inc.              | $150.25    | 07.06.2025
📈 MSFT   | Microsoft Corporation   | $280.50    | 07.06.2025

kairos> train-status
📊 Training Status:
🟢 Training läuft...
🕐 Laufzeit: 2m 30s
📈 Fortschritt: 15/100 (15.0%)
💔 Loss: 0.7843
🎯 Accuracy: 72.50%
```

### 4. Training stoppen (wenn gewünscht)

```bash
kairos> train-stop
🛑 Beende Hintergrund-Training...
✅ Training wurde sicher beendet
```

### 5. Anwendung beenden

```bash
kairos> exit
👋 KAIROS wird beendet...
```

## Features

### ✅ Persistente CLI

- Bleibt konstant geöffnet
- Readline-Interface mit History
- Graceful shutdown mit `exit`

### ✅ Hintergrund-Training

- Non-blocking Ausführung
- Live-Status-Updates alle 2 Sekunden
- CLI bleibt für andere Befehle verfügbar

### ✅ Sichere Kontrolle

- `train-start`: Startet Training im Hintergrund
- `train-stop`: Stoppt Training nach aktueller Epoche
- `train-status`: Live-Status ohne Training zu stören

### ✅ Legacy-Kompatibilität

```bash
# Alte Befehle funktionieren weiterhin:
npm start status
npm start track AAPL
npm start predict MSFT
```

## Server-Deployment

Für Server: Einfach CLI offen lassen und Training läuft konstant:

```bash
# Auf Server:
npm start
kairos> train-start
# Terminal offen lassen - Training läuft im Hintergrund

# Monitoring in separater SSH-Sitzung:
npm start train-status
```

## Vorteile der neuen Architektur

1. **🔄 Multitasking**: Training + andere Befehle gleichzeitig
2. **🛡️ Sicherheit**: Graceful shutdown, keine Datenkorruption
3. **📊 Monitoring**: Live-Updates ohne Training zu stören
4. **🚀 Performance**: Non-blocking, optimierte Speichernutzung
5. **🎯 Flexibilität**: Beide Modi (Legacy + Persistent) verfügbar
