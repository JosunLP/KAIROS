import { Injectable, Logger } from '@nestjs/common';

export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorInfo {
  id: string;
  timestamp: Date;
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(errorInfo: ErrorInfo): Promise<void>;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);
  private readonly errorHistory: ErrorInfo[] = [];
  private readonly handlers: ErrorHandler[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * Registriert einen Error Handler
   */
  registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
    this.logger.debug(`Error handler registered: ${handler.constructor.name}`);
  }

  /**
   * Erweiterte Retry-Logik mit Exponential Backoff
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Prüfe ob Retry sinnvoll ist
        if (!this.shouldRetry(error as Error)) {
          break;
        }

        // Exponential Backoff mit Jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

        this.logger.warn(
          `Retry ${attempt + 1}/${maxRetries} für ${context.operation} in ${Math.round(delay)}ms`,
          context.component,
        );

        await this.delay(delay);
      }
    }

    // Alle Versuche fehlgeschlagen
    await this.handleError(lastError!, context, 'high');
    throw lastError!;
  }

  /**
   * Erweiterte Circuit Breaker Implementierung
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    failureThreshold: number = 5,
    timeout: number = 30000,
  ): Promise<T> {
    const circuitKey = `${context.component}:${context.operation}`;
    const circuit = this.getCircuitState(circuitKey);

    // Prüfe Circuit Breaker Status
    if (circuit.status === 'open') {
      if (Date.now() - circuit.lastFailureTime < circuit.timeout) {
        throw new Error(`Circuit breaker is OPEN for ${circuitKey}`);
      } else {
        // Timeout abgelaufen, versuche HALF_OPEN
        circuit.status = 'half-open';
      }
    }

    try {
      // Timeout für Operation
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), timeout),
        ),
      ]);

      // Erfolg - Circuit schließen
      this.resetCircuit(circuitKey);
      return result;
    } catch (error) {
      // Fehler - Circuit Breaker aktualisieren
      this.recordFailure(circuitKey, error as Error, failureThreshold);
      throw error;
    }
  }

  /**
   * Erweiterte Fehlerbehandlung mit Kategorisierung
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      error,
      context,
      severity,
      handled: false,
      retryCount: 0,
      maxRetries: this.getMaxRetriesForSeverity(severity),
    };

    // Fehler kategorisieren
    const category = this.categorizeError(error);
    errorInfo.context.metadata = {
      ...errorInfo.context.metadata,
      category,
      errorType: error.constructor.name,
    };

    // Fehler zur Historie hinzufügen
    this.addToHistory(errorInfo);

    // Logging mit erweiterten Details
    this.logError(errorInfo);

    // Spezifische Handler basierend auf Kategorie
    const handler = this.findHandler(error);
    if (handler) {
      try {
        await handler.handle(errorInfo);
        errorInfo.handled = true;
        this.logger.debug(`Error handled by ${handler.constructor.name}`);
      } catch (handlerError) {
        this.logger.error('Error handler failed', handlerError);
      }
    } else {
      this.logger.warn(`No handler found for error: ${error.constructor.name}`);
    }

    // Kritische Fehler sofort melden
    if (severity === 'critical') {
      await this.handleCriticalError(errorInfo);
    }

    // Metriken aktualisieren
    this.updateErrorMetrics(errorInfo);
  }

  /**
   * Kategorisiert Fehler für bessere Behandlung
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection')) {
      return 'NETWORK';
    }

    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return 'RATE_LIMIT';
    }

    if (message.includes('authentication') || message.includes('401')) {
      return 'AUTHENTICATION';
    }

    if (message.includes('authorization') || message.includes('403')) {
      return 'AUTHORIZATION';
    }

    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }

    if (message.includes('validation')) {
      return 'VALIDATION';
    }

    if (message.includes('database') || message.includes('sql')) {
      return 'DATABASE';
    }

    return 'UNKNOWN';
  }

  /**
   * Aktualisiert Fehler-Metriken
   */
  private updateErrorMetrics(errorInfo: ErrorInfo): void {
    // Hier könnten Metriken an ein Monitoring-System gesendet werden
    this.logger.debug(
      `Error metrics updated for ${errorInfo.context.component}`,
    );
  }

  /**
   * Prüft ob ein Fehler retry-würdig ist
   */
  private shouldRetry(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Nicht retry-würdige Fehler
    if (
      message.includes('validation') ||
      message.includes('authentication') ||
      message.includes('authorization') ||
      message.includes('not found')
    ) {
      return false;
    }

    // Retry-würdige Fehler
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('temporary') ||
      message.includes('server error')
    );
  }

  /**
   * Behandelt API-Fehler
   */
  async handleApiError(
    error: Error,
    url: string,
    method: string,
    statusCode?: number,
    context?: Partial<ErrorContext>,
  ): Promise<void> {
    const apiContext: ErrorContext = {
      component: 'API',
      operation: `${method} ${url}`,
      metadata: {
        url,
        method,
        statusCode,
        ...context?.metadata,
      },
      ...context,
    };

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // Schweregrad basierend auf Status Code
    if (statusCode) {
      if (statusCode >= 500) {
        severity = 'high';
      } else if (statusCode === 429) {
        severity = 'medium'; // Rate limiting
      } else if (statusCode >= 400) {
        severity = 'low';
      }
    }

    // Netzwerkfehler als kritisch behandeln
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      severity = 'critical';
    }

    await this.handleError(error, apiContext, severity);
  }

  /**
   * Behandelt Datenbankfehler
   */
  async handleDatabaseError(
    error: Error,
    operation: string,
    table?: string,
    context?: Partial<ErrorContext>,
  ): Promise<void> {
    const dbContext: ErrorContext = {
      component: 'DATABASE',
      operation,
      metadata: {
        table,
        ...context?.metadata,
      },
      ...context,
    };

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // Schweregrad basierend auf Fehlertyp
    if (
      error.message.includes('connection') ||
      error.message.includes('timeout')
    ) {
      severity = 'critical';
    } else if (
      error.message.includes('constraint') ||
      error.message.includes('unique')
    ) {
      severity = 'low';
    } else if (
      error.message.includes('permission') ||
      error.message.includes('access')
    ) {
      severity = 'high';
    }

    await this.handleError(error, dbContext, severity);
  }

  /**
   * Behandelt ML-Fehler
   */
  async handleMLError(
    error: Error,
    operation: string,
    modelName?: string,
    context?: Partial<ErrorContext>,
  ): Promise<void> {
    const mlContext: ErrorContext = {
      component: 'ML',
      operation,
      metadata: {
        modelName,
        ...context?.metadata,
      },
      ...context,
    };

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // Schweregrad basierend auf Fehlertyp
    if (
      error.message.includes('memory') ||
      error.message.includes('out of memory')
    ) {
      severity = 'critical';
    } else if (
      error.message.includes('model') ||
      error.message.includes('training')
    ) {
      severity = 'high';
    } else if (
      error.message.includes('prediction') ||
      error.message.includes('inference')
    ) {
      severity = 'medium';
    }

    await this.handleError(error, mlContext, severity);
  }

  /**
   * Behandelt Validierungsfehler
   */
  async handleValidationError(
    error: Error,
    field: string,
    value: any,
    context?: Partial<ErrorContext>,
  ): Promise<void> {
    const validationContext: ErrorContext = {
      component: 'VALIDATION',
      operation: 'validate',
      metadata: {
        field,
        value,
        ...context?.metadata,
      },
      ...context,
    };

    await this.handleError(error, validationContext, 'low');
  }

  /**
   * Gibt Fehlerstatistiken zurück
   */
  getErrorStatistics(hours: number = 24): {
    total: number;
    bySeverity: Record<string, number>;
    byComponent: Record<string, number>;
    byType: Record<string, number>;
    handled: number;
    unhandled: number;
  } {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(
      error => error.timestamp >= cutoffTime,
    );

    const stats = {
      total: recentErrors.length,
      bySeverity: {} as Record<string, number>,
      byComponent: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      handled: 0,
      unhandled: 0,
    };

    recentErrors.forEach(error => {
      // Schweregrad
      stats.bySeverity[error.severity] =
        (stats.bySeverity[error.severity] || 0) + 1;

      // Komponente
      stats.byComponent[error.context.component] =
        (stats.byComponent[error.context.component] || 0) + 1;

      // Fehlertyp
      const errorType = error.error.constructor.name;
      stats.byType[errorType] = (stats.byType[errorType] || 0) + 1;

      // Behandelt/Unbehandelt
      if (error.handled) {
        stats.handled++;
      } else {
        stats.unhandled++;
      }
    });

    return stats;
  }

  /**
   * Bereinigt alte Fehler aus der Historie
   */
  cleanupHistory(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = new Date(Date.now() - maxAge);
    const initialLength = this.errorHistory.length;

    this.errorHistory.splice(
      0,
      this.errorHistory.findIndex(error => error.timestamp >= cutoffTime),
    );

    const removedCount = initialLength - this.errorHistory.length;
    if (removedCount > 0) {
      this.logger.debug(`Cleaned up ${removedCount} old error records`);
    }
  }

  /**
   * Exportiert Fehler für Analyse
   */
  exportErrors(limit: number = 100): ErrorInfo[] {
    return this.errorHistory.slice(-limit).map(error => ({
      ...error,
      error: {
        name: error.error.name,
        message: error.error.message,
        stack: error.error.stack,
      },
    }));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMaxRetriesForSeverity(severity: string): number {
    switch (severity) {
      case 'critical':
        return 0; // Keine Retries für kritische Fehler
      case 'high':
        return 1;
      case 'medium':
        return 2;
      case 'low':
        return 3;
      default:
        return 1;
    }
  }

  private findHandler(error: Error): ErrorHandler | null {
    return this.handlers.find(handler => handler.canHandle(error)) || null;
  }

  private addToHistory(errorInfo: ErrorInfo): void {
    this.errorHistory.push(errorInfo);

    // Größe begrenzen
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  private logError(errorInfo: ErrorInfo): void {
    const logMessage = `[${errorInfo.severity.toUpperCase()}] ${errorInfo.context.component}:${errorInfo.context.operation} - ${errorInfo.error.message}`;

    switch (errorInfo.severity) {
      case 'critical':
        this.logger.error(logMessage, errorInfo.error.stack);
        break;
      case 'high':
        this.logger.error(logMessage);
        break;
      case 'medium':
        this.logger.warn(logMessage);
        break;
      case 'low':
        this.logger.debug(logMessage);
        break;
    }
  }

  private async handleCriticalError(errorInfo: ErrorInfo): Promise<void> {
    // Hier könnten kritische Fehler an externe Systeme gemeldet werden
    // z.B. PagerDuty, Slack, etc.
    this.logger.error('CRITICAL ERROR DETECTED', {
      errorId: errorInfo.id,
      component: errorInfo.context.component,
      operation: errorInfo.context.operation,
      message: errorInfo.error.message,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit Breaker Implementation
  private circuitStates = new Map<
    string,
    {
      status: 'open' | 'closed' | 'half-open';
      failureCount: number;
      lastFailureTime: number;
      successCount: number;
      timeout: number;
    }
  >();

  private getCircuitState(key: string) {
    if (!this.circuitStates.has(key)) {
      this.circuitStates.set(key, {
        status: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0,
        timeout: 60000, // 1 minute default timeout
      });
    }
    return this.circuitStates.get(key)!;
  }

  private recordFailure(
    key: string,
    error: Error,
    failureThreshold: number = 5,
  ): void {
    const circuit = this.getCircuitState(key);
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failureCount >= failureThreshold) {
      circuit.status = 'open';
      this.logger.warn(`Circuit breaker OPEN for ${key}`);
    }
  }

  private resetCircuit(key: string): void {
    const circuit = this.getCircuitState(key);
    circuit.status = 'closed';
    circuit.failureCount = 0;
    circuit.successCount++;
    this.logger.debug(`Circuit breaker CLOSED for ${key}`);
  }
}
