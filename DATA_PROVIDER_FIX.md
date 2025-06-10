# KAIROS Datenquellen-Problembehebung

## Problem-Diagnose

Basierend auf den Logs haben Sie das folgende Problem:
- Alpha Vantage API gibt "Keine Zeitreihendaten in der API-Antwort gefunden" zurück
- Polygon Provider ist nicht implementiert (jetzt behoben)
- Finnhub Provider ist nicht implementiert (jetzt behoben)

## Lösungsschritte

### 1. API-Schlüssel konfigurieren

Erstellen Sie eine `.env` Datei im Hauptverzeichnis:

```bash
# Kopieren Sie .env.example zu .env
cp .env.example .env
```

Bearbeiten Sie die `.env` Datei und fügen Sie mindestens einen gültigen API-Schlüssel hinzu:

#### Alpha Vantage (Empfohlen für Anfang)
- Registrieren Sie sich auf: https://www.alphavantage.co/support/#api-key
- Kostenlos: 5 Aufrufe/Minute, 500/Tag
- Fügen Sie den Schlüssel ein: `ALPHA_VANTAGE_API_KEY=ihr_schlüssel_hier`

#### Polygon.io (Gut für höhere Frequenz)
- Registrieren Sie sich auf: https://polygon.io/
- Kostenlos: 5 Aufrufe/Minute
- Fügen Sie den Schlüssel ein: `POLYGON_API_KEY=ihr_schlüssel_hier`

#### Finnhub (Höchste kostenlose Rate)
- Registrieren Sie sich auf: https://finnhub.io/
- Kostenlos: 60 Aufrufe/Minute
- Fügen Sie den Schlüssel ein: `FINNHUB_API_KEY=ihr_schlüssel_hier`

### 2. Verbesserungen implementiert

✅ **Alpha Vantage Provider**: Verbesserte Fehlerbehandlung und Debugging
✅ **Polygon Provider**: Vollständig implementiert mit historischen und aktuellen Daten
✅ **Finnhub Provider**: Vollständig implementiert mit historischen und aktuellen Daten
✅ **Fallback-System**: Automatisches Umschalten zwischen Providern bei Fehlern
✅ **Bessere Fehlerbehandlung**: Detaillierte Logs und graceful degradation

### 3. Provider-Priorisierung

Das System versucht Provider in dieser Reihenfolge:
1. **Alpha Vantage** (wenn konfiguriert)
2. **Polygon** (wenn konfiguriert)  
3. **Finnhub** (wenn konfiguriert)
4. **Mock Provider** (immer verfügbar für Tests)

### 4. Sofortlösung für Tests

Wenn Sie noch keine API-Schlüssel haben, funktioniert das System mit dem Mock Provider:

```bash
# Starten Sie das System - es wird automatisch Mock-Daten verwenden
npm start
```

Der Mock Provider generiert realistische Testdaten für:
- AAPL, MSFT, GOOGL, AMZN, TSLA, META, NVDA

### 5. Debugging-Kommandos

```bash
# Testen Sie einen einzelnen Provider
npm run cli -- data:fetch AAPL

# Prüfen Sie die Systemkonfiguration
npm run cli -- config:show

# Aktivieren Sie Debug-Logs
LOG_LEVEL=debug npm start
```

## Häufige Probleme und Lösungen

### Problem: "API-Schlüssel nicht konfiguriert"
**Lösung**: Erstellen Sie `.env` Datei mit gültigen API-Schlüsseln

### Problem: "Rate Limit erreicht"
**Lösung**: 
- Warten Sie oder verwenden Sie anderen Provider
- Erhöhen Sie `API_RETRY_DELAY_MS` in `.env`
- Reduzieren Sie Häufigkeit der Datenabfragen

### Problem: "Keine Zeitreihendaten gefunden"
**Lösung**: 
- Prüfen Sie API-Schlüssel-Gültigkeit
- Verwenden Sie andere Provider (Polygon/Finnhub)
- Ticker-Symbol könnte ungültig sein

### Problem: Alpha Vantage funktioniert nicht
**Mögliche Ursachen**:
- Kostenloses Kontingent aufgebraucht (500/Tag)
- Ungültiger API-Schlüssel
- API-Format hat sich geändert

**Lösung**: Verwenden Sie Polygon oder Finnhub als Alternative

## Empfohlene Konfiguration

Für beste Ergebnisse konfigurieren Sie mehrere Provider:

```bash
# .env
ALPHA_VANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here  
FINNHUB_API_KEY=your_key_here

# Rate Limiting
API_RETRY_ATTEMPTS=3
API_RETRY_DELAY_MS=2000
```

## Überwachung

Schauen Sie in die Logs, um zu sehen welcher Provider verwendet wird:

```bash
tail -f logs/kairos-*.log
```

Sie sollten Nachrichten wie diese sehen:
```
[DataIngestionService] ✅ 30 Datenpunkte für AAPL von Polygon.io erhalten
[DataIngestionService] ✅ 30 Datenpunkte für AAPL gespeichert
```

## Nächste Schritte

1. Registrieren Sie sich für mindestens einen API-Service
2. Erstellen Sie die `.env` Datei mit Ihren Schlüsseln
3. Starten Sie das System neu
4. Überwachen Sie die Logs auf erfolgreiche Datenabfragen

Das System wird jetzt automatisch zwischen den verfügbaren Providern wechseln und robuster mit Fehlern umgehen.
