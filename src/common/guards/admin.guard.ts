import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getConfig } from '../../config/app.config';
import { ADMIN } from '../constants/index';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const adminKey = request.headers[ADMIN.HEADER_NAME];
    const config = getConfig();

    if (!adminKey || adminKey !== config.ADMIN_SECRET_KEY) {
      throw new UnauthorizedException({
        code: 'INVALID_ADMIN_KEY',
        message: 'Invalid or missing admin authentication key.',
      });
    }

    return true;
  }
}
