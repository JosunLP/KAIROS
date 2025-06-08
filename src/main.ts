#!/usr/bin/env node

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";
import { SimpleCliService } from "./cli/simple-cli.service";

async function main() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ["error", "warn", "log", "debug", "verbose"],
    });

    const logger = new Logger("KAIROS");
    logger.log("🚀 KAIROS Stock Analysis CLI gestartet");

    // CLI-Service abrufen und Befehle verarbeiten
    const cliService = app.get(SimpleCliService);

    // Kommandozeilenargumente verarbeiten
    if (process.argv.length <= 2) {
      // Keine Argumente - zeige Hilfe
      process.argv.push("help");
    }

    await cliService.processCommand(process.argv);

    await app.close();
  } catch (error) {
    console.error("❌ Fehler beim Starten der Anwendung:", error);
    process.exit(1);
  }
}

main();
