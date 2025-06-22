import { applyDecorators, Type } from '@nestjs/common';

export interface ApiResponseOptions {
  status?: number;
  description?: string;
  type?: Type<any>;
  isArray?: boolean;
  example?: any;
}

export const ApiSuccessResponse = (options: ApiResponseOptions = {}) => {
  const {
    status = 200,
    description = 'Success',
    type,
    isArray = false,
    example,
  } = options;

  // Simple decorator without Swagger dependencies
  return applyDecorators();
};

export const ApiErrorResponse = (
  status: number,
  description: string,
  example?: any,
) => {
  // Simple decorator without Swagger dependencies
  return applyDecorators();
};

export const ApiValidationErrorResponse = () => {
  return ApiErrorResponse(400, 'Validation Error', {
    statusCode: 400,
    message: 'Validation failed',
    error: 'Bad Request',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/stocks',
    requestId: 'req_1234567890_abc123',
  });
};

export const ApiUnauthorizedResponse = () => {
  return ApiErrorResponse(401, 'Unauthorized', {
    statusCode: 401,
    message: 'API key is required',
    error: 'Unauthorized',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/stocks',
    requestId: 'req_1234567890_abc123',
  });
};

export const ApiForbiddenResponse = () => {
  return ApiErrorResponse(403, 'Forbidden', {
    statusCode: 403,
    message: 'Access denied',
    error: 'Forbidden',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/admin',
    requestId: 'req_1234567890_abc123',
  });
};

export const ApiNotFoundResponse = () => {
  return ApiErrorResponse(404, 'Not Found', {
    statusCode: 404,
    message: 'Resource not found',
    error: 'Not Found',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/stocks/AAPL',
    requestId: 'req_1234567890_abc123',
  });
};

export const ApiRateLimitResponse = () => {
  return ApiErrorResponse(429, 'Rate Limit Exceeded', {
    statusCode: 429,
    message: 'Too many requests',
    error: 'Too Many Requests',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/stocks',
    requestId: 'req_1234567890_abc123',
  });
};

export const ApiInternalServerErrorResponse = () => {
  return ApiErrorResponse(500, 'Internal Server Error', {
    statusCode: 500,
    message: 'An unexpected error occurred',
    error: 'Internal Server Error',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/stocks',
    requestId: 'req_1234567890_abc123',
  });
};

// Common response patterns
export const ApiStockResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({
      type,
      description: 'Stock data retrieved successfully',
    }),
    ApiNotFoundResponse(),
    ApiInternalServerErrorResponse(),
  );
};

export const ApiStockListResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({
      type,
      isArray: true,
      description: 'List of stocks retrieved successfully',
    }),
    ApiInternalServerErrorResponse(),
  );
};

export const ApiPortfolioResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({
      type,
      description: 'Portfolio data retrieved successfully',
    }),
    ApiNotFoundResponse(),
    ApiInternalServerErrorResponse(),
  );
};

export const ApiPredictionResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({
      type,
      description: 'Prediction generated successfully',
    }),
    ApiNotFoundResponse(),
    ApiInternalServerErrorResponse(),
  );
};

export const ApiHealthResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({ type, description: 'Health check completed' }),
    ApiInternalServerErrorResponse(),
  );
};

// Standard CRUD responses
export const ApiCreateResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({
      status: 201,
      type,
      description: 'Resource created successfully',
    }),
    ApiValidationErrorResponse(),
    ApiInternalServerErrorResponse(),
  );
};

export const ApiUpdateResponse = (type: Type<any>) => {
  return applyDecorators(
    ApiSuccessResponse({ type, description: 'Resource updated successfully' }),
    ApiValidationErrorResponse(),
    ApiNotFoundResponse(),
    ApiInternalServerErrorResponse(),
  );
};

export const ApiDeleteResponse = () => {
  return applyDecorators(
    ApiSuccessResponse({
      status: 204,
      description: 'Resource deleted successfully',
    }),
    ApiNotFoundResponse(),
    ApiInternalServerErrorResponse(),
  );
};
