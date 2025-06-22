# KAIROS Unified Docker Compose Setup

## Übersicht

Das neue Docker Compose Setup bietet eine einheitliche Architektur für alle Umgebungen (Development, Staging, Production) mit einer Basis-Konfiguration und umgebungsspezifischen Overrides.

## Architektur

```
docker-compose.yml          # Basis-Konfiguration (gemeinsame Services)
├── docker-compose.dev.yml  # Development-spezifische Overrides
├── docker-compose.staging.yml # Staging-spezifische Overrides
└── docker-compose.prod.yml # Production-spezifische Overrides
```

## Services

### Basis-Services (docker-compose.yml)

- **postgres**: PostgreSQL Datenbank
- **ml-service**: Machine Learning Service (Python)
- **kairos**: Hauptanwendung (Node.js)
- **redis**: Cache-Service (optional)
- **db-init**: Datenbank-Initialisierung
- **prisma-studio**: Datenbank-UI (Development)

## Umgebungen

### Development

```bash
# Start Development Environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Mit Redis Cache
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile cache up

# Nur Datenbank-Initialisierung
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile init up db-init
```

**Features:**

- Hot-Reload für Source Code
- Debug-Logging
- Häufigere Cron-Jobs
- Prisma Studio verfügbar
- Separate Development-Datenbank

### Staging

```bash
# Start Staging Environment
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# Mit Redis Cache
docker-compose -f docker-compose.yml -f docker-compose.staging.yml --profile cache up
```

**Features:**

- Optimierte Cron-Schedules
- Info-Level Logging
- Separate Staging-Datenbank
- Ressourcen-Limits

### Production

```bash
# Start Production Environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Mit Redis Cache
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up
```

**Features:**

- Strenge Ressourcen-Limits
- Warn-Level Logging
- Optimierte Performance
- Production-Cron-Schedules

## Konfiguration

### Environment Variables

Kopieren Sie `env.example` zu `.env` und passen Sie die Werte an:

```bash
cp env.example .env
```

**Wichtige Variablen:**

- `POSTGRES_PASSWORD`: Datenbank-Passwort (Production: erforderlich)
- `REDIS_PASSWORD`: Redis-Passwort (optional)
- `NODE_ENV`: Umgebung (development/staging/production)
- `LOG_LEVEL`: Logging-Level (debug/info/warn/error)

### Ports

| Service       | Development | Staging | Production |
| ------------- | ----------- | ------- | ---------- |
| App           | 3000        | 3001    | 3000       |
| PostgreSQL    | 5433        | 5434    | 5432       |
| ML Service    | 8081        | 8082    | 8080       |
| Redis         | 6379        | 6379    | 6379       |
| Prisma Studio | 5555        | -       | -          |

## Befehle

### Basis-Befehle

```bash
# Start aller Services
docker-compose -f docker-compose.yml -f docker-compose.{env}.yml up

# Start im Hintergrund
docker-compose -f docker-compose.yml -f docker-compose.{env}.yml up -d

# Stop Services
docker-compose -f docker-compose.yml -f docker-compose.{env}.yml down

# Rebuild Images
docker-compose -f docker-compose.yml -f docker-compose.{env}.yml build

# Logs anzeigen
docker-compose -f docker-compose.yml -f docker-compose.{env}.yml logs -f

# Spezifischen Service starten
docker-compose -f docker-compose.yml -f docker-compose.{env}.yml up kairos
```

### Development-spezifische Befehle

```bash
# Start mit Hot-Reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Prisma Studio öffnen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up prisma-studio

# Datenbank zurücksetzen
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Production-spezifische Befehle

```bash
# Production mit Redis
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up -d

# Datenbank-Initialisierung
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile init up db-init

# Health Check
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Profiles

### Cache Profile

Aktiviert Redis für Caching:

```bash
docker-compose --profile cache up
```

### Init Profile

Führt nur die Datenbank-Initialisierung aus:

```bash
docker-compose --profile init up db-init
```

### Dev Profile

Aktiviert Development-Tools (Prisma Studio):

```bash
docker-compose --profile dev up
```

## Volumes

| Volume                  | Beschreibung           | Persistenz |
| ----------------------- | ---------------------- | ---------- |
| `postgres_data`         | PostgreSQL Daten       | ✅         |
| `postgres_dev_data`     | Development DB         | ✅         |
| `postgres_staging_data` | Staging DB             | ✅         |
| `postgres_prod_data`    | Production DB          | ✅         |
| `ml_models`             | ML Modelle             | ✅         |
| `ml_models_dev`         | Development ML Modelle | ✅         |
| `ml_logs`               | ML Service Logs        | ❌         |
| `ml_logs_dev`           | Development ML Logs    | ❌         |
| `redis_data`            | Redis Daten            | ✅         |

## Monitoring & Debugging

### Health Checks

Alle Services haben Health Checks konfiguriert:

```bash
# Health Status prüfen
docker-compose ps
```

### Logs

```bash
# Alle Logs
docker-compose logs -f

# Spezifischer Service
docker-compose logs -f kairos

# Letzte 100 Zeilen
docker-compose logs --tail=100 kairos
```

### Container-Zugriff

```bash
# Shell in Container
docker-compose exec kairos sh

# Datenbank-Zugriff
docker-compose exec postgres psql -U kairos -d kairos

# ML Service Logs
docker-compose exec ml-service tail -f /app/logs/ml.log
```

## Troubleshooting

### Häufige Probleme

1. **Port bereits belegt**

   ```bash
   # Ports prüfen
   netstat -tulpn | grep :3000

   # Anderen Port verwenden
   APP_PORT=3001 docker-compose up
   ```

2. **Datenbank-Verbindung fehlschlägt**

   ```bash
   # Datenbank-Container Status
   docker-compose ps postgres

   # Datenbank-Logs
   docker-compose logs postgres
   ```

3. **ML Service startet nicht**

   ```bash
   # ML Service Logs
   docker-compose logs ml-service

   # Python-Abhängigkeiten prüfen
   docker-compose exec ml-service pip list
   ```

### Cleanup

```bash
# Alle Container und Volumes löschen
docker-compose down -v

# Images neu bauen
docker-compose build --no-cache

# Docker System Cleanup
docker system prune -a
```

## Deployment

### Production Deployment

1. **Environment Setup**

   ```bash
   cp env.example .env
   # .env mit Production-Werten anpassen
   ```

2. **Start Production**

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up -d
   ```

3. **Datenbank-Initialisierung**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile init up db-init
   ```

### CI/CD Integration

```yaml
# Beispiel GitHub Actions
- name: Deploy to Production
  run: |
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up -d
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile init up db-init
```

## Migration von altem Setup

1. **Backup erstellen**

   ```bash
   docker-compose exec postgres pg_dump -U kairos kairos > backup.sql
   ```

2. **Neues Setup starten**

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. **Daten migrieren**
   ```bash
   docker-compose exec -T postgres psql -U kairos kairos < backup.sql
   ```

## Best Practices

1. **Environment-spezifische .env Dateien**

   - `.env.dev` für Development
   - `.env.staging` für Staging
   - `.env.prod` für Production

2. **Sicherheit**

   - Starke Passwörter in Production
   - Keine Secrets in Git
   - Non-root User in Containern

3. **Performance**

   - Ressourcen-Limits setzen
   - Health Checks konfigurieren
   - Logging-Level anpassen

4. **Monitoring**
   - Logs zentral sammeln
   - Health Checks überwachen
   - Ressourcen-Nutzung tracken
