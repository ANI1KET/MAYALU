import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Logs every inbound HTTP request with method, path, status, and duration.
 * Registered globally in AppModule.configure() so every route is covered.
 *
 * Example terminal output:
 *   [HTTP] POST   /api/v1/auth/otp/send   → 200  (45ms)
 *   [HTTP] GET    /api/v1/auth/me         → 401  (3ms)
 *   [HTTP] POST   /api/v1/cart/items      → 400  (12ms)
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') ?? '-';
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const ms = Date.now() - start;

      // Colour-code by status bracket
      const c =
        statusCode >= 500 ? '\x1b[31m' :  // red   — server error
        statusCode >= 400 ? '\x1b[33m' :  // yellow — client error
        statusCode >= 300 ? '\x1b[36m' :  // cyan  — redirect
        '\x1b[32m';                        // green — success
      const r = '\x1b[0m';

      this.logger.log(
        `${method.padEnd(7)} ${originalUrl.padEnd(45)} ${c}${statusCode}${r}  ${ms}ms`,
      );
    });

    next();
  }
}
