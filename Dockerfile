# Multi-stage build für optimale Container-Größe
FROM node:18-alpine3.20 AS base

# Arbeitsverzeichnis setzen
WORKDIR /app

# System-Abhängigkeiten für native Module installieren
RUN apk add --no-cache python3 make g++

# Package.json und package-lock.json kopieren
COPY package*.json ./
COPY prisma ./prisma/

# Abhängigkeiten installieren
RUN npm ci --only=production && npm cache clean --force

# === Build-Stage ===
FROM node:18-alpine3.20 AS build

WORKDIR /app

# System-Abhängigkeiten
RUN apk add --no-cache python3 make g++

# Alle Dateien kopieren
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/
COPY prisma ./prisma/

# Alle Abhängigkeiten installieren (inkl. dev)
RUN npm ci

# Prisma Client generieren
RUN npx prisma generate

# TypeScript kompilieren
RUN npm run build

# === Production-Stage ===
FROM node:18-alpine3.20 AS production

WORKDIR /app

# Nicht-root User erstellen für Sicherheit
RUN addgroup -g 1001 -S nodejs
RUN adduser -S kairos -u 1001

# Produktions-Abhängigkeiten aus base-stage kopieren
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Kompilierte Anwendung aus build-stage kopieren
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Modellverzeichnis erstellen
RUN mkdir -p ./models && chown -R kairos:nodejs ./models

# Datenbankverzeichnis erstellen
RUN mkdir -p ./data && chown -R kairos:nodejs ./data

# Log-Verzeichnis erstellen
RUN mkdir -p ./logs && chown -R kairos:nodejs ./logs

# Berechtigungen für User setzen
RUN chown -R kairos:nodejs /app

# Zu nicht-root User wechseln
USER kairos

# Prisma Client generieren
RUN npx prisma generate

# Healthcheck hinzufügen
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Port exponieren (falls später Web-Interface hinzugefügt wird)
EXPOSE 3000

# Startbefehl
CMD ["node", "dist/main.js"]

# Labels für bessere Wartung
LABEL org.opencontainers.image.title="KAIROS"
LABEL org.opencontainers.image.description="KI-gestützte Aktienanalyse-CLI"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="KAIROS Team"
