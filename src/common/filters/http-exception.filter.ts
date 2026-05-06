import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // 👈 Catch everything, not just HttpException
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine status: check if it's a Nest exception, otherwise default to 500
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract the message carefully
    let errorMessage: string | string[];
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      errorMessage = (res as any).message || exception.message;
    } else {
      // For non-HTTP errors (like Prisma), use the error message
      errorMessage = exception.message || 'Internal server error';
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${
        Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage
      }`,
    );

    response.status(status).json({
      success: false, // Matches your TransformInterceptor
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
      data: null, // Keep structure consistent with your Interceptor
    });
  }
}