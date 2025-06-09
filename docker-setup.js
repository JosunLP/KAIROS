#!/usr/bin/env node

/**
 * Docker Setup Script für KAIROS
 * Dieses Script automatisiert den gesamten Docker-Setup-Prozess
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ ${description} erfolgreich!`);
        return true;
    } catch (error) {
        console.error(`❌ Fehler bei: ${description}`);
        console.error(error.message);
        return false;
    }
}

function checkDocker() {
    console.log('\n🔍 Docker-Installation prüfen...');
    try {
        execSync('docker --version', { stdio: 'ignore' });
        execSync('docker-compose --version', { stdio: 'ignore' });
        console.log('✅ Docker und Docker Compose sind installiert');
        return true;
    } catch (error) {
        console.error('❌ Docker oder Docker Compose nicht gefunden!');
        console.error('Bitte installieren Sie Docker Desktop: https://www.docker.com/products/docker-desktop');
        return false;
    }
}

function checkFiles() {
    console.log('\n🔍 Erforderliche Dateien prüfen...');
    const requiredFiles = [
        'Dockerfile',
        'Dockerfile.dev',
        'docker-compose.yml',
        'package.json',
        'prisma/schema.prisma'
    ];
    
    let allExists = true;
    for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file} gefunden`);
        } else {
            console.error(`❌ ${file} nicht gefunden!`);
            allExists = false;
        }
    }
    return allExists;
}

function createEnvFile() {
    const envPath = '.env';
    if (!fs.existsSync(envPath)) {
        console.log('\n📝 .env Datei erstellen...');
        const envContent = `# KAIROS Environment Variables
NODE_ENV=production
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
LOG_FILE_PATH=/app/logs/kairos.log

# Database
DATABASE_URL=file:/app/data/kairos.db

# API Keys (Optional - ergänzen Sie diese nach Bedarf)
# ALPHA_VANTAGE_API_KEY=your_key_here
# FINNHUB_API_KEY=your_key_here
# POLYGON_API_KEY=your_key_here

# Entwicklung
PRISMA_STUDIO_PORT=5555
`;
        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env Datei erstellt');
    } else {
        console.log('✅ .env Datei bereits vorhanden');
    }
}

async function main() {
    console.log('🚀 KAIROS Docker Setup');
    console.log('======================');
    
    // 1. Grundlegende Prüfungen
    if (!checkDocker()) {
        process.exit(1);
    }
    
    if (!checkFiles()) {
        process.exit(1);
    }
    
    // 2. Environment-Datei erstellen
    createEnvFile();
    
    // 3. Dependencies installieren
    if (!runCommand('npm install', 'NPM-Abhängigkeiten installieren')) {
        process.exit(1);
    }
    
    // 4. Prisma Setup
    if (!runCommand('npx prisma generate', 'Prisma Client generieren')) {
        process.exit(1);
    }
    
    // 5. TypeScript kompilieren
    if (!runCommand('npm run build', 'TypeScript kompilieren')) {
        process.exit(1);
    }
    
    // 6. Docker Images erstellen
    if (!runCommand('npm run docker:build', 'Produktions-Docker-Image erstellen')) {
        process.exit(1);
    }
    
    if (!runCommand('npm run docker:build:dev', 'Entwicklungs-Docker-Image erstellen')) {
        process.exit(1);
    }
    
    // 7. Docker Compose Services erstellen
    if (!runCommand('docker-compose up -d', 'Docker Compose Services starten')) {
        process.exit(1);
    }
    
    console.log('\n🎉 Setup erfolgreich abgeschlossen!');
    console.log('\n📋 Nächste Schritte:');
    console.log('   • CLI verwenden: docker exec -it kairos-app node dist/main.js');
    console.log('   • Logs anzeigen: npm run docker:logs');
    console.log('   • Development: docker-compose --profile dev up -d');
    console.log('   • Prisma Studio: docker-compose --profile dev up prisma-studio');
    console.log('   • Weitere Infos: DOCKER.md lesen');
    
    console.log('\n🔧 Verfügbare Befehle:');
    console.log('   npm run docker:compose:up    - Services starten');
    console.log('   npm run docker:compose:down  - Services stoppen');
    console.log('   npm run docker:logs          - Logs anzeigen');
    console.log('   npm run docker:clean         - Aufräumen');
}

main().catch(console.error);
