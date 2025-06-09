import { Injectable } from "@nestjs/common";
import { LoggerService } from "./logger.service";
import { ConfigService } from "../config/config.service";

export interface Notification {
  id: string;
  type: "INFO" | "WARNING" | "ERROR" | "CRITICAL" | "SUCCESS";
  title: string;
  message: string;
  component: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: any;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  data?: any;
}

export interface NotificationFilter {
  type?: "INFO" | "WARNING" | "ERROR" | "CRITICAL" | "SUCCESS";
  component?: string;
  acknowledged?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  component: string;
  condition: string; // z.B. "portfolio_loss > 10"
  threshold: number;
  enabled: boolean;
  cooldownMinutes: number; // Minimum Zeit zwischen Alerts
  lastTriggered?: Date;
  notificationTypes: ("console" | "email" | "system")[];
}

@Injectable()
export class NotificationService {
  private notifications: Map<string, Notification> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationCounter = 1;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {
    this.initializeDefaultAlertRules();
  }

  /**
   * Erstellt eine neue Benachrichtigung
   */
  notify(
    type: Notification["type"],
    title: string,
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
    actions?: NotificationAction[],
  ): string {
    const id = `notification-${this.notificationCounter++}`;

    const notification: Notification = {
      id,
      type,
      title,
      message,
      component,
      timestamp: new Date(),
      acknowledged: false,
      metadata,
      actions,
    };

    this.notifications.set(id, notification);

    // Log the notification
    this.logNotification(notification);

    // Send to external systems if configured
    this.sendToExternalSystems(notification);

    // Cleanup old notifications
    this.cleanupOldNotifications();

    return id;
  }

  /**
   * Info-Benachrichtigung
   */
  info(
    title: string,
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
  ): string {
    return this.notify("INFO", title, message, component, metadata);
  }

  /**
   * Success-Benachrichtigung
   */
  success(
    title: string,
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
  ): string {
    return this.notify("SUCCESS", title, message, component, metadata);
  }

  /**
   * Warning-Benachrichtigung
   */
  warning(
    title: string,
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
  ): string {
    return this.notify("WARNING", title, message, component, metadata);
  }

  /**
   * Error-Benachrichtigung
   */
  error(
    title: string,
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
  ): string {
    return this.notify("ERROR", title, message, component, metadata);
  }

  /**
   * Critical-Benachrichtigung
   */
  critical(
    title: string,
    message: string,
    component: string = "SYSTEM",
    metadata?: any,
  ): string {
    return this.notify("CRITICAL", title, message, component, metadata);
  }

  /**
   * Portfolio-spezifische Benachrichtigungen
   */
  portfolioAlert(
    portfolioId: string,
    type: "GAIN" | "LOSS" | "RISK" | "REBALANCE",
    percentage: number,
    currentValue: number,
  ): string {
    const typeMap = {
      GAIN: { level: "SUCCESS" as const, title: "Portfolio Gewinn" },
      LOSS: { level: "WARNING" as const, title: "Portfolio Verlust" },
      RISK: { level: "ERROR" as const, title: "Hohes Portfolio-Risiko" },
      REBALANCE: {
        level: "INFO" as const,
        title: "Portfolio Rebalancing empfohlen",
      },
    };

    const config = typeMap[type];
    const message = `Portfolio ${portfolioId}: ${Math.abs(percentage).toFixed(2)}% ${type.toLowerCase()}. Aktueller Wert: $${currentValue.toLocaleString()}`;

    return this.notify(
      config.level,
      config.title,
      message,
      "PORTFOLIO",
      {
        portfolioId,
        type,
        percentage,
        currentValue,
        portfolioAlert: true,
      },
      type === "REBALANCE"
        ? [
            {
              label: "Rebalancing starten",
              action: "rebalance_portfolio",
              data: { portfolioId },
            },
          ]
        : undefined,
    );
  }

  /**
   * Trading-spezifische Benachrichtigungen
   */
  tradingAlert(
    ticker: string,
    action: "BUY" | "SELL",
    quantity: number,
    price: number,
    confidence: number,
  ): string {
    const title = `Trading Signal: ${action} ${ticker}`;
    const message = `Empfehlung: ${action} ${quantity} Aktien von ${ticker} bei $${price.toFixed(2)} (Konfidenz: ${(confidence * 100).toFixed(1)}%)`;

    return this.notify(
      "INFO",
      title,
      message,
      "TRADING",
      {
        ticker,
        action,
        quantity,
        price,
        confidence,
        tradingAlert: true,
      },
      [
        {
          label: "Signal ausführen",
          action: "execute_trade",
          data: { ticker, action, quantity, price },
        },
        {
          label: "Signal ignorieren",
          action: "ignore_signal",
          data: { ticker },
        },
      ],
    );
  }

  /**
   * ML-Training Benachrichtigungen
   */
  mlTrainingAlert(
    model: string,
    status: "STARTED" | "COMPLETED" | "FAILED" | "PROGRESS",
    details: any,
  ): string {
    const typeMap = {
      STARTED: { level: "INFO" as const, title: "ML Training gestartet" },
      COMPLETED: {
        level: "SUCCESS" as const,
        title: "ML Training abgeschlossen",
      },
      FAILED: { level: "ERROR" as const, title: "ML Training fehlgeschlagen" },
      PROGRESS: { level: "INFO" as const, title: "ML Training Fortschritt" },
    };

    const config = typeMap[status];
    let message = `Modell: ${model}`;

    if (status === "COMPLETED" && details.accuracy) {
      message += ` - Genauigkeit: ${(details.accuracy * 100).toFixed(2)}%`;
    } else if (status === "PROGRESS" && details.epoch && details.totalEpochs) {
      message += ` - Epoche ${details.epoch}/${details.totalEpochs}`;
    } else if (status === "FAILED" && details.error) {
      message += ` - Fehler: ${details.error}`;
    }

    return this.notify(config.level, config.title, message, "ML", {
      model,
      status,
      details,
      mlTrainingAlert: true,
    });
  }

  /**
   * System Health Benachrichtigungen
   */
  systemHealthAlert(
    component: string,
    status: "UP" | "DOWN" | "DEGRADED",
    metrics?: any,
  ): string {
    const typeMap = {
      UP: { level: "SUCCESS" as const, title: "System wiederhergestellt" },
      DOWN: { level: "CRITICAL" as const, title: "System ausgefallen" },
      DEGRADED: { level: "WARNING" as const, title: "System beeinträchtigt" },
    };

    const config = typeMap[status];
    let message = `Komponente: ${component} - Status: ${status}`;

    if (metrics) {
      if (metrics.responseTime) {
        message += ` - Antwortzeit: ${metrics.responseTime}ms`;
      }
      if (metrics.errorRate) {
        message += ` - Fehlerrate: ${(metrics.errorRate * 100).toFixed(2)}%`;
      }
    }

    return this.notify(config.level, config.title, message, "SYSTEM", {
      component,
      status,
      metrics,
      systemHealthAlert: true,
    });
  }

  /**
   * Benachrichtigung als bestätigt markieren
   */
  acknowledge(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.acknowledged = true;
      this.logger.info(
        `Notification acknowledged: ${notificationId}`,
        "NOTIFICATION",
      );
      return true;
    }
    return false;
  }

  /**
   * Benachrichtigung löschen
   */
  dismiss(notificationId: string): boolean {
    const success = this.notifications.delete(notificationId);
    if (success) {
      this.logger.info(
        `Notification dismissed: ${notificationId}`,
        "NOTIFICATION",
      );
    }
    return success;
  }

  /**
   * Alle Benachrichtigungen als bestätigt markieren
   */
  acknowledgeAll(filter?: NotificationFilter): number {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (
        this.matchesFilter(notification, filter) &&
        !notification.acknowledged
      ) {
        notification.acknowledged = true;
        count++;
      }
    }
    this.logger.info(`${count} notifications acknowledged`, "NOTIFICATION");
    return count;
  }

  /**
   * Benachrichtigungen abrufen
   */
  getNotifications(
    filter?: NotificationFilter,
    limit?: number,
  ): Notification[] {
    let notifications = Array.from(this.notifications.values());

    // Filter anwenden
    if (filter) {
      notifications = notifications.filter((n) =>
        this.matchesFilter(n, filter),
      );
    }

    // Nach Timestamp sortieren (neueste zuerst)
    notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limitieren wenn angegeben
    if (limit) {
      notifications = notifications.slice(0, limit);
    }

    return notifications;
  }

  /**
   * Unbestätigte Benachrichtigungen zählen
   */
  getUnacknowledgedCount(filter?: NotificationFilter): number {
    return this.getNotifications({ ...filter, acknowledged: false }).length;
  }

  /**
   * Alert-Regel hinzufügen
   */
  addAlertRule(rule: Omit<AlertRule, "id">): string {
    const id = `alert-rule-${Date.now()}`;
    const alertRule: AlertRule = { ...rule, id };
    this.alertRules.set(id, alertRule);
    return id;
  }

  /**
   * Alert-Regel prüfen und auslösen
   */
  checkAlertRule(ruleId: string, currentValue: number): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule || !rule.enabled) {
      return false;
    }

    // Cooldown prüfen
    if (rule.lastTriggered) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
        return false;
      }
    }

    // Bedingung prüfen (vereinfacht)
    let triggered = false;
    if (rule.condition.includes(">")) {
      triggered = currentValue > rule.threshold;
    } else if (rule.condition.includes("<")) {
      triggered = currentValue < rule.threshold;
    } else if (rule.condition.includes("=")) {
      triggered = Math.abs(currentValue - rule.threshold) < 0.01;
    }

    if (triggered) {
      rule.lastTriggered = new Date();
      this.notify(
        "WARNING",
        `Alert: ${rule.name}`,
        `Bedingung "${rule.condition}" erfüllt. Aktueller Wert: ${currentValue}`,
        rule.component,
        { alertRule: rule, triggerValue: currentValue },
      );
      return true;
    }

    return false;
  }

  /**
   * Standard Alert-Regeln initialisieren
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, "id">[] = [
      {
        name: "Portfolio Verlust > 10%",
        component: "PORTFOLIO",
        condition: "portfolio_loss > 10",
        threshold: 10,
        enabled: true,
        cooldownMinutes: 60,
        notificationTypes: ["console", "email"],
      },
      {
        name: "System CPU > 90%",
        component: "SYSTEM",
        condition: "cpu_usage > 90",
        threshold: 90,
        enabled: true,
        cooldownMinutes: 15,
        notificationTypes: ["console", "system"],
      },
      {
        name: "ML Accuracy < 60%",
        component: "ML",
        condition: "ml_accuracy < 60",
        threshold: 60,
        enabled: true,
        cooldownMinutes: 120,
        notificationTypes: ["console"],
      },
    ];

    defaultRules.forEach((rule) => this.addAlertRule(rule));
  }

  /**
   * Benachrichtigung zu Logger senden
   */
  private logNotification(notification: Notification): void {
    const logLevel = this.getLogLevel(notification.type);
    const message = `${notification.title}: ${notification.message}`;

    switch (logLevel) {
      case "DEBUG":
        this.logger.debug(
          message,
          notification.component,
          notification.metadata,
        );
        break;
      case "INFO":
        this.logger.info(
          message,
          notification.component,
          notification.metadata,
        );
        break;
      case "WARN":
        this.logger.warn(
          message,
          notification.component,
          notification.metadata,
        );
        break;
      case "ERROR":
        this.logger.error(
          message,
          notification.component,
          notification.metadata,
        );
        break;
      case "CRITICAL":
        this.logger.critical(
          message,
          notification.component,
          notification.metadata,
        );
        break;
    }
  }

  /**
   * Benachrichtigung an externe Systeme senden
   */
  private async sendToExternalSystems(
    notification: Notification,
  ): Promise<void> {
    try {
      // Email-Benachrichtigung
      if (
        this.config.enableEmailNotifications &&
        this.shouldSendEmail(notification)
      ) {
        await this.sendEmailNotification(notification);
      }

      // Weitere externe Systeme können hier hinzugefügt werden
      // z.B. Slack, Discord, SMS, etc.
    } catch (error) {
      this.logger.error(
        "Failed to send external notification",
        "NOTIFICATION",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * E-Mail-Benachrichtigung senden (Placeholder)
   */
  private async sendEmailNotification(
    notification: Notification,
  ): Promise<void> {
    // In einer echten Implementierung würde hier ein E-Mail-Service verwendet
    this.logger.info(
      `Email notification would be sent: ${notification.title}`,
      "NOTIFICATION",
    );
  }

  /**
   * Prüft ob E-Mail gesendet werden soll
   */
  private shouldSendEmail(notification: Notification): boolean {
    return notification.type === "CRITICAL" || notification.type === "ERROR";
  }

  /**
   * Log-Level basierend auf Notification-Type ermitteln
   */
  private getLogLevel(
    type: Notification["type"],
  ): "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL" {
    switch (type) {
      case "INFO":
        return "INFO";
      case "SUCCESS":
        return "INFO";
      case "WARNING":
        return "WARN";
      case "ERROR":
        return "ERROR";
      case "CRITICAL":
        return "CRITICAL";
      default:
        return "INFO";
    }
  }

  /**
   * Prüft ob Benachrichtigung zu Filter passt
   */
  private matchesFilter(
    notification: Notification,
    filter?: NotificationFilter,
  ): boolean {
    if (!filter) return true;

    if (filter.type && notification.type !== filter.type) return false;
    if (filter.component && notification.component !== filter.component)
      return false;
    if (
      filter.acknowledged !== undefined &&
      notification.acknowledged !== filter.acknowledged
    )
      return false;
    if (filter.startDate && notification.timestamp < filter.startDate)
      return false;
    if (filter.endDate && notification.timestamp > filter.endDate) return false;

    return true;
  }

  /**
   * Alte Benachrichtigungen aufräumen
   */
  private cleanupOldNotifications(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 Tage
    const cutoff = new Date(Date.now() - maxAge);

    let cleanedCount = 0;
    for (const [id, notification] of this.notifications) {
      if (notification.timestamp < cutoff && notification.acknowledged) {
        this.notifications.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} old notifications`,
        "NOTIFICATION",
      );
    }
  }
}
