#!/usr/bin/env node

/**
 * Docker Setup Script für KAIROS
 * Dieses Script automatisiert den gesamten Docker-Setup-Prozess mit separaten Containern
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

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
        console.error('❌ Docker oder Docker Compose ist nicht installiert!');
        console.error('Bitte installieren Sie Docker Desktop von: https://www.docker.com/products/docker-desktop');
        return false;
    }
}

async function setupEnvironment() {
    console.log('\n📁 Umgebung einrichten...');
    
    // .env.dev Datei prüfen
    if (!fs.existsSync('.env.dev')) {
        console.log('⚠️  .env.dev Datei nicht gefunden');
        console.log('Bitte bearbeiten Sie .env.dev mit Ihren API-Keys und Einstellungen.');
    }
    
    // Logs-Verzeichnis erstellen
    if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs', { recursive: true });
        console.log('✅ Logs-Verzeichnis erstellt');
    }
    
    // ML-Service Verzeichnis prüfen
    if (!fs.existsSync('./ml-service')) {
        console.error('❌ ML-Service Verzeichnis nicht gefunden!');
        return false;
    }
    
    return true;
}

async function selectEnvironment() {
    console.log('\n🔧 Welche Umgebung möchten Sie starten?');
    console.log('1. Entwicklung (mit Hot-Reload und Debug-Logs)');
    console.log('2. Produktion (optimiert für Performance)');
    console.log('3. Nur Datenbank und ML-Service');
    
    const choice = await askQuestion('Bitte wählen Sie (1-3): ');
    
    switch (choice.trim()) {
        case '1':
            return 'development';
        case '2':
            return 'production';
        case '3':
            return 'services-only';
        default:
            console.log('Ungültige Auswahl, verwende Entwicklung als Standard');
            return 'development';
    }
}

async function buildAndStartServices(environment) {
    console.log(`\n🏗️  ${environment.toUpperCase()}-Umgebung wird gestartet...`);
    
    if (environment === 'development') {
        return runCommand('docker-compose -f docker-compose.dev.yml up -d --build', 'Entwicklungsumgebung starten');
    } else if (environment === 'production') {
        return runCommand('docker-compose up -d --build', 'Produktionsumgebung starten');
    } else {
        return runCommand('docker-compose up -d postgres ml-service --build', 'Nur Services starten');
    }
}

async function showStatus(environment) {
    console.log('\n📊 Container-Status:');
    
    const statusCommand = environment === 'development'
        ? 'docker-compose -f docker-compose.dev.yml ps'
        : 'docker-compose ps';
    
    runCommand(statusCommand, 'Container Status');
    
    console.log('\n🔗 Verfügbare Services:');
    if (environment === 'development') {
        console.log('- Anwendung: http://localhost:3000');
        console.log('- PostgreSQL: localhost:5433');
        console.log('- ML Service: http://localhost:8081');
        console.log('- Prisma Studio: http://localhost:5556');
    } else {
        console.log('- PostgreSQL: localhost:5432');
        console.log('- ML Service: http://localhost:8080');
        console.log('- Prisma Studio: http://localhost:5555 (nur in dev-Profil)');
    }
    
    console.log('\n📝 Nützliche Befehle:');
    const prefix = environment === 'development' ? '-f docker-compose.dev.yml ' : '';
    console.log(`- Logs anzeigen: docker-compose ${prefix}logs -f`);
    console.log(`- Container stoppen: docker-compose ${prefix}down`);
    console.log(`- Container neustarten: docker-compose ${prefix}restart`);
}

async function main() {
    console.log('🚀 KAIROS Docker Setup');
    console.log('=======================');
    
    try {
        // Docker prüfen
        if (!checkDocker()) {
            process.exit(1);
        }
        
        // Umgebung einrichten
        if (!await setupEnvironment()) {
            process.exit(1);
        }
        
        // Umgebung auswählen
        const environment = await selectEnvironment();
        
        // Services bauen und starten
        if (!await buildAndStartServices(environment)) {
            console.error('❌ Setup fehlgeschlagen!');
            process.exit(1);
        }
        
        // Status anzeigen
        await showStatus(environment);
        
        console.log('\n🎉 Docker Setup abgeschlossen!');
        
    } catch (error) {
        console.error('❌ Unerwarteter Fehler:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Script ausführen
if (require.main === module) {
    main();
}
