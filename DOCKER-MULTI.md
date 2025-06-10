# 🐳 KAIROS Docker Setup - Multi-Container Architektur

Diese Anleitung beschreibt, wie Sie KAIROS mit Docker in einer modernen Multi-Container-Architektur ausführen.

## 🏗️ Neue Architektur

KAIROS verwendet jetzt eine moderne Multi-Container-Architektur mit separaten Services:

- **Haupt-Anwendung**: NestJS-basierte CLI-Anwendung
- **PostgreSQL-Datenbank**: Persistente Datenbank für Aktien- und Analysedaten
- **ML-Service**: Python Flask-Service für Machine Learning Operationen
- **Redis** (optional): Caching-Layer für bessere Performance

## 🚀 Quick Start

### Automatisches Setup

```bash
# Docker Setup Script ausführen
npm run docker:setup
```

Das Script führt Sie durch die Konfiguration und startet automatisch alle benötigten Container.

### Manuelle Konfiguration

#### 1. Umgebungsvariablen konfigurieren

```bash
# Für Entwicklung
cp .env.dev .env.local

# Für Produktion (Standard .env verwenden)
```

#### 2. Container starten

**Entwicklungsumgebung:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Produktionsumgebung:**

```bash
docker-compose up -d
```

**Nur Services (ohne Hauptanwendung):**

```bash
docker-compose up -d postgres ml-service
```

## 📦 Services

### PostgreSQL Datenbank

- **Port**: 5432 (Produktion), 5433 (Entwicklung)
- **Benutzer**: `kairos` / `kairos_dev`
- **Datenbank**: `kairos` / `kairos_dev`
- **Persistenz**: Docker Volume
- **Health Check**: Integriert

### ML Service

- **Port**: 8080 (Produktion), 8081 (Entwicklung)
- **API**: REST-API für ML-Operationen
- **Modelle**: Persistent in Docker Volume gespeichert
- **Health Check**: `GET /health`
- **Technologie**: Python Flask mit scikit-learn

### Hauptanwendung

- **Port**: 3000 (nur in Entwicklung)
- **CLI-Zugriff**: `docker-compose exec kairos kairos --help`
- **Hot-Reload**: Aktiviert in Entwicklungsumgebung
- **Database**: PostgreSQL (statt SQLite)

### Prisma Studio

- **Port**: 5555 (Produktion), 5556 (Entwicklung)
- **URL**: <http://localhost:5556>
- **Datenbankvisualisierung und -bearbeitung**

## 🔧 Nützliche Befehle

### Container-Management

```bash
# Status aller Container anzeigen
docker-compose ps

# Logs anzeigen
docker-compose logs -f

# Bestimmten Service neustarten
docker-compose restart kairos

# Container stoppen
docker-compose down

# Container und Volumes löschen
docker-compose down -v
```

### Entwicklung

```bash
# Entwicklungscontainer mit Hot-Reload
docker-compose -f docker-compose.dev.yml up -d

# In Container einsteigen
docker-compose -f docker-compose.dev.yml exec kairos-dev bash

# Prisma Migrationen
docker-compose -f docker-compose.dev.yml exec kairos-dev npx prisma migrate dev

# Tests ausführen
docker-compose -f docker-compose.dev.yml exec kairos-dev npm test
```

### Datenbank-Management

```bash
# Datenbank-Backup erstellen
docker-compose exec postgres pg_dump -U kairos kairos > backup.sql

# Backup wiederherstellen
docker-compose exec -T postgres psql -U kairos kairos < backup.sql

# Direkte Datenbankverbindung
docker-compose exec postgres psql -U kairos -d kairos
```

### ML Service curl

```bash
# ML Service Status prüfen
curl http://localhost:8080/health

# Verfügbare Modelle anzeigen
curl http://localhost:8080/models

# ML Service Logs
docker-compose logs -f ml-service

# Modell laden
curl -X POST http://localhost:8080/load/my_model
```

## 🛠️ Entwicklung

### Hot-Reload aktivieren

```bash
# Entwicklungsumgebung mit Hot-Reload
docker-compose -f docker-compose.dev.yml up -d
```

### Code-Changes

- Änderungen in `src/` werden automatisch neu geladen
- TypeScript wird automatisch kompiliert
- Container muss nicht neu gestartet werden

### Debugging

```bash
# Debug-Logs aktivieren
export LOG_LEVEL=debug
docker-compose -f docker-compose.dev.yml restart kairos-dev

# Detaillierte Container-Informationen
docker-compose -f docker-compose.dev.yml exec kairos-dev env
```

## 🔄 Migration von SQLite zu PostgreSQL

Die neue Architektur verwendet PostgreSQL statt SQLite. Wichtige Änderungen:

### Schema-Änderungen

- Prisma Schema wurde auf PostgreSQL umgestellt
- UUID-Extension wird automatisch aktiviert
- Bessere Performance für größere Datenmengen

### Datenbank-URL

```bash
# Alt (SQLite)
DATABASE_URL="file:./kairos.db"

# Neu (PostgreSQL)
DATABASE_URL="postgresql://kairos:kairos_password@postgres:5432/kairos"
```

### Migration bestehender Daten

```bash
# 1. Alte SQLite-Datenbank exportieren
sqlite3 kairos.db .dump > export.sql

# 2. PostgreSQL-Schema erstellen
docker-compose exec kairos npx prisma migrate deploy

# 3. Daten anpassen und importieren (manuell erforderlich)
```

## 🔒 Sicherheit

### Produktionsumgebung

- Verwenden Sie starke Passwörter für die Datenbank
- Konfigurieren Sie Firewall-Regeln für exponierte Ports
- Regelmäßige Updates der Base-Images

### Geheimnisse verwalten

```bash
# Umgebungsvariablen aus Datei laden
docker-compose --env-file .env.prod up -d

# Passwörter in separaten Dateien
echo "mein_passwort" > db_password.txt
# In docker-compose.yml referenzieren
```

## 📊 Monitoring

### Container-Health

```bash
# Health-Status aller Services
docker-compose ps

# Detaillierte Health-Checks
docker inspect kairos-postgres --format='{{json .State.Health}}'
```

### Logs

```bash
# Alle Logs
docker-compose logs

# Nur Fehler
docker-compose logs | grep ERROR

# Live-Logs mit Timestamps
docker-compose logs -f -t
```

## 🐛 Troubleshooting

### Häufige Probleme

**Port bereits belegt:**

```bash
# Verwendete Ports prüfen
netstat -tulpn | grep :5432

# Alternative Ports in docker-compose.yml konfigurieren
ports:
  - "5434:5432"
```

**Container startet nicht:**

```bash
# Detaillierte Logs anzeigen
docker-compose logs kairos

# Container-Konfiguration prüfen
docker-compose config
```

**Datenbank-Verbindung fehlgeschlagen:**

```bash
# Datenbank-Container prüfen
docker-compose exec postgres pg_isready -U kairos

# Verbindungsstring testen
docker-compose exec kairos npm run test:db
```

**ML Service nicht verfügbar:**

```bash
# Service-Status prüfen
curl http://localhost:8080/health

# Service-Logs prüfen
docker-compose logs ml-service

# Service neustarten
docker-compose restart ml-service
```

### Log-Analyse

```bash
# Fehler in den letzten 100 Zeilen finden
docker-compose logs --tail=100 | grep -i error

# Performance-Metriken
docker stats

# Container-Details
docker inspect kairos-app
```

## 🆕 Neue Features

### ML Service API

```bash
# Modell trainieren
curl -X POST http://localhost:8080/train \
  -H "Content-Type: application/json" \
  -d '{"features": [[1,2,3]], "target": [1], "model_name": "test_model"}'

# Vorhersage machen
curl -X POST http://localhost:8080/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [1,2,3], "model_name": "test_model"}'
```

### Database-Service

- Automatische Backups
- Connection Pooling
- Query-Optimierung

### Scaling

```bash
# Mehrere ML Service Instanzen
docker-compose up -d --scale ml-service=3

# Load Balancer hinzufügen (nginx)
docker-compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
```

## 📚 Weiterführende Links

- [Docker Compose Dokumentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [NestJS Docker Best Practices](https://docs.nestjs.com/recipes/docker)
- [Prisma mit Docker](https://www.prisma.io/docs/guides/development-environment/developing-with-prisma-and-docker)
