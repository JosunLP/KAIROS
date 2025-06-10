#!/usr/bin/env node

/**
 * KAIROS Environment Setup Script
 * 
 * Dieses Script hilft beim Setup der Umgebungsvariablen für KAIROS
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔧 KAIROS Environment Setup');
  console.log('=' .repeat(50));
  console.log('');
  
  // Prüfe ob .env bereits existiert
  const envPath = path.join(__dirname, '../.env');
  const templatePath = path.join(__dirname, '../.env.template');
  
  if (fs.existsSync(envPath)) {
    console.log('✅ .env Datei existiert bereits.');
    const overwrite = await question('Möchten Sie eine neue .env erstellen? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup abgebrochen.');
      rl.close();
      return;
    }
  }
  
  if (!fs.existsSync(templatePath)) {
    console.log('❌ .env.template nicht gefunden!');
    rl.close();
    return;
  }
  
  console.log('');
  console.log('📋 API-Schlüssel Konfiguration');
  console.log('Mindestens einer der folgenden API-Schlüssel ist erforderlich:');
  console.log('');
  
  // API Keys sammeln
  const alphaVantageKey = await question('Alpha Vantage API Key (kostenlos): ');
  const polygonKey = await question('Polygon.io API Key (kostenpflichtig): ');
  const finnhubKey = await question('Finnhub API Key (kostenlos): ');
  
  if (!alphaVantageKey && !polygonKey && !finnhubKey) {
    console.log('❌ Mindestens ein API-Schlüssel ist erforderlich!');
    rl.close();
    return;
  }
  
  console.log('');
  console.log('⚙️  Cron Job Konfiguration');
  
  const environment = await question('Umgebung (development/production) [development]: ') || 'development';
  const enableCronMonitoring = await question('Cron Job Monitoring aktivieren? (Y/n): ');
  const cronNotifications = environment === 'production' ? 
    await question('Cron Job Benachrichtigungen aktivieren? (y/N): ') : 'n';
  
  // Template lesen
  let envContent = fs.readFileSync(templatePath, 'utf8');
  
  // API Keys ersetzen
  if (alphaVantageKey) {
    envContent = envContent.replace('YOUR_ALPHA_VANTAGE_KEY_HERE', alphaVantageKey);
  }
  if (polygonKey) {
    envContent = envContent.replace('YOUR_POLYGON_KEY_HERE', polygonKey);
  }
  if (finnhubKey) {
    envContent = envContent.replace('YOUR_FINNHUB_KEY_HERE', finnhubKey);
  }
  
  // Environment anpassen
  envContent = envContent.replace('NODE_ENV=development', `NODE_ENV=${environment}`);
  
  // Monitoring konfigurieren
  if (enableCronMonitoring.toLowerCase() !== 'n') {
    envContent = envContent.replace('ENABLE_CRON_MONITORING=true', 'ENABLE_CRON_MONITORING=true');
  } else {
    envContent = envContent.replace('ENABLE_CRON_MONITORING=true', 'ENABLE_CRON_MONITORING=false');
  }
  
  // Benachrichtigungen konfigurieren
  if (cronNotifications.toLowerCase() === 'y') {
    envContent = envContent.replace('ENABLE_CRON_NOTIFICATIONS=false', 'ENABLE_CRON_NOTIFICATIONS=true');
  }
  
  // Produktions-optimierte Cron Jobs für production
  if (environment === 'production') {
    envContent = envContent.replace(
      'DATA_INGESTION_CRON=*/15 * * * *',
      'DATA_INGESTION_CRON=*/30 9-17 * * 1-5'
    );
    envContent = envContent.replace(
      'ML_TRAINING_CRON=0 2 * * *',
      'ML_TRAINING_CRON=0 2 * * 1-5'
    );
    envContent = envContent.replace(
      'TECHNICAL_ANALYSIS_CRON=0 * * * *',
      'TECHNICAL_ANALYSIS_CRON=5 * * * *'
    );
    envContent = envContent.replace(
      'CRON_JOB_TIMEOUT=300000',
      'CRON_JOB_TIMEOUT=900000'
    );
  }
  
  // .env Datei schreiben
  fs.writeFileSync(envPath, envContent);
  
  console.log('');
  console.log('✅ .env Datei erfolgreich erstellt!');
  console.log('');
  console.log('📋 Nächste Schritte:');
  console.log('1. npm run build');
  console.log('2. npm run kairos -- --help');
  console.log('3. npm run kairos -- track AAPL');
  console.log('');
  console.log('🔍 Konfiguration überprüfen:');
  console.log('node scripts/cron-manager.js status');
  
  rl.close();
}

main().catch(console.error);
