# KAIROS Docker Quick Start Guide

## 🚀 Schnellstart

### Voraussetzungen

- Docker Desktop installiert und gestartet
- Git installiert
- PowerShell (Windows) oder Bash (Linux/Mac)

### 1. Repository klonen

```bash
git clone <repository-url>
cd KAIROS
```

### 2. Environment konfigurieren

```bash
# Environment-Datei erstellen
cp env.example .env

# .env-Datei bearbeiten (wichtige Werte anpassen)
# POSTGRES_PASSWORD=your_secure_password
# NODE_ENV=development
```

### 3. Development Environment starten

**Windows (PowerShell):**

```powershell
.\scripts\docker-dev.ps1 start
```

**Linux/Mac (Bash):**

```bash
./scripts/docker-dev.sh start
```

**Manuell:**

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 4. Services überprüfen

- **Anwendung**: http://localhost:3000
- **Datenbank**: localhost:5433
- **ML Service**: http://localhost:8081
- **Prisma Studio**: http://localhost:5555

## 📋 Häufige Befehle

### Development

```bash
# Environment starten
.\scripts\docker-dev.ps1 start

# Logs anzeigen
.\scripts\docker-dev.ps1 logs-app

# Shell öffnen
.\scripts\docker-dev.ps1 shell

# Datenbank zurücksetzen
.\scripts\docker-dev.ps1 db-reset

# Prisma Studio starten
.\scripts\docker-dev.ps1 studio

# Environment stoppen
.\scripts\docker-dev.ps1 stop
```

### Production

```bash
# Production deployen
.\scripts\docker-prod.ps1 deploy

# Status prüfen
.\scripts\docker-prod.ps1 status

# Backup erstellen
.\scripts\docker-prod.ps1 backup

# Health Check
.\scripts\docker-prod.ps1 health
```

## 🔧 Umgebungen

### Development

- Hot-Reload aktiviert
- Debug-Logging
- Häufige Cron-Jobs
- Prisma Studio verfügbar

### Staging

- Optimierte Performance
- Info-Level Logging
- Separate Datenbank

### Production

- Strenge Ressourcen-Limits
- Warn-Level Logging
- Redis Cache
- Backup-Funktionen

## 🛠️ Troubleshooting

### Port bereits belegt

```bash
# Ports prüfen
netstat -an | findstr :3000

# Anderen Port verwenden
APP_PORT=3001 docker-compose up
```

### Docker nicht gestartet

```bash
# Docker Desktop starten
# Dann erneut versuchen
.\scripts\docker-dev.ps1 start
```

### Datenbank-Probleme

```bash
# Datenbank zurücksetzen
.\scripts\docker-dev.ps1 db-reset

# Oder manuell
docker-compose down -v
docker-compose up -d
```

### Images neu bauen

```bash
# Alle Images neu bauen
.\scripts\docker-dev.ps1 build

# Oder manuell
docker-compose build --no-cache
```

## 📁 Dateistruktur

```
KAIROS/
├── docker-compose.yml          # Basis-Konfiguration
├── docker-compose.dev.yml      # Development Overrides
├── docker-compose.staging.yml  # Staging Overrides
├── docker-compose.prod.yml     # Production Overrides
├── Dockerfile                  # Unified Dockerfile
├── Dockerfile.ml               # ML Service Dockerfile
├── env.example                 # Environment Template
├── .env                        # Environment (erstellen)
├── scripts/
│   ├── docker-dev.ps1         # Development Script (Windows)
│   ├── docker-dev.sh          # Development Script (Linux/Mac)
│   ├── docker-prod.ps1        # Production Script (Windows)
│   └── docker-prod.sh         # Production Script (Linux/Mac)
└── DOCKER_UNIFIED.md          # Vollständige Dokumentation
```

## 🔐 Sicherheit

### Production Setup

1. Starke Passwörter in `.env` setzen
2. `NODE_ENV=production` konfigurieren
3. Redis-Passwort setzen
4. Firewall-Regeln konfigurieren

### Environment Variables

```bash
# Wichtig für Production
POSTGRES_PASSWORD=very_secure_password
REDIS_PASSWORD=another_secure_password
NODE_ENV=production
LOG_LEVEL=warn
```

## 📊 Monitoring

### Health Checks

```bash
# Status aller Services
.\scripts\docker-dev.ps1 status

# Health Check (Production)
.\scripts\docker-prod.ps1 health
```

### Logs

```bash
# Alle Logs
.\scripts\docker-dev.ps1 logs

# Spezifische Service-Logs
.\scripts\docker-dev.ps1 logs-app
.\scripts\docker-dev.ps1 logs-db
.\scripts\docker-dev.ps1 logs-ml
```

## 🚀 Deployment

### Development → Staging

```bash
# Staging Environment starten
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Staging → Production

```bash
# Production deployen
.\scripts\docker-prod.ps1 deploy

# Mit Redis Cache
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up -d
```

## 📚 Weitere Dokumentation

- **Vollständige Dokumentation**: `DOCKER_UNIFIED.md`
- **Architektur-Übersicht**: Siehe `DOCKER_UNIFIED.md`
- **Troubleshooting**: Siehe `DOCKER_UNIFIED.md`

## 🆘 Support

Bei Problemen:

1. Logs prüfen: `.\scripts\docker-dev.ps1 logs`
2. Status prüfen: `.\scripts\docker-dev.ps1 status`
3. Docker neu starten
4. Vollständige Dokumentation lesen: `DOCKER_UNIFIED.md`
