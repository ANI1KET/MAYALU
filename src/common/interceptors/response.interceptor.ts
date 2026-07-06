import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T> | T> {
    return next.handle().pipe(
      map((data: T) => {
        // Don't double-wrap if already has success key
        if (data !== null && typeof data === 'object' && 'success' in (data as object)) {
          return data;
        }

        return {
          success: true as const,
          data,
        };
      }),
    );
  }
}
