import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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

      this.logger.log(`${deleted.count} alte Datenpunkte gelöscht (älter als ${retentionDays} Tage)`);
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
        this.logger.warn(`${duplicates.length} doppelte Einträge in historischen Daten gefunden`);
        return false;
      }

      this.logger.log('Datenbankintegrität ist in Ordnung');
      return true;
    } catch (error) {
      this.logger.error('Fehler bei der Integritätsprüfung', error);
      return false;
    }
  }
}
