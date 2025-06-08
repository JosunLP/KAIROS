#!/usr/bin/env node

/**
 * KAIROS Setup Script
 * Automatisiert die Einrichtung der Anwendung
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';

console.log('🚀 KAIROS Setup wird gestartet...\n');

// 1. Umgebungsvariablen kopieren
if (!existsSync('.env')) {
  if (existsSync('.env.example')) {
    copyFileSync('.env.example', '.env');
    console.log('✅ .env Datei aus .env.example erstellt');
  } else {
    console.log('⚠️  .env.example nicht gefunden - erstelle manuelle .env Datei');
  }
} else {
  console.log('ℹ️  .env Datei bereits vorhanden');
}

// 2. Dependencies installieren
try {
  console.log('\n📦 Installiere Dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installiert');
} catch (error) {
  console.error('❌ Fehler beim Installieren der Dependencies:', error.message);
  process.exit(1);
}

// 3. Prisma Setup
try {
  console.log('\n🗄️  Initialisiere Datenbank...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('✅ Datenbank initialisiert');
  
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma Client generiert');
} catch (error) {
  console.error('❌ Fehler beim Datenbank-Setup:', error.message);
  process.exit(1);
}

// 4. Build
try {
  console.log('\n🔨 Baue Anwendung...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Anwendung gebaut');
} catch (error) {
  console.error('❌ Fehler beim Build:', error.message);
  process.exit(1);
}

console.log('\n🎉 KAIROS Setup erfolgreich abgeschlossen!');
console.log('\n📋 Nächste Schritte:');
console.log('1. Editiere .env und füge deine API-Schlüssel hinzu');
console.log('2. Starte die CLI mit: node dist/main <command>');
console.log('\n📖 Verfügbare Befehle:');
console.log('   node dist/main status     - Status anzeigen');
console.log('   node dist/main track AAPL - Aktie verfolgen');
console.log('   node dist/main list       - Aktien auflisten');
console.log('   node dist/main predict AAPL - Prognose erstellen');
console.log('   node dist/main train      - ML-Modell trainieren');
