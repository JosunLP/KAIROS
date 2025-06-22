#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { SimpleCliService } from './cli/simple-cli.service';
import * as readline from 'readline';

async function main() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const logger = new Logger('KAIROS');

    // CLI-Service abrufen
    const cliService = app.get(SimpleCliService);

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
  } catch (error) {
    console.error('❌ Fehler beim Starten der Anwendung:', error);
    process.exit(1);
  }
}

main();
