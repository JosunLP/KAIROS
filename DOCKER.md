# Docker Guide für KAIROS

## Verfügbare Docker-Befehle

### Basis-Befehle

```powershell
# Projekt kompilieren
npm run build

# Docker Images erstellen
npm run docker:build              # Produktions-Image
npm run docker:build:dev          # Entwicklungs-Image
npm run docker:build:all          # Beide Images + TypeScript Build

# Container starten
npm run docker:run                # Produktions-Container
npm run docker:run:dev            # Entwicklungs-Container mit Volume-Mounting
```

### Docker Compose Befehle

```powershell
# Produktion
npm run docker:compose:up         # Alle Services starten
npm run docker:compose:down       # Alle Services stoppen
npm run docker:compose:build      # Services neu bauen
npm run docker:compose:rebuild    # Kompletter Neuaufbau ohne Cache

# Entwicklung (mit dev-Profil)
docker-compose --profile dev up -d
docker-compose --profile dev down

# Prisma Studio (Datenbankvisualisierung)
docker-compose --profile dev up prisma-studio
# Verfügbar unter: http://localhost:5555
```

### Wartung und Debugging

```powershell
# Logs anzeigen
npm run docker:logs               # Alle Container-Logs
docker-compose logs -f kairos     # Nur KAIROS-App Logs

# System aufräumen
npm run docker:clean              # Ungenutztes Docker-Zeug entfernen

# Container-Shell öffnen
docker exec -it kairos-app sh     # Produktions-Container
docker exec -it kairos-dev sh     # Entwicklungs-Container
```

## Schnellstart

### Für Entwicklung

```powershell
# 1. Projekt initialisieren
npm run setup

# 2. Entwicklungs-Container starten
npm run docker:build:dev
npm run docker:run:dev

# 3. Oder mit Docker Compose
docker-compose --profile dev up -d
```

### Für Produktion

```powershell
# 1. Projekt bauen und Container erstellen
npm run docker:build:all

# 2. Produktions-Container starten
npm run docker:compose:up

# 3. CLI verwenden
docker exec -it kairos-app node dist/main.js
```

## Persistente Daten

### Volumes

- `kairos_data` - Produktions-Datenbank
- `kairos_models` - ML-Modelle (Produktion)
- `kairos_logs` - Log-Dateien (Produktion)
- `kairos_data_dev` - Entwicklungs-Datenbank
- `kairos_models_dev` - ML-Modelle (Entwicklung)
- `kairos_logs_dev` - Log-Dateien (Entwicklung)

### Datenbankzugriff

```powershell
# Prisma Studio für Datenbankvisualisierung
docker-compose --profile dev up prisma-studio
# Dann: http://localhost:5555 öffnen
```

## Tipps

1. **Hot-Reload**: Der Entwicklungs-Container unterstützt automatisches Neuladen bei Code-Änderungen
2. **Environment Variables**: Legen Sie eine `.env` Datei für sensible Daten an
3. **Logs**: Logs werden persistent gespeichert und können mit `npm run docker:logs` eingesehen werden
4. **Performance**: Verwenden Sie `npm run docker:build:all` für optimale Performance
5. **Debugging**: Nutzen Sie `docker exec -it kairos-app sh` für direkten Container-Zugriff

## Fehlerbehebung

### Container startet nicht

```powershell
# Logs prüfen
npm run docker:logs

# Container-Status prüfen
docker ps -a

# Images neu bauen
npm run docker:compose:rebuild
```

### Datenbank-Probleme

```powershell
# Prisma Client neu generieren
docker exec -it kairos-app npx prisma generate

# Datenbank zurücksetzen (VORSICHT!)
docker exec -it kairos-app npx prisma migrate reset --force
```

### Port-Konflikte

```powershell
# Verwendete Ports prüfen
netstat -an | findstr :3000
netstat -an | findstr :5555

# Andere Ports in docker-compose.yml konfigurieren
```
