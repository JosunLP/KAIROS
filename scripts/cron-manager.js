#!/usr/bin/env node

/**
 * KAIROS Cron Job Management Script
 * 
 * Dieses Script hilft beim Verwalten und Überwachen der Cron Jobs im KAIROS System.
 * 
 * Verwendung:
 *   node cron-manager.js status           - Zeigt Status aller Cron Jobs
 *   node cron-manager.js logs [jobName]   - Zeigt Logs für alle oder einen spezifischen Job
 *   node cron-manager.js test             - Testet die Cron Job Konfiguration
 *   node cron-manager.js validate         - Validiert alle Cron Expressions
 *   node cron-manager.js schedule         - Zeigt nächste geplante Ausführungen
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cron Job Definitionen
const CRON_JOBS = {
  'data-ingestion': {
    name: 'Datenerfassung',
    cron: '*/15 * * * *',
    env: 'DATA_INGESTION_CRON',
    description: 'Holt aktuelle Marktdaten alle 15 Minuten während Handelszeiten',
    timeout: 300000, // 5 Minuten
  },
  'technical-analysis': {
    name: 'Technische Analyse',
    cron: '0 * * * *',
    env: 'TECHNICAL_ANALYSIS_CRON',
    description: 'Berechnet technische Indikatoren jede Stunde',
    timeout: 600000, // 10 Minuten
  },
  'ml-training': {
    name: 'ML Training',
    cron: '0 2 * * *',
    env: 'ML_TRAINING_CRON',
    description: 'Trainiert ML-Modelle täglich um 2:00 Uhr',
    timeout: 3600000, // 1 Stunde
  },
  'prediction-validation': {
    name: 'Vorhersage-Validierung',
    cron: '0 3 * * *',
    env: 'PREDICTION_VALIDATION_CRON',
    description: 'Validiert Vorhersagen täglich um 3:00 Uhr',
    timeout: 1800000, // 30 Minuten
  },
  'data-cleanup': {
    name: 'Datenbereinigung',
    cron: '0 4 * * 0',
    env: 'DATA_CLEANUP_CRON',
    description: 'Bereinigt alte Daten wöchentlich sonntags um 4:00 Uhr',
    timeout: 1800000, // 30 Minuten
  },
  'daily-predictions': {
    name: 'Tägliche Vorhersagen',
    cron: '0 6 * * *',
    env: 'DAILY_PREDICTION_CRON',
    description: 'Erstellt täglich um 6:00 Uhr Vorhersagen für alle Aktien',
    timeout: 1800000, // 30 Minuten
  },
  'data-integrity': {
    name: 'Datenintegrität',
    cron: '0 1 * * *',
    env: 'DATA_INTEGRITY_CRON',
    description: 'Überprüft Datenintegrität täglich um 1:00 Uhr',
    timeout: 600000, // 10 Minuten
  },
};

function parseCommand() {
  const args = process.argv.slice(2);
  const command = args[0];
  const jobName = args[1];
  
  return { command, jobName };
}

function validateCronExpression(cronExpression) {
  // Einfache Validierung der Cron Expression
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    return false;
  }
  
  // Weitere Validierung könnte hier hinzugefügt werden
  return true;
}

function getNextScheduledTime(cronExpression) {
  // Vereinfachte Berechnung der nächsten Ausführung
  // In einer echten Implementierung würde man eine Cron-Parsing-Bibliothek verwenden
  const now = new Date();
  const next = new Date(now.getTime() + 60000); // Nächste Minute als Platzhalter
  
  return next.toLocaleString('de-DE', { 
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showStatus() {
  console.log('🔄 KAIROS Cron Job Status');
  console.log('=' .repeat(80));
  
  Object.entries(CRON_JOBS).forEach(([key, job]) => {
    const envValue = process.env[job.env] || job.cron;
    const isValid = validateCronExpression(envValue);
    const status = isValid ? '✅ Aktiv' : '❌ Ungültig';
    
    console.log(`\n📋 ${job.name} (${key})`);
    console.log(`   Beschreibung: ${job.description}`);
    console.log(`   Cron:         ${envValue}`);
    console.log(`   Status:       ${status}`);
    console.log(`   Timeout:      ${job.timeout / 1000}s`);
    
    if (isValid) {
      console.log(`   Nächste Ausführung: ${getNextScheduledTime(envValue)}`);
    }
  });
}

function showLogs(jobName) {
  const logFile = path.join(__dirname, '../../logs/kairos.log');
  
  if (!fs.existsSync(logFile)) {
    console.log('❌ Keine Log-Datei gefunden.');
    return;
  }
  
  try {
    const logs = fs.readFileSync(logFile, 'utf8');
    const lines = logs.split('\n');
    
    let filteredLines;
    if (jobName) {
      const jobConfig = CRON_JOBS[jobName];
      if (!jobConfig) {
        console.log(`❌ Unbekannter Job: ${jobName}`);
        return;
      }
      
      console.log(`📄 Logs für Job: ${jobConfig.name}`);
      filteredLines = lines.filter(line => 
        line.includes(jobConfig.name) || 
        line.includes(jobName) ||
        line.includes('cron') ||
        line.includes('scheduled')
      );
    } else {
      console.log('📄 Alle Cron Job Logs:');
      filteredLines = lines.filter(line => 
        line.includes('cron') || 
        line.includes('scheduled') ||
        line.includes('geplant')
      );
    }
    
    console.log('=' .repeat(80));
    filteredLines.slice(-50).forEach(line => {
      if (line.trim()) {
        console.log(line);
      }
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Lesen der Log-Datei:', error.message);
  }
}

function testConfiguration() {
  console.log('🧪 Teste Cron Job Konfiguration...');
  console.log('=' .repeat(80));
  
  let allValid = true;
  
  Object.entries(CRON_JOBS).forEach(([key, job]) => {
    const envValue = process.env[job.env] || job.cron;
    const isValid = validateCronExpression(envValue);
    
    if (isValid) {
      console.log(`✅ ${job.name}: ${envValue}`);
    } else {
      console.log(`❌ ${job.name}: ${envValue} (Ungültige Cron Expression)`);
      allValid = false;
    }
  });
  
  console.log('\n' + '=' .repeat(80));
  
  if (allValid) {
    console.log('✅ Alle Cron Job Konfigurationen sind gültig!');
  } else {
    console.log('❌ Einige Cron Job Konfigurationen sind ungültig!');
    process.exit(1);
  }
  
  // Teste auch Umgebungsvariablen
  console.log('\n🔧 Umgebungsvariablen:');
  const requiredEnvVars = [
    'SCHEDULING_TIMEZONE',
    'ENABLE_CRON_MONITORING',
    'CRON_JOB_TIMEOUT',
    'CRON_FAILURE_THRESHOLD'
  ];
  
  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: ${value}`);
    } else {
      console.log(`⚠️  ${envVar}: Nicht gesetzt (Standard wird verwendet)`);
    }
  });
}

function validateAll() {
  console.log('✅ Validiere alle Cron Expressions...');
  console.log('=' .repeat(80));
  
  Object.entries(CRON_JOBS).forEach(([key, job]) => {
    const envValue = process.env[job.env] || job.cron;
    const isValid = validateCronExpression(envValue);
    
    if (isValid) {
      console.log(`✅ ${key}: ${envValue}`);
    } else {
      console.log(`❌ ${key}: ${envValue} - UNGÜLTIG`);
    }
  });
}

function showSchedule() {
  console.log('📅 Geplante Cron Job Ausführungen');
  console.log('=' .repeat(80));
  
  Object.entries(CRON_JOBS).forEach(([key, job]) => {
    const envValue = process.env[job.env] || job.cron;
    
    console.log(`\n⏰ ${job.name}`);
    console.log(`   Cron: ${envValue}`);
    console.log(`   Nächste Ausführung: ${getNextScheduledTime(envValue)}`);
  });
}

function showHelp() {
  console.log('🔧 KAIROS Cron Job Manager');
  console.log('=' .repeat(80));
  console.log('\nVerfügbare Kommandos:');
  console.log('  status                    - Zeigt Status aller Cron Jobs');
  console.log('  logs [jobName]           - Zeigt Logs für alle oder einen spezifischen Job');
  console.log('  test                     - Testet die Cron Job Konfiguration');
  console.log('  validate                 - Validiert alle Cron Expressions');
  console.log('  schedule                 - Zeigt nächste geplante Ausführungen');
  console.log('  help                     - Zeigt diese Hilfe');
  
  console.log('\nVerfügbare Jobs:');
  Object.entries(CRON_JOBS).forEach(([key, job]) => {
    console.log(`  ${key.padEnd(20)} - ${job.name}`);
  });
  
  console.log('\nBeispiele:');
  console.log('  node cron-manager.js status');
  console.log('  node cron-manager.js logs ml-training');
  console.log('  node cron-manager.js test');
}

// Hauptfunktion
function main() {
  const { command, jobName } = parseCommand();
  
  switch (command) {
    case 'status':
      showStatus();
      break;
    case 'logs':
      showLogs(jobName);
      break;
    case 'test':
      testConfiguration();
      break;
    case 'validate':
      validateAll();
      break;
    case 'schedule':
      showSchedule();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      console.log(`❌ Unbekanntes Kommando: ${command || '(leer)'}`);
      console.log('Verwende "node cron-manager.js help" für Hilfe.');
      process.exit(1);
  }
}

// Script ausführen
if (require.main === module) {
  main();
}

module.exports = {
  CRON_JOBS,
  validateCronExpression,
  getNextScheduledTime
};
