#!/usr/bin/env node

/**
 * KAIROS Environment Validation Script
 * 
 * Überprüft ob alle erforderlichen Umgebungsvariablen korrekt gesetzt sind
 */

const fs = require('fs');
const path = require('path');

// Erforderliche Umgebungsvariablen
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'DATABASE_URL',
  'SCHEDULING_TIMEZONE'
];

// Mindestens einer dieser API-Schlüssel muss gesetzt sein
const API_KEYS = [
  'ALPHA_VANTAGE_API_KEY',
  'POLYGON_API_KEY',
  'FINNHUB_API_KEY'
];

// Cron Job Konfiguration
const CRON_VARS = [
  'DATA_INGESTION_CRON',
  'TECHNICAL_ANALYSIS_CRON',
  'ML_TRAINING_CRON',
  'PREDICTION_VALIDATION_CRON',
  'DATA_CLEANUP_CRON',
  'DAILY_PREDICTION_CRON',
  'DATA_INTEGRITY_CRON'
];

function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env Datei nicht gefunden!');
    console.log('Führen Sie zuerst aus: npm run setup-env');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    }
  });
  
  return envVars;
}

function validateCronExpression(cronExpression) {
  if (!cronExpression) return false;
  
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return false;
  
  // Einfache Validierung - in echt würde man eine Cron-Library verwenden
  return parts.every(part => 
    part === '*' || 
    /^\d+$/.test(part) || 
    /^\*\/\d+$/.test(part) || 
    /^\d+-\d+$/.test(part) ||
    /^\d+(,\d+)*$/.test(part)
  );
}

function validateEnvironment() {
  console.log('🔍 KAIROS Environment Validation');
  console.log('=' .repeat(50));
  console.log('');
  
  const envVars = loadEnvFile();
  let isValid = true;
  let warnings = [];
  
  // Überprüfe erforderliche Variablen
  console.log('📋 Erforderliche Variablen:');
  REQUIRED_ENV_VARS.forEach(varName => {
    const value = envVars[varName];
    if (value && value !== 'YOUR_VALUE_HERE') {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`❌ ${varName}: Nicht gesetzt oder Platzhalter`);
      isValid = false;
    }
  });
  
  // Überprüfe API-Schlüssel
  console.log('\n🔑 API-Schlüssel:');
  let hasApiKey = false;
  API_KEYS.forEach(varName => {
    const value = envVars[varName];
    if (value && value !== 'YOUR_' + varName.replace('_API_KEY', '_KEY_HERE')) {
      console.log(`✅ ${varName}: ${'*'.repeat(8)}${value.slice(-4)}`);
      hasApiKey = true;
    } else {
      console.log(`⚠️  ${varName}: Nicht gesetzt`);
    }
  });
  
  if (!hasApiKey) {
    console.log('❌ Mindestens ein API-Schlüssel ist erforderlich!');
    isValid = false;
  }
  
  // Überprüfe Cron Job Konfiguration
  console.log('\n⏰ Cron Job Konfiguration:');
  CRON_VARS.forEach(varName => {
    const value = envVars[varName];
    if (value) {
      const isValidCron = validateCronExpression(value);
      if (isValidCron) {
        console.log(`✅ ${varName}: ${value}`);
      } else {
        console.log(`❌ ${varName}: Ungültige Cron Expression: ${value}`);
        isValid = false;
      }
    } else {
      console.log(`⚠️  ${varName}: Nicht gesetzt (Standard wird verwendet)`);
      warnings.push(`${varName} nicht konfiguriert`);
    }
  });
  
  // Überprüfe Monitoring-Konfiguration
  console.log('\n📊 Monitoring Konfiguration:');
  const monitoringVars = [
    'ENABLE_CRON_MONITORING',
    'CRON_JOB_TIMEOUT',
    'ENABLE_CRON_NOTIFICATIONS',
    'CRON_FAILURE_THRESHOLD'
  ];
  
  monitoringVars.forEach(varName => {
    const value = envVars[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚠️  ${varName}: Nicht gesetzt (Standard wird verwendet)`);
      warnings.push(`${varName} nicht konfiguriert`);
    }
  });
  
  // Überprüfe Docker-spezifische Konfiguration
  if (envVars.NODE_ENV === 'production') {
    console.log('\n🐳 Produktions-Konfiguration:');
    
    // Überprüfe ob produktions-optimierte Cron Jobs gesetzt sind
    const dataIngestionCron = envVars.DATA_INGESTION_CRON;
    if (dataIngestionCron && dataIngestionCron.includes('9-17') && dataIngestionCron.includes('1-5')) {
      console.log('✅ Produktions-optimierte Datenerfassung (Handelszeiten)');
    } else {
      console.log('⚠️  Datenerfassung läuft möglicherweise zu häufig für Produktion');
      warnings.push('Überprüfen Sie DATA_INGESTION_CRON für Produktionsumgebung');
    }
    
    const cronTimeout = parseInt(envVars.CRON_JOB_TIMEOUT);
    if (cronTimeout && cronTimeout >= 900000) {
      console.log('✅ Produktions-Timeout konfiguriert (≥15 Minuten)');
    } else {
      console.log('⚠️  Cron Job Timeout möglicherweise zu niedrig für Produktion');
      warnings.push('Erhöhen Sie CRON_JOB_TIMEOUT für Produktionsumgebung');
    }
  }
  
  // Zusammenfassung
  console.log('\n' + '=' .repeat(50));
  
  if (isValid) {
    console.log('✅ Environment-Konfiguration ist gültig!');
  } else {
    console.log('❌ Environment-Konfiguration hat Fehler!');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnungen:');
    warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  console.log('\n📋 Nächste Schritte:');
  console.log('1. npm run build');
  console.log('2. npm run cron-test');
  console.log('3. npm run start');
  
  console.log('\n🔍 Weitere Validierung:');
  console.log('npm run cron-status');
}

validateEnvironment();
