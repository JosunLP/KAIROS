# ML Service Dockerfile für KAIROS
FROM python:3.11-slim

WORKDIR /app

# System-Abhängigkeiten installieren
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python-Abhängigkeiten kopieren
COPY ml-service/requirements.txt .

# Python-Pakete installieren
RUN pip install --no-cache-dir -r requirements.txt

# ML-Service Code kopieren
COPY ml-service/ .

# Modellverzeichnis erstellen
RUN mkdir -p /app/models /app/logs

# Non-root User erstellen
RUN adduser --disabled-password --gecos '' mluser
RUN chown -R mluser:mluser /app
USER mluser

# Port exponieren
EXPOSE 8080

# Health-Check Endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Startbefehl
CMD ["python", "app.py"]
