import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Erfolgreich mit der Datenbank verbunden');
    } catch (error) {
      this.logger.error('Datenbankverbindung fehlgeschlagen', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Datenbankverbindung geschlossen');
    } catch (error) {
      this.logger.error('Fehler beim Schließen der Datenbankverbindung', error);
    }
  }

  /**
   * Bereinigt alte Daten basierend auf Aufbewahrungsrichtlinien
   */
  async cleanupOldData(retentionDays: number = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const deleted = await this.historicalData.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `${deleted.count} alte Datenpunkte gelöscht (älter als ${retentionDays} Tage)`,
      );
      return deleted.count;
    } catch (error) {
      this.logger.error('Fehler beim Bereinigen alter Daten', error);
      throw error;
    }
  }

  /**
   * Prüft die Datenbankintegrität
   */
  async checkIntegrity(): Promise<boolean> {
    try {
      // Prüfe auf duplikate historische Daten
      const duplicates = await this.$queryRaw`
        SELECT stockId, timestamp, COUNT(*) as count
        FROM historical_data
        GROUP BY stockId, timestamp
        HAVING COUNT(*) > 1
      `;

      if (Array.isArray(duplicates) && duplicates.length > 0) {
        this.logger.warn(
          `${duplicates.length} doppelte Einträge in historischen Daten gefunden`,
        );
        return false;
      }

      this.logger.log('Datenbankintegrität ist in Ordnung');
      return true;
    } catch (error) {
      this.logger.error('Fehler bei der Integritätsprüfung', error);
      return false;
    }
  }

  /**
   * Erweiterte Datenbank-Statistiken
   */
  async getDatabaseStatistics(): Promise<any> {
    try {
      const [
        stockCount,
        historicalDataCount,
        predictionCount,
        latestData,
        oldestData,
        duplicateCheck,
      ] = await Promise.all([
        this.stock.count({ where: { isActive: true } }),
        this.historicalData.count(),
        this.prediction.count(),
        this.historicalData.findFirst({ orderBy: { timestamp: 'desc' } }),
        this.historicalData.findFirst({ orderBy: { timestamp: 'asc' } }),
        this.$queryRaw`
          SELECT stockId, timestamp, COUNT(*) as count
          FROM historical_data
          GROUP BY stockId, timestamp
          HAVING COUNT(*) > 1
          LIMIT 10
        `,
      ]);

      return {
        stocks: {
          active: stockCount,
          total: await this.stock.count(),
        },
        historicalData: {
          total: historicalDataCount,
          withIndicators: await this.historicalData.count({
            where: {
              AND: [
                { sma20: { not: null } },
                { ema50: { not: null } },
                { rsi14: { not: null } },
                { macd: { not: null } },
              ],
            },
          }),
        },
        predictions: {
          total: predictionCount,
          validated: await this.prediction.count({
            where: { actualPrice: { not: null } },
          }),
        },
        dataRange: {
          newest: latestData?.timestamp,
          oldest: oldestData?.timestamp,
        },
        issues: {
          duplicates: Array.isArray(duplicateCheck) ? duplicateCheck.length : 0,
        },
      };
    } catch (error) {
      this.logger.error(
        'Fehler beim Abrufen der Datenbank-Statistiken:',
        error,
      );
      throw error;
    }
  }

  /**
   * Bereinigt doppelte Einträge in historischen Daten
   */
  async removeDuplicateHistoricalData(): Promise<number> {
    try {
      this.logger.log('Beginne Bereinigung doppelter historischer Daten...');

      // Finde alle Duplikate
      const duplicates = await this.$queryRaw<
        Array<{ stockId: string; timestamp: Date; count: number }>
      >`
        SELECT stockId, timestamp, COUNT(*) as count
        FROM historical_data
        GROUP BY stockId, timestamp
        HAVING COUNT(*) > 1
      `;

      let removedCount = 0;

      for (const duplicate of duplicates) {
        // Behalte nur den neuesten Eintrag pro stockId/timestamp
        const entries = await this.historicalData.findMany({
          where: {
            stockId: duplicate.stockId,
            timestamp: duplicate.timestamp,
          },
          orderBy: { id: 'desc' },
        });

        // Lösche alle außer dem ersten (neuesten)
        const toDelete = entries.slice(1);

        for (const entry of toDelete) {
          await this.historicalData.delete({ where: { id: entry.id } });
          removedCount++;
        }
      }

      this.logger.log(`${removedCount} doppelte Einträge entfernt`);
      return removedCount;
    } catch (error) {
      this.logger.error('Fehler beim Entfernen doppelter Daten:', error);
      throw error;
    }
  }

  /**
   * Optimiert die Datenbank-Performance
   */
  async optimizeDatabase(): Promise<void> {
    try {
      this.logger.log('Beginne Datenbank-Optimierung...');

      // SQLite VACUUM für bessere Performance
      await this.$executeRaw`VACUUM`;

      // Analysiere Tabellen für bessere Query-Performance
      await this.$executeRaw`ANALYZE`;

      this.logger.log('Datenbank-Optimierung abgeschlossen');
    } catch (error) {
      this.logger.error('Fehler bei der Datenbank-Optimierung:', error);
      throw error;
    }
  }

  /**
   * Sichert die Datenbank
   */
  async backupDatabase(backupPath?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultBackupPath = `./backups/kairos-backup-${timestamp}.db`;
      const finalBackupPath = backupPath || defaultBackupPath;

      // Erstelle Backup-Verzeichnis falls nicht vorhanden
      const fs = await import('fs');
      const path = await import('path');
      const backupDir = path.dirname(finalBackupPath);

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // SQLite Backup
      await this.$executeRaw`VACUUM INTO ${finalBackupPath}`;

      this.logger.log(`Datenbank-Backup erstellt: ${finalBackupPath}`);
      return finalBackupPath;
    } catch (error) {
      this.logger.error('Fehler beim Erstellen des Datenbank-Backups:', error);
      throw error;
    }
  }

  /**
   * Überwacht die Datenbank-Größe und Performance
   */
  async getDatabaseHealth(): Promise<any> {
    try {
      const [size, connectionInfo, indexUsage] = await Promise.all([
        this
          .$queryRaw`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`,
        this.$queryRaw`PRAGMA database_list`,
        this.$queryRaw`PRAGMA index_list('historical_data')`,
      ]);

      return {
        size: Array.isArray(size) && size.length > 0 ? size[0] : null,
        connections: connectionInfo,
        indexes: indexUsage,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        'Fehler beim Überprüfen der Datenbank-Gesundheit:',
        error,
      );
      return {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }
}
