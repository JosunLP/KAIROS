# KAIROS Dockerfile
FROM node:18-alpine AS build

# Install system dependencies
RUN apk add --no-cache python3 make g++ bash curl

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build && npx prisma generate

# Production stage  
FROM node:18-alpine AS production

RUN apk add --no-cache bash curl

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Create user and directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001 -G nodejs && \
    mkdir -p /app/logs /app/models /app/data /app/scripts && \
    chown -R kairos:nodejs /app

# Create init script directly in Dockerfile
RUN cat > /app/scripts/docker-init.sh << 'EOF'
#!/bin/bash
echo "🚀 KAIROS Docker Initialisierung..."

# Warten auf Datenbank
echo "⏳ Warte auf PostgreSQL..."
until npx prisma db ping > /dev/null 2>&1; do
  echo "  - Datenbank noch nicht bereit, warte 2 Sekunden..."
  sleep 2
done

echo "✅ Datenbank ist bereit!"

# Prisma-Schema anwenden
echo "🔄 Wende Prisma-Schema an..."
npx prisma db push

echo "✅ Initialisierung abgeschlossen!"

# Anwendung starten
echo "🚀 Starte KAIROS..."
exec "$@"
EOF

# Make script executable
RUN chmod +x /app/scripts/docker-init.sh

# Switch to non-root user
USER kairos

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Labels
LABEL org.opencontainers.image.title="KAIROS"
LABEL org.opencontainers.image.description="KI-gestützte Aktienanalyse-CLI"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="KAIROS Team"

# Use init script as entrypoint
ENTRYPOINT ["/app/scripts/docker-init.sh"]
CMD ["npm", "run", "start:prod"]
