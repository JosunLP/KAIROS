import { Injectable } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "./logger.service";

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: Date;
  ttl: number; // Time to live in seconds
  accessCount: number;
  lastAccessed: Date;
  metadata?: any;
}

export interface CacheStatistics {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number; // in bytes (estimated)
  oldestEntry?: Date;
  newestEntry?: Date;
  topKeys: { key: string; accessCount: number }[];
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  metadata?: any;
  skipIfExists?: boolean;
  tags?: string[];
}

@Injectable()
export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    if (this.config.cacheEnabled) {
      this.startCleanupTimer();
      this.logger.info("Cache service initialized", "CACHE");
    }
  }

  /**
   * Wert aus Cache abrufen
   */
  get<T = any>(key: string): T | null {
    if (!this.config.cacheEnabled) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.logger.debug(`Cache miss: ${key}`, "CACHE");
      return null;
    }

    // TTL prüfen
    const now = new Date();
    const ageInSeconds = (now.getTime() - entry.timestamp.getTime()) / 1000;

    if (ageInSeconds > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.logger.debug(`Cache expired: ${key}`, "CACHE");
      return null;
    }

    // Access-Statistiken aktualisieren
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;

    this.logger.debug(`Cache hit: ${key}`, "CACHE");
    return entry.value;
  }

  /**
   * Wert in Cache speichern
   */
  set<T = any>(key: string, value: T, options?: CacheOptions): boolean {
    if (!this.config.cacheEnabled) {
      return false;
    }

    // Prüfen ob Key bereits existiert und skipIfExists gesetzt ist
    if (options?.skipIfExists && this.cache.has(key)) {
      return false;
    }

    // Cache-Größe prüfen
    if (this.cache.size >= this.config.cacheMaxSize) {
      this.evictLeastRecentlyUsed();
    }

    const ttl = options?.ttl ?? this.config.cacheTtl;
    const now = new Date();

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now,
      metadata: options?.metadata,
    };

    this.cache.set(key, entry);
    this.stats.sets++;

    this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`, "CACHE");
    return true;
  }

  /**
   * Mehrere Werte gleichzeitig abrufen
   */
  getMultiple<T = any>(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();

    for (const key of keys) {
      const value = this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * Mehrere Werte gleichzeitig speichern
   */
  setMultiple<T = any>(
    entries: Map<string, T>,
    options?: CacheOptions,
  ): number {
    let successCount = 0;

    for (const [key, value] of entries) {
      if (this.set(key, value, options)) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * Wert löschen
   */
  delete(key: string): boolean {
    const success = this.cache.delete(key);
    if (success) {
      this.stats.deletes++;
      this.logger.debug(`Cache delete: ${key}`, "CACHE");
    }
    return success;
  }

  /**
   * Mehrere Werte löschen
   */
  deleteMultiple(keys: string[]): number {
    let deletedCount = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Alle Werte mit Präfix löschen
   */
  deleteByPrefix(prefix: string): number {
    const keysToDelete = Array.from(this.cache.keys()).filter((key) =>
      key.startsWith(prefix),
    );
    return this.deleteMultiple(keysToDelete);
  }

  /**
   * Cache komplett leeren
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cache cleared: ${size} entries removed`, "CACHE");
  }

  /**
   * Prüfen ob Key existiert
   */
  has(key: string): boolean {
    if (!this.config.cacheEnabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // TTL prüfen
    const ageInSeconds = (Date.now() - entry.timestamp.getTime()) / 1000;
    if (ageInSeconds > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Alle Cache-Keys abrufen
   */
  keys(prefix?: string): string[] {
    const allKeys = Array.from(this.cache.keys());
    return prefix ? allKeys.filter((key) => key.startsWith(prefix)) : allKeys;
  }

  /**
   * Cache-Größe abrufen
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cache-Statistiken abrufen
   */
  getStatistics(): CacheStatistics {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.stats.hits + this.stats.misses;

    const hitRate =
      totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate =
      totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

    // Memory usage schätzen (sehr grob)
    const estimatedMemory = entries.reduce((total, entry) => {
      return total + JSON.stringify(entry.value).length * 2; // Rough estimate
    }, 0);

    // Top Keys nach Access Count
    const topKeys = entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map((entry) => ({ key: entry.key, accessCount: entry.accessCount }));

    const timestamps = entries.map((e) => e.timestamp);
    const oldestEntry =
      timestamps.length > 0
        ? new Date(Math.min(...timestamps.map((d) => d.getTime())))
        : undefined;
    const newestEntry =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((d) => d.getTime())))
        : undefined;

    return {
      totalEntries: this.cache.size,
      hitRate,
      missRate,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      memoryUsage: estimatedMemory,
      oldestEntry,
      newestEntry,
      topKeys,
    };
  }

  /**
   * Cache-Statistiken zurücksetzen
   */
  resetStatistics(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    this.logger.info("Cache statistics reset", "CACHE");
  }

  /**
   * Wrapper für Funktionen mit automatischem Caching
   */
  async memoize<T>(
    key: string,
    fn: () => Promise<T> | T,
    options?: CacheOptions,
  ): Promise<T> {
    // Erst Cache prüfen
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Funktion ausführen
    const result = await fn();

    // Ergebnis cachen
    this.set(key, result, options);

    return result;
  }

  /**
   * Ticker-spezifisches Caching für Marktdaten
   */
  cacheTickerData(
    ticker: string,
    data: any,
    dataType: string = "quotes",
  ): void {
    const key = `ticker:${ticker}:${dataType}`;
    this.set(key, data, {
      ttl: 300, // 5 Minuten für Marktdaten
      metadata: { ticker, dataType, cached: new Date() },
    });
  }

  /**
   * Ticker-Daten aus Cache abrufen
   */
  getTickerData<T = any>(
    ticker: string,
    dataType: string = "quotes",
  ): T | null {
    const key = `ticker:${ticker}:${dataType}`;
    return this.get<T>(key);
  }

  /**
   * ML-Vorhersagen cachen
   */
  cachePrediction(ticker: string, prediction: any): void {
    const key = `prediction:${ticker}`;
    this.set(key, prediction, {
      ttl: 3600, // 1 Stunde für Predictions
      metadata: { ticker, predictionCached: new Date() },
    });
  }

  /**
   * Portfolio-Daten cachen
   */
  cachePortfolio(portfolioId: string, portfolio: any): void {
    const key = `portfolio:${portfolioId}`;
    this.set(key, portfolio, {
      ttl: 600, // 10 Minuten für Portfolio-Daten
      metadata: { portfolioId, portfolioCached: new Date() },
    });
  }

  /**
   * Analyseergebnisse cachen
   */
  cacheAnalysis(
    ticker: string,
    analysis: any,
    analysisType: string = "technical",
  ): void {
    const key = `analysis:${ticker}:${analysisType}`;
    this.set(key, analysis, {
      ttl: 1800, // 30 Minuten für Analysen
      metadata: { ticker, analysisType, analysisCached: new Date() },
    });
  }

  /**
   * Least Recently Used (LRU) Eviction
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed.getTime() < lruTime) {
        lruTime = entry.lastAccessed.getTime();
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.logger.debug(`Cache evicted (LRU): ${lruKey}`, "CACHE");
    }
  }

  /**
   * Abgelaufene Einträge aufräumen
   */
  private cleanup(): void {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      const ageInSeconds = (now - entry.timestamp.getTime()) / 1000;
      if (ageInSeconds > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cache cleanup: ${cleanedCount} expired entries removed`,
        "CACHE",
      );
    }
  }

  /**
   * Cleanup-Timer starten
   */
  private startCleanupTimer(): void {
    // Cleanup alle 5 Minuten
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Cleanup-Timer stoppen
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Service herunterfahren
   */
  onModuleDestroy(): void {
    this.stopCleanupTimer();
    this.clear();
    this.logger.info("Cache service stopped", "CACHE");
  }

  /**
   * Warming des Caches mit häufig verwendeten Daten
   */
  async warmup(tickers: string[]): Promise<void> {
    this.logger.info(
      `Starting cache warmup for ${tickers.length} tickers`,
      "CACHE",
    );

    const startTime = Date.now();
    let warmedCount = 0;

    for (const ticker of tickers) {
      try {
        // Hier könnten Daten vorgeladen werden
        // Placeholder für Ticker-Daten
        const placeholderData = {
          ticker,
          price: Math.random() * 1000,
          volume: Math.floor(Math.random() * 1000000),
          warmedUp: true,
          timestamp: new Date(),
        };

        this.cacheTickerData(ticker, placeholderData);
        warmedCount++;
      } catch (error) {
        this.logger.warn(`Cache warmup failed for ${ticker}`, "CACHE", {
          error,
        });
      }
    }

    const duration = Date.now() - startTime;
    this.logger.info(
      `Cache warmup completed: ${warmedCount}/${tickers.length} tickers in ${duration}ms`,
      "CACHE",
    );
  }

  /**
   * Cache-Health-Check
   */
  healthCheck(): {
    healthy: boolean;
    issues: string[];
    stats: CacheStatistics;
  } {
    const issues: string[] = [];
    const stats = this.getStatistics();

    // Prüfungen
    if (stats.hitRate < 50 && stats.totalHits + stats.totalMisses > 100) {
      issues.push(`Low hit rate: ${stats.hitRate.toFixed(1)}%`);
    }

    if (stats.totalEntries >= this.config.cacheMaxSize * 0.9) {
      issues.push(
        `Cache nearly full: ${stats.totalEntries}/${this.config.cacheMaxSize}`,
      );
    }

    if (stats.memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      issues.push(
        `High memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(1)} MB`,
      );
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats,
    };
  }
}
