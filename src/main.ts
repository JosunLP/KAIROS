#!/usr/bin/env node

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as readline from 'readline';
import { AppModule } from './app.module';
import { SimpleCliService } from './cli/simple-cli.service';
import { WebSocketService } from './common/websocket.service';
import { HealthService } from './health/health.service';

async function main() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const logger = new Logger('KAIROS');
    const healthService = app.get(HealthService);

    // Initial Health Check
    logger.log('🔍 Führe initialen Health Check durch...');
    const healthStatus = await healthService.performHealthCheck();
    if (healthStatus.status === 'unhealthy') {
      logger.error(
        '❌ System ist nicht gesund - kritische Komponenten fehlgeschlagen',
      );
      logger.error('Health Check Details:', healthStatus);
      process.exit(1);
    }
    logger.log('✅ System ist gesund und bereit');

    // CLI-Service abrufen
    const cliService = app.get(SimpleCliService);

    // WebSocket Service initialisieren (falls verfügbar)
    try {
      app.get(WebSocketService);
      logger.log('🔌 WebSocket Service initialisiert');
    } catch (error) {
      logger.warn(
        '⚠️ WebSocket Service nicht verfügbar - Real-time Features deaktiviert',
      );
    }

    // Prüfe ob Kommandozeilenargumente übergeben wurden (Legacy-Modus)
    if (process.argv.length > 2) {
      // Legacy: Ein-Befehl-Modus
      logger.log('🚀 KAIROS Stock Analysis CLI - Einzelbefehl-Modus');
      await cliService.processCommand(process.argv);
      await app.close();
      return;
    }

    // Persistente CLI starten
    logger.log('🚀 KAIROS Stock Analysis CLI gestartet (Persistenter Modus)');
    logger.log(
      "💡 Verwenden Sie 'help' für verfügbare Befehle oder 'exit' zum Beenden",
    );

    // Readline Interface für interaktive CLI
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'kairos> ',
    });

    // CLI-Service für persistenten Modus konfigurieren
    await cliService.startPersistentMode();

    // Initial prompt
    rl.prompt();

    // Kommando-Handler
    rl.on('line', async input => {
      const command = input.trim();

      if (command === 'exit' || command === 'quit') {
        console.log('👋 KAIROS wird beendet...');
        await cliService.stopPersistentMode();
        await app.close();
        rl.close();
        process.exit(0);
      } else if (command === '') {
        // Leere Eingabe - nur neuen Prompt anzeigen
        rl.prompt();
      } else if (command === 'health') {
        // Health Check über CLI
        try {
          const health = await healthService.performHealthCheck();
          console.log('🏥 System Health Status:');
          console.log(`Status: ${health.status}`);
          console.log(`Duration: ${health.duration}ms`);
          console.log('Component Status:');
          Object.entries(health.checks).forEach(([component, check]) => {
            if (check) {
              console.log(`  ${component}: ${check.status} - ${check.message}`);
            }
          });
        } catch (error) {
          console.error('❌ Health Check fehlgeschlagen:', error);
        }
        rl.prompt();
      } else if (command === 'status') {
        // System Status über CLI
        try {
          await cliService.processCommand(['node', 'kairos', 'status']);
        } catch (error) {
          console.error('❌ Status Check fehlgeschlagen:', error);
        }
        rl.prompt();
      } else {
        // Befehl verarbeiten
        const args = ['node', 'kairos', ...command.split(' ')];
        try {
          await cliService.processCommand(args);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unbekannter Fehler';
          console.error('❌ Fehler beim Ausführen des Befehls:', errorMessage);
        }
        rl.prompt();
      }
    });

    // Graceful shutdown bei Ctrl+C
    rl.on('SIGINT', async () => {
      console.log('\n👋 KAIROS wird beendet...');
      await cliService.stopPersistentMode();
      await app.close();
      process.exit(0);
    });

    // Graceful shutdown bei anderen Signalen
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM empfangen - Graceful Shutdown...');
      await cliService.stopPersistentMode();
      await app.close();
      process.exit(0);
    });

    process.on('uncaughtException', async error => {
      logger.error('Uncaught Exception:', error);
      await cliService.stopPersistentMode();
      await app.close();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      await cliService.stopPersistentMode();
      await app.close();
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Fehler beim Starten der Anwendung:', error);
    process.exit(1);
  }
}

main();
