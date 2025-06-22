import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: any;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = null;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || 'HTTP Exception';
        details = responseObj.details || null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
      details = {
        stack:
          process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    } else if (typeof exception === 'string') {
      message = exception;
      error = 'String Exception';
    } else {
      message = 'Unknown error occurred';
      error = 'Unknown Exception';
      details = exception;
    }

    // Log the error
    this.logger.error(`Exception occurred: ${message}`, {
      statusCode: status,
      path: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      exception: exception,
    });

    // Create error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    };

    // Send response
    response.status(status).json(errorResponse);
  }
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    let message = 'HTTP Exception';
    let details: any = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || exception.message;
      details = responseObj.details || null;
    }

    this.logger.warn(`HTTP Exception: ${message}`, {
      statusCode: status,
      path: request.url,
      method: request.method,
      details,
    });

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: 'HTTP Exception',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    };

    response.status(status).json(errorResponse);
  }
}

@Catch(TypeError)
export class TypeErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeErrorFilter.name);

  catch(exception: TypeError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(`Type Error: ${exception.message}`, {
      path: request.url,
      method: request.method,
      stack: exception.stack,
    });

    const errorResponse: ErrorResponse = {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid request data',
      error: 'Type Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
      details:
        process.env.NODE_ENV === 'development'
          ? {
              originalMessage: exception.message,
              stack: exception.stack,
            }
          : undefined,
    };

    response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
  }
}

@Catch(ReferenceError)
export class ReferenceErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ReferenceErrorFilter.name);

  catch(exception: ReferenceError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(`Reference Error: ${exception.message}`, {
      path: request.url,
      method: request.method,
      stack: exception.stack,
    });

    const errorResponse: ErrorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Reference Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
      details:
        process.env.NODE_ENV === 'development'
          ? {
              originalMessage: exception.message,
              stack: exception.stack,
            }
          : undefined,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
}
