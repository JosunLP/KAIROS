import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly validApiKeys = new Set<string>();

  constructor() {
    // Load API keys from environment
    const apiKeys = process.env.API_KEYS?.split(',') || [];
    apiKeys.forEach(key => this.validApiKeys.add(key.trim()));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.logger.warn('API key missing from request', {
        url: request.url,
        method: request.method,
        ip: request.ip,
      });
      throw new UnauthorizedException('API key is required');
    }

    if (!this.validApiKeys.has(apiKey)) {
      this.logger.warn('Invalid API key provided', {
        url: request.url,
        method: request.method,
        ip: request.ip,
        providedKey: apiKey.substring(0, 8) + '...',
      });
      throw new UnauthorizedException('Invalid API key');
    }

    // Add user context for logging
    request.user = {
      id: 'api-user',
      email: 'api@kairos.com',
      roles: ['api'],
    };

    this.logger.debug('API key validated successfully', {
      url: request.url,
      method: request.method,
    });

    return true;
  }

  private extractApiKey(request: Request): string | null {
    // Check header first
    const headerKey = request.headers['x-api-key'] as string;
    if (headerKey) return headerKey;

    // Check query parameter
    const queryKey = request.query.apiKey as string;
    if (queryKey) return queryKey;

    // Check authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly requestCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly maxRequests = parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || '100',
  );
  private readonly windowMs = parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || '900000',
  ); // 15 minutes

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = this.getClientId(request);
    const now = Date.now();

    // Clean up expired entries
    this.cleanupExpiredEntries(now);

    // Get or create client record
    const clientRecord = this.requestCounts.get(clientId) || {
      count: 0,
      resetTime: now + this.windowMs,
    };

    // Check if window has reset
    if (now > clientRecord.resetTime) {
      clientRecord.count = 0;
      clientRecord.resetTime = now + this.windowMs;
    }

    // Increment request count
    clientRecord.count++;
    this.requestCounts.set(clientId, clientRecord);

    // Check rate limit
    if (clientRecord.count > this.maxRequests) {
      this.logger.warn('Rate limit exceeded', {
        clientId,
        count: clientRecord.count,
        maxRequests: this.maxRequests,
        resetTime: new Date(clientRecord.resetTime).toISOString(),
      });
      throw new UnauthorizedException('Rate limit exceeded');
    }

    this.logger.debug('Rate limit check passed', {
      clientId,
      count: clientRecord.count,
      maxRequests: this.maxRequests,
    });

    return true;
  }

  private getClientId(request: Request): string {
    // Use API key if available, otherwise use IP
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) {
      return `api:${apiKey.substring(0, 8)}`;
    }
    return `ip:${request.ip}`;
  }

  private cleanupExpiredEntries(now: number): void {
    for (const [clientId, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(clientId);
      }
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      this.logger.warn('Admin access attempted without authentication');
      throw new UnauthorizedException('Authentication required');
    }

    if (!request.user.roles.includes('admin')) {
      this.logger.warn('Admin access attempted without admin role', {
        userId: request.user.id,
        roles: request.user.roles,
      });
      throw new UnauthorizedException('Admin access required');
    }

    this.logger.debug('Admin access granted', {
      userId: request.user.id,
      roles: request.user.roles,
    });

    return true;
  }
}
