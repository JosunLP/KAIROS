import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface LoggedRequest {
  method: string;
  url: string;
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  ip: string;
  userAgent: string;
}

export interface LoggedResponse {
  statusCode: number;
  body?: any;
  duration: number;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Log request
    const loggedRequest: LoggedRequest = {
      method: request.method,
      url: request.url,
      body: this.sanitizeBody(request.body),
      params: request.params,
      query: request.query,
      headers: this.sanitizeHeaders(request.headers),
      ip: request.ip,
      userAgent: request.get('User-Agent'),
    };

    this.logger.log(`Incoming Request: ${request.method} ${request.url}`, {
      request: loggedRequest,
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap(data => {
        const duration = Date.now() - startTime;
        const loggedResponse: LoggedResponse = {
          statusCode: response.statusCode,
          body: this.sanitizeResponse(data),
          duration,
        };

        this.logger.log(
          `Outgoing Response: ${request.method} ${request.url} - ${response.statusCode} (${duration}ms)`,
          {
            response: loggedResponse,
            timestamp: new Date().toISOString(),
          },
        );
      }),
      catchError(error => {
        const duration = Date.now() - startTime;

        this.logger.error(
          `Request Error: ${request.method} ${request.url} - ${error.status || 500} (${duration}ms)`,
          {
            error: {
              message: error.message,
              status: error.status,
              stack: error.stack,
            },
            request: loggedRequest,
            duration,
            timestamp: new Date().toISOString(),
          },
        );

        throw error;
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return headers;

    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  private sanitizeResponse(data: any): any {
    if (!data) return data;

    // For large responses, only log metadata
    if (typeof data === 'object' && data.length > 100) {
      return {
        type: 'large-response',
        length: data.length,
        preview: Array.isArray(data)
          ? data.slice(0, 5)
          : Object.keys(data).slice(0, 5),
      };
    }

    return data;
  }
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);
  private readonly slowRequestThreshold = 1000; // 1 second

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        if (duration > this.slowRequestThreshold) {
          this.logger.warn(
            `Slow Request Detected: ${request.method} ${request.url} took ${duration}ms`,
            {
              method: request.method,
              url: request.url,
              duration,
              threshold: this.slowRequestThreshold,
              timestamp: new Date().toISOString(),
            },
          );
        }
      }),
    );
  }
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Generate or use existing request ID
    const requestId =
      request.headers['x-request-id'] || this.generateRequestId();

    // Add request ID to response headers
    response.setHeader('x-request-id', requestId);

    // Add request ID to request object for logging
    request.requestId = requestId;

    this.logger.debug(
      `Request ID assigned: ${requestId} for ${request.method} ${request.url}`,
    );

    return next.handle();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
