# KAIROS Unified Dockerfile
# Supports development, staging, and production environments

# Build arguments
ARG NODE_VERSION=18
ARG PYTHON_VERSION=3.11

# Base stage for shared dependencies
FROM node:${NODE_VERSION}-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash \
    curl \
    openssl \
    git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Build stage
FROM base AS build

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Development stage
FROM base AS development

# Copy source code for hot reload
COPY . .

# Create user and directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001 -G nodejs && \
    mkdir -p /app/logs /app/models /app/data /app/scripts && \
    chown -R kairos:nodejs /app

# Switch to non-root user
USER kairos

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "start:dev"]

# Init stage for database operations
FROM base AS init

# Create user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001 -G nodejs && \
    mkdir -p /app/logs /app/models /app/data /app/scripts && \
    chown -R kairos:nodejs /app

USER kairos

# Production stage
FROM node:${NODE_VERSION}-alpine AS production

# Install production dependencies only
RUN apk add --no-cache bash curl openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Create user and directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001 -G nodejs && \
    mkdir -p /app/logs /app/models /app/data /app/scripts && \
    chown -R kairos:nodejs /app

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

# Production command
CMD ["npm", "run", "start:prod"]
