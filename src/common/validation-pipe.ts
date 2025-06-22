import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Logger,
  PipeTransform,
} from '@nestjs/common';

export interface ValidationErrorResponse {
  message: string;
  errors: string[];
  timestamp: string;
}

@Injectable()
export class GlobalValidationPipe implements PipeTransform {
  private readonly logger = new Logger(GlobalValidationPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    // Basic validation
    if (value === null || value === undefined) {
      throw new BadRequestException('Value cannot be null or undefined');
    }

    // Type validation
    if (metadata.type === 'body' && typeof value !== 'object') {
      throw new BadRequestException('Body must be an object');
    }

    // String validation for specific fields
    if (metadata.type === 'param' || metadata.type === 'query') {
      if (typeof value === 'string') {
        // Sanitize string inputs
        return this.sanitizeString(value);
      }
    }

    return value;
  }

  private sanitizeString(value: string): string {
    // Remove potentially dangerous characters
    return value
      .trim()
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }
}

@Injectable()
export class StockValidationPipe implements PipeTransform {
  private readonly logger = new Logger(StockValidationPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'param' && metadata.data === 'ticker') {
      return this.validateTicker(value);
    }

    if (metadata.type === 'body' && metadata.data === 'stockData') {
      return this.validateStockData(value);
    }

    return value;
  }

  private validateTicker(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Ticker must be a non-empty string');
    }

    const ticker = value.trim().toUpperCase();

    // Validate ticker format
    if (!/^[A-Z]{1,10}$/.test(ticker)) {
      throw new BadRequestException(
        'Ticker must be 1-10 uppercase letters only',
      );
    }

    return ticker;
  }

  private validateStockData(value: any): any {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Stock data must be an object');
    }

    const requiredFields = ['ticker', 'price'];
    for (const field of requiredFields) {
      if (!(field in value)) {
        throw new BadRequestException(`Missing required field: ${field}`);
      }
    }

    // Validate price
    if (typeof value.price !== 'number' || value.price <= 0) {
      throw new BadRequestException('Price must be a positive number');
    }

    // Validate volume if present
    if (value.volume !== undefined) {
      if (typeof value.volume !== 'number' || value.volume < 0) {
        throw new BadRequestException('Volume must be a non-negative number');
      }
    }

    return value;
  }
}

@Injectable()
export class PortfolioValidationPipe implements PipeTransform {
  private readonly logger = new Logger(PortfolioValidationPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && metadata.data === 'portfolioData') {
      return this.validatePortfolioData(value);
    }

    if (metadata.type === 'body' && metadata.data === 'positionData') {
      return this.validatePositionData(value);
    }

    return value;
  }

  private validatePortfolioData(value: any): any {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Portfolio data must be an object');
    }

    if (!value.name || typeof value.name !== 'string') {
      throw new BadRequestException(
        'Portfolio name is required and must be a string',
      );
    }

    if (value.name.length < 1 || value.name.length > 100) {
      throw new BadRequestException(
        'Portfolio name must be between 1 and 100 characters',
      );
    }

    // Validate initial value if present
    if (value.initialValue !== undefined) {
      if (typeof value.initialValue !== 'number' || value.initialValue < 0) {
        throw new BadRequestException(
          'Initial value must be a non-negative number',
        );
      }
    }

    return value;
  }

  private validatePositionData(value: any): any {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Position data must be an object');
    }

    const requiredFields = ['ticker', 'quantity', 'price'];
    for (const field of requiredFields) {
      if (!(field in value)) {
        throw new BadRequestException(`Missing required field: ${field}`);
      }
    }

    // Validate ticker
    if (typeof value.ticker !== 'string' || value.ticker.length === 0) {
      throw new BadRequestException('Ticker must be a non-empty string');
    }

    // Validate quantity
    if (typeof value.quantity !== 'number' || value.quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive number');
    }

    // Validate price
    if (typeof value.price !== 'number' || value.price <= 0) {
      throw new BadRequestException('Price must be a positive number');
    }

    return value;
  }
}

@Injectable()
export class DateValidationPipe implements PipeTransform {
  private readonly logger = new Logger(DateValidationPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    if (
      metadata.type === 'query' &&
      (metadata.data === 'startDate' || metadata.data === 'endDate')
    ) {
      return this.validateDate(value, metadata.data);
    }

    return value;
  }

  private validateDate(value: string, fieldName: string): Date {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a valid date string`);
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        `${fieldName} must be a valid date format (YYYY-MM-DD)`,
      );
    }

    // Check if date is not in the future (for historical data)
    if (date > new Date()) {
      throw new BadRequestException(`${fieldName} cannot be in the future`);
    }

    return date;
  }
}
