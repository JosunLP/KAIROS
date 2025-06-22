import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, url, ip, headers } = req;

    // Log incoming request
    this.logger.log(`Incoming ${method} request to ${url}`, {
      method,
      url,
      ip,
      userAgent: headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    // Override res.end to log response
    const originalEnd = res.end;
    const middleware = this;

    res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Log response
      const logLevel =
        statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'log';
      middleware.logger[logLevel](
        `Outgoing ${method} response from ${url} - ${statusCode} (${duration}ms)`,
        {
          method,
          url,
          statusCode,
          duration,
          ip,
          timestamp: new Date().toISOString(),
        },
      );

      // Call original end method
      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  }
}

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private readonly slowRequestThreshold = 1000; // 1 second

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, url } = req;

    // Override res.end to check performance
    const originalEnd = res.end;
    const middleware = this;

    res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
      const duration = Date.now() - startTime;

      if (duration > middleware.slowRequestThreshold) {
        middleware.logger.warn(
          `Slow request detected: ${method} ${url} took ${duration}ms`,
          {
            method,
            url,
            duration,
            threshold: middleware.slowRequestThreshold,
            timestamp: new Date().toISOString(),
          },
        );
      }

      // Call original end method
      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  }
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, url, ip, headers } = req;

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Log suspicious requests
    const suspiciousPatterns = [
      /\.\.\//, // Directory traversal
      /<script/i, // XSS attempts
      /union\s+select/i, // SQL injection
      /eval\s*\(/i, // Code injection
    ];

    const userAgent = headers['user-agent'] || '';
    const isSuspicious = suspiciousPatterns.some(
      pattern => pattern.test(url) || pattern.test(userAgent),
    );

    if (isSuspicious) {
      this.logger.warn(`Suspicious request detected: ${method} ${url}`, {
        method,
        url,
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Generate or use existing request ID
    const requestId =
      (req.headers['x-request-id'] as string) || this.generateRequestId();

    // Add request ID to response headers
    res.setHeader('x-request-id', requestId);

    // Add request ID to request object
    (req as any).requestId = requestId;

    this.logger.debug(
      `Request ID assigned: ${requestId} for ${req.method} ${req.url}`,
    );

    next();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
