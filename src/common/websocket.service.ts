import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '../config/config.service';
import { CacheService } from './cache.service';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface StockUpdate {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface PortfolioUpdate {
  portfolioId: string;
  totalValue: number;
  dailyReturn: number;
  positions: Array<{
    ticker: string;
    value: number;
    change: number;
  }>;
  timestamp: Date;
}

export interface AlertNotification {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/kairos',
})
@Injectable()
export class WebSocketService {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebSocketService.name);
  private readonly connectedClients = new Map<string, Socket>();
  private readonly clientSubscriptions = new Map<string, Set<string>>();
  private readonly updateIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Verbindung eines Clients
   */
  handleConnection(client: Socket) {
    const clientId = client.id;
    this.connectedClients.set(clientId, client);
    this.clientSubscriptions.set(clientId, new Set());

    this.logger.log(`Client verbunden: ${clientId}`);

    // Sende Willkommensnachricht
    client.emit('connected', {
      message: 'Willkommen bei KAIROS Real-time',
      clientId,
      timestamp: new Date(),
    });
  }

  /**
   * Trennung eines Clients
   */
  handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.connectedClients.delete(clientId);
    this.clientSubscriptions.delete(clientId);

    // Stoppe Update-Intervalle für diesen Client
    const intervalKey = `client_${clientId}`;
    const interval = this.updateIntervals.get(intervalKey);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(intervalKey);
    }

    this.logger.log(`Client getrennt: ${clientId}`);
  }

  /**
   * Client abonniert Stock-Updates
   */
  @SubscribeMessage('subscribe_stock')
  handleSubscribeStock(
    @MessageBody() data: { ticker: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { ticker } = data;
    const clientId = client.id;

    const subscriptions = this.clientSubscriptions.get(clientId);
    if (subscriptions) {
      subscriptions.add(`stock:${ticker.toUpperCase()}`);
      client.join(`stock:${ticker.toUpperCase()}`);

      this.logger.debug(`Client ${clientId} abonniert Stock: ${ticker}`);

      // Starte Real-time Updates für diesen Stock
      this.startStockUpdates(ticker.toUpperCase());
    }
  }

  /**
   * Client abonniert Portfolio-Updates
   */
  @SubscribeMessage('subscribe_portfolio')
  handleSubscribePortfolio(
    @MessageBody() data: { portfolioId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { portfolioId } = data;
    const clientId = client.id;

    const subscriptions = this.clientSubscriptions.get(clientId);
    if (subscriptions) {
      subscriptions.add(`portfolio:${portfolioId}`);
      client.join(`portfolio:${portfolioId}`);

      this.logger.debug(
        `Client ${clientId} abonniert Portfolio: ${portfolioId}`,
      );

      // Starte Real-time Updates für dieses Portfolio
      this.startPortfolioUpdates(portfolioId);
    }
  }

  /**
   * Client abonniert Alerts
   */
  @SubscribeMessage('subscribe_alerts')
  handleSubscribeAlerts(
    @MessageBody() data: { types?: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const clientId = client.id;
    const { types = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] } = data;

    const subscriptions = this.clientSubscriptions.get(clientId);
    if (subscriptions) {
      subscriptions.add('alerts');
      client.join('alerts');

      this.logger.debug(
        `Client ${clientId} abonniert Alerts: ${types.join(', ')}`,
      );
    }
  }

  /**
   * Client kündigt Abonnement
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { type: string; id?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { type, id } = data;
    const clientId = client.id;

    const subscriptions = this.clientSubscriptions.get(clientId);
    if (subscriptions) {
      const subscriptionKey = id ? `${type}:${id}` : type;
      subscriptions.delete(subscriptionKey);
      client.leave(subscriptionKey);

      this.logger.debug(
        `Client ${clientId} kündigt Abonnement: ${subscriptionKey}`,
      );
    }
  }

  /**
   * Sendet Stock-Update an alle abonnierten Clients
   */
  broadcastStockUpdate(update: StockUpdate) {
    const room = `stock:${update.ticker}`;
    this.server.to(room).emit('stock_update', {
      ...update,
      timestamp: new Date(),
    });

    this.logger.debug(
      `Stock-Update gesendet für ${update.ticker}: ${update.price}`,
    );
  }

  /**
   * Sendet Portfolio-Update an alle abonnierten Clients
   */
  broadcastPortfolioUpdate(update: PortfolioUpdate) {
    const room = `portfolio:${update.portfolioId}`;
    this.server.to(room).emit('portfolio_update', {
      ...update,
      timestamp: new Date(),
    });

    this.logger.debug(`Portfolio-Update gesendet für ${update.portfolioId}`);
  }

  /**
   * Sendet Alert an alle abonnierten Clients
   */
  broadcastAlert(alert: AlertNotification) {
    this.server.to('alerts').emit('alert', {
      ...alert,
      timestamp: new Date(),
    });

    this.logger.debug(`Alert gesendet: ${alert.title}`);
  }

  /**
   * Sendet System-Update an alle Clients
   */
  broadcastSystemUpdate(data: any) {
    this.server.emit('system_update', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Startet Real-time Updates für einen Stock
   */
  private startStockUpdates(ticker: string) {
    const intervalKey = `stock:${ticker}`;

    // Verhindere doppelte Intervalle
    if (this.updateIntervals.has(intervalKey)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // Hole aktuelle Daten aus Cache oder Datenbank
        const cachedData = this.cacheService.get(`stock:${ticker}:latest`);
        if (cachedData) {
          this.broadcastStockUpdate({
            ticker,
            price: cachedData.close,
            change: cachedData.change || 0,
            changePercent: cachedData.changePercent || 0,
            volume: cachedData.volume,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        this.logger.error(`Fehler bei Stock-Updates für ${ticker}:`, error);
      }
    }, 5000); // Alle 5 Sekunden

    this.updateIntervals.set(intervalKey, interval);
  }

  /**
   * Startet Real-time Updates für ein Portfolio
   */
  private startPortfolioUpdates(portfolioId: string) {
    const intervalKey = `portfolio:${portfolioId}`;

    if (this.updateIntervals.has(intervalKey)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // Hole Portfolio-Daten aus Cache
        const cachedData = this.cacheService.get(`portfolio:${portfolioId}`);
        if (cachedData) {
          this.broadcastPortfolioUpdate({
            portfolioId,
            totalValue: cachedData.totalValue,
            dailyReturn: cachedData.dailyReturn,
            positions: cachedData.positions || [],
            timestamp: new Date(),
          });
        }
      } catch (error) {
        this.logger.error(
          `Fehler bei Portfolio-Updates für ${portfolioId}:`,
          error,
        );
      }
    }, 10000); // Alle 10 Sekunden

    this.updateIntervals.set(intervalKey, interval);
  }

  /**
   * Stoppt Updates für einen Stock
   */
  stopStockUpdates(ticker: string) {
    const intervalKey = `stock:${ticker}`;
    const interval = this.updateIntervals.get(intervalKey);

    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(intervalKey);
      this.logger.debug(`Stock-Updates gestoppt für ${ticker}`);
    }
  }

  /**
   * Stoppt Updates für ein Portfolio
   */
  stopPortfolioUpdates(portfolioId: string) {
    const intervalKey = `portfolio:${portfolioId}`;
    const interval = this.updateIntervals.get(intervalKey);

    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(intervalKey);
      this.logger.debug(`Portfolio-Updates gestoppt für ${portfolioId}`);
    }
  }

  /**
   * Holt Statistiken über verbundene Clients
   */
  getConnectionStats() {
    return {
      totalClients: this.connectedClients.size,
      activeSubscriptions: Array.from(this.clientSubscriptions.values()).reduce(
        (total, subscriptions) => total + subscriptions.size,
        0,
      ),
      activeIntervals: this.updateIntervals.size,
      timestamp: new Date(),
    };
  }

  /**
   * Sendet Nachricht an spezifischen Client
   */
  sendToClient(clientId: string, event: string, data: any) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.emit(event, {
        ...data,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Broadcast an alle Clients
   */
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Cleanup beim Herunterfahren
   */
  onModuleDestroy() {
    // Stoppe alle Update-Intervalle
    for (const [key, interval] of this.updateIntervals) {
      clearInterval(interval);
      this.logger.debug(`Update-Intervall gestoppt: ${key}`);
    }

    this.updateIntervals.clear();
    this.connectedClients.clear();
    this.clientSubscriptions.clear();
  }
}
