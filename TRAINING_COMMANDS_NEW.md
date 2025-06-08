# KAIROS ML-Training Commands - Erweitert mit automatischer Datenaktualisierung

## Übersicht

Das KAIROS ML-Training wurde für den **persistenten CLI-Modus** optimiert und kann im Hintergrund laufen, während Sie andere CLI-Befehle verwenden. **NEU**: Automatisches Abrufen frischer Daten vor jedem Training!

## ⚡ WICHTIGE NEUERUNGEN

### Automatische Datenaktualisierung

- **Vor jedem Training** werden automatisch frische Daten von APIs abgerufen
- Falls keine überwachten Aktien vorhanden sind, werden automatisch Beispiel-Aktien hinzugefügt (AAPL, GOOGL, MSFT, TSLA, AMZN)
- Das Training nutzt immer die neuesten verfügbaren Daten für bessere Modell-Qualität
- Kombiniert frische API-Daten mit bereits gespeicherten historischen Daten

### Hintergrund-Training

- Training läuft im Hintergrund und blockiert die CLI nicht
- Live-Status-Updates alle 10 Sekunden während des Trainings
- Training kann nur über spezielle Befehle gestoppt werden (nicht durch CLI-Exit)

## 🎯 Verfügbare Befehle

### `train-start`

#### Startet das ML-Training im Hintergrund mit automatischer Datenaktualisierung

**Workflow:**

1. Prüft verfügbare überwachte Aktien
2. Fügt Standard-Aktien hinzu, falls keine vorhanden (AAPL, GOOGL, MSFT, TSLA, AMZN)
3. Holt frische Daten von APIs für alle Aktien
4. Startet ML-Training mit kombinierten Daten
5. Läuft mit 100 Epochen im Hintergrund

``` bash
> train-start
🤖 Starte erweiteres ML-Modell-Training...
📡 Hole frische Daten für Training...
⚠️ Keine überwachten Aktien gefunden. Füge Beispiel-Aktien hinzu...
✅ AAPL hinzugefügt
✅ GOOGL hinzugefügt
✅ MSFT hinzugefügt
✅ TSLA hinzugefügt
✅ AMZN hinzugefügt
✅ Training im Hintergrund gestartet
📊 Epoche 1/100 - Genauigkeit: 65%
```

### `train-stop`

#### Stoppt das laufende Training sicher

- Wartet auf sichere Beendigung der aktuellen Epoche
- Behält bereits trainierte Fortschritte bei

``` bash
> train-stop
🛑 Beende Training sicher...
✅ Training sicher beendet
```

### `train-status`

#### Zeigt den aktuellen Training-Status

- Live-Informationen über Fortschritt
- Aktuelle Epoche und geschätzte Restzeit
- Trainings-Metriken

``` md
> train-status
📊 Training Status:
   Status: Training läuft
   Epoche: 45/100 (45%)
   Gestartet: 2024-01-15 14:30:00
   Geschätzte Restzeit: ~5 Minuten
```

## 🔄 Typischer Workflow

### 1. Persistente CLI starten

```powershell
npm start
```

### 2. Training im Hintergrund starten (mit automatischer Datenaktualisierung)

```bash
> train-start
```

### 3. Andere Befehle verwenden (während Training läuft)

```bash
> help
> add-stock NVDA          # Fügt weitere Aktien hinzu
> analyze AAPL            # Analysiert bestehende Daten
> predict TSLA 5          # Nutzt trainiertes Modell
> train-status            # Prüft Training-Fortschritt
```

### 4. Training-Status überprüfen

```bash
> train-status
```

### 5. Bei Bedarf Training stoppen

```bash
> train-stop
```

### 6. CLI beenden (Training läuft weiter bis Completion)

```bash
> exit
```

## 📊 Datenquellen für Training

Das ML-Training nutzt jetzt eine **Hybrid-Strategie**:

1. **Frische API-Daten**:
   - Automatisch vor jedem Training abgerufen
   - Neueste Marktdaten für bessere Aktualität
   - Unterstützt mehrere Provider (Alpha Vantage, Polygon, Finnhub)

2. **Historische Daten**:
   - Bereits gespeicherte Daten aus vorherigen Abrufen
   - Umfangreiche historische Basis für Mustererkennung

3. **Automatische Aktien-Verwaltung**:
   - Standard-Portfolio: AAPL, GOOGL, MSFT, TSLA, AMZN
   - Oder Ihre individuell überwachten Aktien
   - Erweiterbar mit `add-stock` Befehl

4. **Technische Indikatoren**:
   - SMA20, EMA50, RSI14, MACD
   - Automatisch berechnet und einbezogen

## ⚠️ Wichtige Hinweise

- **Mindestdaten**: Für erfolgreiches Training sind mindestens 100 verarbeitbare Datenpunkte erforderlich
- **Erste Verwendung**: Beim ersten Training werden Standard-Aktien hinzugefügt - dies kann 5-10 Minuten dauern
- **API-Limits**: Bei vielen Aktien kann das Daten-Abrufen länger dauern (Rate Limiting)
- **Netzwerk**: Training benötigt Internetverbindung für frische Daten
- **Hintergrund**: Training läuft auch nach CLI-Exit weiter bis Completion

## 🚀 Performance-Tipps

1. **Erste Verwendung**:

   ``` bash
   > train-start    # Fügt automatisch 5 Standard-Aktien hinzu
   ```

2. **Erweiterte Diversifikation**:

   ``` bash
   > add-stock NVDA
   > add-stock AMD  
   > add-stock META
   > train-start    # Nutzt jetzt 8 Aktien für Training
   ```

3. **Regelmäßiges Re-Training**:

   ``` bash
   > train-start    # Spätere Trainings sind schneller (nur Updates)
   ```

4. **Monitoring während Training**:

   ``` bash
   > train-status   # Live-Updates alle 10 Sekunden
   ```

## 🔧 Fehlerbehebung

### "Nicht genügend Daten für Training"

**Lösung**: Das System fügt automatisch Standard-Aktien hinzu, aber Sie können auch manuell welche hinzufügen:

``` bash
> add-stock AAPL
> add-stock GOOGL
> add-stock MSFT
> train-start
```

### Training hängt bei Daten-Abruf

**Mögliche Ursachen**:

- Internetverbindung prüfen
- API-Keys in .env-Datei konfiguriert?
- Rate Limiting bei API-Provider

**Lösung**:

``` bash
> train-stop        # Sicher abbrechen
> train-start       # Erneut versuchen
```

### Training läuft nicht im Hintergrund

**Prüfen**:

- Verwenden Sie `train-start` statt alter Befehle?
- CLI muss im persistenten Modus sein (`npm start`)
- Nicht im Einzelbefehl-Modus (`npm start train`)

### API-Fehler bei Daten-Abruf

**Lösung**:

``` bash
# .env Datei prüfen:
ALPHA_VANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
```

## 📈 Monitoring und Optimierung

### Live-Status während Training

``` bash
> train-status
📊 Training Status:
   Status: Training läuft
   Epoche: 25/100 (25%)
   Gestartet: 2024-01-15 14:30:00
   Aktuelle Genauigkeit: 68.5%
   Geschätzte Restzeit: ~8 Minuten
```

### Nach Training abgeschlossen

``` bash
> train-status
📊 Training Status:
   Status: Abgeschlossen
   Epochen: 100/100 (100%)
   Finale Genauigkeit: 72.3%
   Dauer: 12 Minuten
   Modell gespeichert: ✅
```

### Modell testen

``` bash
> predict AAPL 5
🔮 5-Tage Prognose für AAPL basierend auf frisch trainierten Modell...
✅ Prognose erstellt
```

---

**💡 Tipp**: Das neue System mit automatischer Datenaktualisierung macht ML-Training viel praktischer und genauer - einfach `train-start` eingeben und das System holt automatisch die benötigten Daten und startet das Training im Hintergrund!
