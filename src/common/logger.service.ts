import { Injectable } from "@nestjs/common";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface LogEntry {
  timestamp: Date;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";
  component: string;
  message: string;
  metadata?: any;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface LogFilter {
  level?: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";
  component?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

@Injectable()
export class LoggerService {
  private readonly logDirectory = join(process.cwd(), "logs");
  private readonly maxLogFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxLogFiles = 10;
  private readonly logBuffer: LogEntry[] = [];
  private readonly bufferFlushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.ensureLogDirectory();
    this.startBufferFlush();
  }

  /**
   * Debug-Level Log
   */
  debug(message: string, component: string = "SYSTEM", metadata?: any): void {
    this.log("DEBUG", component, message, metadata);
  }

  /**
   * Info-Level Log
   */
  info(message: string, component: string = "SYSTEM", metadata?: any): void {
    this.log("INFO", component, message, metadata);
  }

  /**
   * Warning-Level Log
   */
  warn(message: string, component: string = "SYSTEM", metadata?: any): void {
    this.log("WARN", component, message, metadata);
  }

  /**
   * Error-Level Log
   */
  error(message: string, component: string = "SYSTEM", metadata?: any): void {
    this.log("ERROR", component, message, metadata);
  }

  /**
   * Critical-Level Log
   */
  critical(
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
  ): void {
    this.log("CRITICAL", component, message, metadata);
  }

  /**
   * Performance-Logging für Operationen
   */
  logPerformance(
    operation: string,
    duration: number,
    component: string = "PERFORMANCE",
  ): void {
    this.info(`Operation ${operation} completed in ${duration}ms`, component, {
      operation,
      duration,
      performanceMetric: true,
    });
  }

  /**
   * API Request Logging
   */
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    component: string = "API",
  ): void {
    const level = statusCode >= 400 ? "ERROR" : "INFO";
    this.log(
      level,
      component,
      `${method} ${url} - ${statusCode} (${duration}ms)`,
      {
        method,
        url,
        statusCode,
        duration,
        apiRequest: true,
      },
    );
  }

  /**
   * Trading Operation Logging
   */
  logTradingOperation(
    operation: string,
    ticker: string,
    amount: number,
    price?: number,
    component: string = "TRADING",
  ): void {
    this.info(
      `Trading operation: ${operation} ${amount} of ${ticker}`,
      component,
      {
        operation,
        ticker,
        amount,
        price,
        tradingOperation: true,
      },
    );
  }

  /**
   * ML Training Logging
   */
  logMLTraining(
    model: string,
    epoch: number,
    loss: number,
    accuracy: number,
    component: string = "ML",
  ): void {
    this.info(`ML Training: ${model} - Epoch ${epoch}`, component, {
      model,
      epoch,
      loss,
      accuracy,
      mlTraining: true,
    });
  }

  /**
   * Generisches Logging
   */
  private log(
    level: LogEntry["level"],
    component: string,
    message: string,
    metadata?: any,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      metadata,
    };

    // Console Output
    this.logToConsole(entry);

    // Buffer für File Output
    this.logBuffer.push(entry);

    // Bei kritischen Fehlern sofort flushen
    if (level === "CRITICAL" || level === "ERROR") {
      this.flushBuffer();
    }
  }

  /**
   * Console Output mit Farben
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(8);
    const component = entry.component.padEnd(12);

    let colorCode = "";
    switch (entry.level) {
      case "DEBUG":
        colorCode = "\x1b[36m";
        break; // Cyan
      case "INFO":
        colorCode = "\x1b[32m";
        break; // Green
      case "WARN":
        colorCode = "\x1b[33m";
        break; // Yellow
      case "ERROR":
        colorCode = "\x1b[31m";
        break; // Red
      case "CRITICAL":
        colorCode = "\x1b[35m";
        break; // Magenta
    }
    const resetColor = "\x1b[0m";

    console.log(
      `${colorCode}[${timestamp}] ${level} [${component}] ${entry.message}${resetColor}`,
    );

    if (entry.metadata) {
      console.log(
        `${colorCode}    Metadata:${resetColor}`,
        JSON.stringify(entry.metadata, null, 2),
      );
    }
  }

  /**
   * Buffer in Datei schreiben
   */
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    const logFile = this.getCurrentLogFile();
    const entries = this.logBuffer.splice(0);

    try {
      const logLines =
        entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
      writeFileSync(logFile, logLines, { flag: "a" });

      // Prüfe Dateigröße und rotiere wenn nötig
      this.rotateLogFileIfNeeded(logFile);
    } catch (error) {
      console.error("Failed to write log file:", error);
    }
  }

  /**
   * Startet periodisches Buffer-Flushing
   */
  private startBufferFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  /**
   * Stoppt Buffer-Flushing
   */
  stopBufferFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flushBuffer(); // Final flush
  }

  /**
   * Aktuellen Log-Dateinamen ermitteln
   */
  private getCurrentLogFile(): string {
    const today = new Date().toISOString().split("T")[0];
    return join(this.logDirectory, `kairos-${today}.log`);
  }

  /**
   * Log-Datei rotieren wenn zu groß
   */
  private rotateLogFileIfNeeded(logFile: string): void {
    try {
      const stats = require("fs").statSync(logFile);
      if (stats.size > this.maxLogFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const rotatedFile = logFile.replace(".log", `-${timestamp}.log`);
        require("fs").renameSync(logFile, rotatedFile);

        // Alte Log-Dateien löschen
        this.cleanupOldLogFiles();
      }
    } catch (error) {
      console.error("Log rotation failed:", error);
    }
  }

  /**
   * Alte Log-Dateien aufräumen
   */
  private cleanupOldLogFiles(): void {
    try {
      const fs = require("fs");
      const files = fs
        .readdirSync(this.logDirectory)
        .filter(
          (file: string) => file.startsWith("kairos-") && file.endsWith(".log"),
        )
        .map((file: string) => ({
          name: file,
          path: join(this.logDirectory, file),
          time: fs.statSync(join(this.logDirectory, file)).mtime,
        }))
        .sort((a: any, b: any) => b.time - a.time);

      // Lösche überschüssige Dateien
      if (files.length > this.maxLogFiles) {
        files.slice(this.maxLogFiles).forEach((file: any) => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error("Log cleanup failed:", error);
    }
  }

  /**
   * Log-Verzeichnis erstellen
   */
  private ensureLogDirectory(): void {
    if (!existsSync(this.logDirectory)) {
      mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  /**
   * Logs lesen und filtern
   */
  async getLogs(filter?: LogFilter, limit: number = 1000): Promise<LogEntry[]> {
    try {
      const logFile = this.getCurrentLogFile();
      if (!existsSync(logFile)) {
        return [];
      }

      const content = readFileSync(logFile, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let logs: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entry.timestamp = new Date(entry.timestamp);
          logs.push(entry);
        } catch (error) {
          // Ignore malformed log lines
        }
      }

      // Filter anwenden
      if (filter) {
        logs = logs.filter((entry) => {
          if (filter.level && entry.level !== filter.level) return false;
          if (filter.component && entry.component !== filter.component)
            return false;
          if (filter.startDate && entry.timestamp < filter.startDate)
            return false;
          if (filter.endDate && entry.timestamp > filter.endDate) return false;
          if (
            filter.search &&
            !entry.message.toLowerCase().includes(filter.search.toLowerCase())
          )
            return false;
          return true;
        });
      }

      // Neueste zuerst, limitieren
      return logs.reverse().slice(0, limit);
    } catch (error) {
      console.error("Failed to read logs:", error);
      return [];
    }
  }

  /**
   * System-Statistiken aus Logs generieren
   */
  async getLogStatistics(hours: number = 24): Promise<{
    totalLogs: number;
    byLevel: Record<string, number>;
    byComponent: Record<string, number>;
    errorRate: number;
    avgLogsPerHour: number;
  }> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const logs = await this.getLogs({ startDate });

    const byLevel: Record<string, number> = {};
    const byComponent: Record<string, number> = {};

    logs.forEach((log) => {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      byComponent[log.component] = (byComponent[log.component] || 0) + 1;
    });

    const errorLogs = logs.filter(
      (log) => log.level === "ERROR" || log.level === "CRITICAL",
    ).length;
    const errorRate = logs.length > 0 ? (errorLogs / logs.length) * 100 : 0;

    return {
      totalLogs: logs.length,
      byLevel,
      byComponent,
      errorRate,
      avgLogsPerHour: logs.length / hours,
    };
  }

  /**
   * Performance-Metriken aus Logs extrahieren
   */
  async getPerformanceMetrics(hours: number = 24): Promise<{
    apiRequests: { total: number; avgDuration: number; errorRate: number };
    tradingOps: { total: number; volume: number };
    mlTraining: { sessions: number; avgAccuracy: number };
  }> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const logs = await this.getLogs({ startDate });

    const apiLogs = logs.filter((log) => log.metadata?.apiRequest);
    const tradingLogs = logs.filter((log) => log.metadata?.tradingOperation);
    const mlLogs = logs.filter((log) => log.metadata?.mlTraining);

    const apiRequests = {
      total: apiLogs.length,
      avgDuration:
        apiLogs.length > 0
          ? apiLogs.reduce(
              (sum, log) => sum + (log.metadata?.duration || 0),
              0,
            ) / apiLogs.length
          : 0,
      errorRate:
        apiLogs.length > 0
          ? (apiLogs.filter((log) => log.level === "ERROR").length /
              apiLogs.length) *
            100
          : 0,
    };

    const tradingOps = {
      total: tradingLogs.length,
      volume: tradingLogs.reduce(
        (sum, log) => sum + (log.metadata?.amount || 0),
        0,
      ),
    };

    const mlTraining = {
      sessions: mlLogs.length,
      avgAccuracy:
        mlLogs.length > 0
          ? mlLogs.reduce(
              (sum, log) => sum + (log.metadata?.accuracy || 0),
              0,
            ) / mlLogs.length
          : 0,
    };

    return {
      apiRequests,
      tradingOps,
      mlTraining,
    };
  }
}
