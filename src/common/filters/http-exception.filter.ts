import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

interface FieldError {
  field: string;
  message: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errors?: FieldError[];
  };
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;

    if (exception instanceof ZodError) {
      const fieldErrors = exception.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      const body: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors: fieldErrors,
        },
        path,
        timestamp,
      };

      response.status(422).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let code = this.statusToCode(status);
      let message = exception.message;
      let errors: { field: string; message: string }[] | undefined;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;

        if (typeof resp['code'] === 'string') code = resp['code'];
        if (typeof resp['message'] === 'string') message = resp['message'];

        // Field-level errors from ValidationPipe exceptionFactory
        if (Array.isArray(resp['errors'])) {
          errors = resp['errors'] as { field: string; message: string }[];
        }

        // NestJS default ValidationPipe format: { message: string[], error: 'Bad Request' }
        if (!errors && Array.isArray(resp['message'])) {
          message = (resp['message'] as string[])[0] ?? message;
          errors = (resp['message'] as string[]).map((m) => ({ field: 'unknown', message: m }));
          code = 'VALIDATION_ERROR';
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }

      const body: ErrorResponse = {
        success: false,
        error: errors ? { code, message, errors } : { code, message },
        path,
        timestamp,
      };

      this.logger.warn(`${status} ${code} — ${message} [${path}]`);
      response.status(status).json(body);
      return;
    }

    // Unknown errors
    const err = exception as Error;
    this.logger.error(`Unhandled exception at ${path}: ${err?.message ?? 'Unknown'}`, err?.stack);

    const body: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
      path,
      timestamp,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private statusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[status] ?? 'HTTP_ERROR';
  }
}
