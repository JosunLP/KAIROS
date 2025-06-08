# KAIROS ML Training Befehle - Persistente CLI

## Übersicht

KAIROS bietet erweiterte Befehle zum Trainieren des Machine Learning Modells mit vollständiger Kontrolle über den Training-Prozess. Die CLI unterstützt zwei Modi:

1. **Einzelbefehl-Modus**: `npm start <befehl>` (Legacy)
2. **Persistenter Modus**: `npm start` (Empfohlen für Training)

## Modi

### Persistenter Modus (Empfohlen)

```bash
# Starte persistente CLI
npm start

# CLI bleibt geöffnet:
kairos> train-start
kairos> train-status
kairos> list
kairos> exit
```

**Vorteile:**

- CLI bleibt konstant geöffnet
- Training läuft im Hintergrund weiter
- Andere Befehle bleiben während Training verfügbar
- Automatische Status-Updates
- Sicheres Beenden mit `exit`

### Einzelbefehl-Modus (Legacy)

```bash
# Einzelne Befehle ausführen
npm start status
npm start track AAPL
npm start predict MSFT
```

## Verfügbare Training-Befehle

### `train-start`

Startet das erweiterte ML-Training:

**Einzelbefehl-Modus:**

- Blockiert bis Training abgeschlossen
- Zeigt Live-Updates in Konsole

**Persistenter Modus:**

- Läuft im Hintergrund
- CLI bleibt für andere Befehle verfügbar
- Automatische Status-Updates alle 2 Sekunden

```bash
# Persistenter Modus (empfohlen)
npm start
kairos> train-start

# Einzelbefehl-Modus
npm start train-start
```

### `train-stop`

Beendet das laufende Training sicher:

- **Graceful Shutdown**: Wartet auf aktuellen Epoche-Abschluss
- **Datenintegrität**: Keine Korruption von Zwischenergebnissen
- **Funktioniert in beiden Modi**

```bash
# Persistenter Modus
kairos> train-stop

# Einzelbefehl-Modus (in neuem Terminal)
npm start train-stop
```

### `train-status`

Zeigt den aktuellen Status des Trainings:

- **Laufzeit**: Wie lange das Training bereits läuft
- **Fortschritt**: Aktuelle Epoche von Gesamt-Epochen
- **Metriken**: Loss und Accuracy Werte
- **Non-blocking**: Stört das Training nicht

```bash
# Persistenter Modus
kairos> train-status

# Einzelbefehl-Modus
npm start train-status
```

## Workflow-Beispiele

### Hintergrund-Training (Empfohlen)

```bash
# 1. Persistente CLI starten
npm start

# 2. Training im Hintergrund starten
kairos> train-start

# 3. Andere Arbeiten während Training
kairos> status
kairos> list
kairos> track TSLA

# 4. Training-Status prüfen
kairos> train-status

# 5. Bei Bedarf Training stoppen
kairos> train-stop

# 6. Anwendung beenden
kairos> exit
```

### Server-Deployment

```bash
# Für Server: Training läuft konstant im Hintergrund
npm start
kairos> train-start
# Lassen Sie die CLI offen - Training läuft weiter
```

### Monitoring

```bash
# In separatem Terminal: Status überwachen
npm start train-status

# Oder im persistenten Modus:
kairos> train-status
```

## Technische Details

### Persistenter Modus

- **Readline Interface**: Interaktive CLI mit History
- **Hintergrund-Processing**: Non-blocking Training
- **Automatische Updates**: Status alle 2 Sekunden
- **Graceful Shutdown**: Sicherer Exit mit `exit` oder Ctrl+C

### Hintergrund-Training

- **Non-blocking**: CLI bleibt responsiv
- **Status-Updates**: Live-Anzeige in Terminal
- **Memory Management**: Automatische Bereinigung
- **Recovery**: Robust gegen Unterbrechungen

### Training-Kontrolle

- **AbortController**: Saubere Abbruch-Kontrolle
- **Epochen-Checkpoints**: Sicherer Stopp nach Epoche
- **State Persistence**: Status bleibt über CLI-Sitzung bestehen

## Troubleshooting

### Training startet nicht

```bash
# Status prüfen
kairos> status

# Daten überprüfen (min. 100 Datenpunkte)
kairos> list
```

### CLI reagiert nicht

```bash
# Ctrl+C zum sicheren Beenden
# Oder in neuem Terminal:
npm start train-stop
```

### Training hängt

```bash
# Status in neuem Terminal prüfen
npm start train-status

# Training forciert stoppen
npm start train-stop
```

### Speicher-Probleme

- Training wird automatisch bei niedrigem Speicher gestoppt
- Restart der CLI behebt die meisten Speicher-Leaks
- TensorFlow Tensoren werden automatisch bereinigt

## Best Practices

### Für Entwicklung

1. **Persistenten Modus verwenden**: `npm start`
2. **Status regelmäßig prüfen**: `train-status`
3. **Sicher beenden**: `train-stop` vor `exit`
4. **Genügend Daten**: Min. 100 Datenpunkte vor Training

### Für Server-Deployment

1. **Persistenten Modus**: CLI immer offen lassen
2. **Automatisches Training**: `train-start` nach Systemstart
3. **Monitoring**: Regelmäßige `train-status` Checks
4. **Logs**: NestJS Logging für Debugging

### Performance

1. **Hintergrund-Training**: Für bessere Responsivität
2. **Memory Monitoring**: Speicherverbrauch überwachen
3. **Checkpoint-Saves**: Regelmäßige Modell-Speicherung
4. **Resource Management**: Training nur bei ausreichend RAM
