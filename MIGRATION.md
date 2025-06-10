# 🔄 KAIROS Migration Guide: Docker Multi-Container

Dieser Guide beschreibt die Migration von KAIROS zu einer Multi-Container-Docker-Architektur.

## 🚀 Was ist neu?

### Alte Architektur

- Monolithische Anwendung
- SQLite-Datenbank im Container
- Lokale ML-Modelle im Dateisystem

### Neue Architektur

- **Microservices-basiert** mit separaten Containern
- **PostgreSQL** als externe Datenbank
- **ML-Service** als separater Python Flask-Service
- **Bessere Skalierbarkeit** und Wartung

## 📦 Container-Übersicht

| Service | Port | Beschreibung |
|---------|------|--------------|
| kairos | - | Haupt-NestJS-Anwendung |
| postgres | 5432/5433 | PostgreSQL-Datenbank |
| ml-service | 8080/8081 | Python ML-Service |
| prisma-studio | 5555/5556 | Datenbankvisualisierung |

## 🔧 Migration Schritte

### 1. Backup der bestehenden Daten

```bash
# SQLite-Datenbank exportieren
sqlite3 prisma/kairos.db .dump > backup-sqlite.sql

# Docker Volumes sichern
docker-compose down
docker run --rm -v kairos_kairos_data:/data -v $(pwd):/backup alpine tar czf /backup/kairos-data-backup.tar.gz /data
```

### 2. Neue Container-Architektur starten

```bash
# Automatisches Setup
npm run docker:setup

# Oder manuell
npm run docker:dev:up  # Für Entwicklung
npm run docker:compose:up  # Für Produktion
```

### 3. Datenbank-Migration

```bash
# Schema auf PostgreSQL migrieren
docker-compose exec kairos npx prisma migrate dev --name init

# Daten manuell migrieren (siehe unten)
```

### 4. ML-Service testen

```bash
# ML-Service Status prüfen
npm run docker:ml:health

# Verfügbare Modelle auflisten
npm run docker:ml:models
```

## 🗃️ Datenbank-Migration (SQLite → PostgreSQL)

### Automatisierte Migration (empfohlen)

```bash
# Migration Script ausführen
node scripts/migrate-sqlite-to-postgres.js
```

### Manuelle Migration

```bash
# 1. SQLite-Daten exportieren
sqlite3 prisma/kairos.db ".headers on" ".mode csv" ".output data.csv" "SELECT * FROM stocks;"

# 2. In PostgreSQL importieren
docker-compose exec postgres psql -U kairos -d kairos -c "\COPY stocks FROM '/tmp/data.csv' DELIMITER ',' CSV HEADER;"
```

## 🧪 ML-Service Integration

### Neue ML-Service Features

- **REST API** für ML-Operationen
- **Modell-Persistierung** in separatem Volume
- **Horizontal skalierbar**
- **Python-basiert** mit scikit-learn

### API-Endpunkte

```bash
GET /health                 # Health Check
GET /models                 # Verfügbare Modelle
POST /train                 # Modell trainieren
POST /predict               # Vorhersage machen
POST /load/{model_name}     # Modell laden
POST /unload/{model_name}   # Modell entladen
```

### Integration in NestJS

```typescript
// ML-Service verwenden
const result = await this.mlClientService.trainModel({
  features: trainingFeatures,
  target: trainingTargets,
  model_name: 'my_model'
});

// Vorhersage machen
const prediction = await this.mlClientService.predict({
  features: inputFeatures,
  model_name: 'my_model'
});
```

## 🔧 Entwicklung

### Hot-Reload Development

```bash
# Entwicklungsumgebung starten
docker-compose -f docker-compose.dev.yml up -d

# Logs verfolgen
docker-compose -f docker-compose.dev.yml logs -f
```

### Debugging

```bash
# In Container einsteigen
docker-compose exec kairos-dev bash

# ML-Service debuggen
docker-compose logs ml-service-dev

# Datenbank-Konsole
docker-compose exec postgres-dev psql -U kairos_dev -d kairos_dev
```

## 🚦 Testing

### Service-Tests

```bash
# Hauptanwendung testen
docker-compose exec kairos npm test

# ML-Service testen
curl -X POST http://localhost:8081/train \
  -H "Content-Type: application/json" \
  -d '{"features": [[1,2,3]], "target": [1], "model_name": "test"}'
```

### Integration Tests

```bash
# Komplette Pipeline testen
npm run test:integration:docker
```

## 📊 Monitoring & Logs

### Container Health

```bash
# Alle Services prüfen
docker-compose ps

# Health Checks
docker-compose exec postgres pg_isready
curl http://localhost:8080/health
```

### Logs

```bash
# Alle Logs
docker-compose logs

# Spezifische Services
docker-compose logs kairos
docker-compose logs ml-service
docker-compose logs postgres
```

## 🔒 Produktions-Deployment

### Environment-Konfiguration

```bash
# Produktions-Umgebung
cp .env.example .env.prod

# Sichere Passwörter setzen
export POSTGRES_PASSWORD="$(openssl rand -base64 32)"
export ML_SERVICE_SECRET="$(openssl rand -base64 32)"
```

### Sicherheit

- Verwenden Sie starke Passwörter
- Konfigurieren Sie Firewall-Regeln
- Aktivieren Sie SSL/TLS für externe Verbindungen
- Regelmäßige Security-Updates

### Backup-Strategie

```bash
# Automatische Backups
docker-compose exec postgres pg_dump -U kairos kairos | gzip > backup-$(date +%Y%m%d).sql.gz

# Modell-Backups
docker-compose exec ml-service tar czf - /app/models > models-backup-$(date +%Y%m%d).tar.gz
```

## 🛠️ Troubleshooting

### Häufige Probleme

**Port-Konflikte:**

```bash
# Verwendete Ports prüfen
netstat -tulpn | grep :5432

# Alternative Ports konfigurieren
vim docker-compose.yml  # ports: "5434:5432"
```

**Container startet nicht:**

```bash
# Logs prüfen
docker-compose logs container_name

# Konfiguration validieren
docker-compose config
```

**Datenbank-Verbindung fehlgeschlagen:**

```bash
# Verbindung testen
docker-compose exec kairos npm run test:db

# Connection String prüfen
echo $DATABASE_URL
```

**ML-Service nicht erreichbar:**

```bash
# Service neustarten
docker-compose restart ml-service

# Logs prüfen
docker-compose logs ml-service

# Health Check
curl -f http://localhost:8080/health || echo "Service down"
```

### Performance-Optimierung

```bash
# Resource-Limits setzen
docker-compose config | grep -A5 deploy:

# Memory-Usage überwachen
docker stats

# Volume-Performance
docker volume ls
docker system df
```

## 📚 Weitere Ressourcen

- [Docker Compose Best Practices](https://docs.docker.com/compose/production/)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [Python Flask Deployment](https://flask.palletsprojects.com/en/2.0.x/deploying/)

## 🆘 Support

Bei Problemen:

1. Prüfen Sie die Container-Logs
2. Validieren Sie die Konfiguration
3. Konsultieren Sie die Troubleshooting-Sektion
4. Erstellen Sie ein Issue im Repository

---

## **Happy Dockerizing! 🐳**
