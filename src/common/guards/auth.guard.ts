import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtService } from '../services/jwt.service';
import { IS_PUBLIC_KEY, type RequestWithUser } from '../decorators/index';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'Authentication required. Please log in.',
      });
    }

    const payload = await this.jwtService.verify(token);
    request.user = payload;

    return true;
  }

  private extractToken(request: Request): string | null {
    // Primary: HttpOnly cookie
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.['access_token'];
    if (cookieToken) return cookieToken;

    // Fallback: Authorization header (for API clients / Swagger)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
