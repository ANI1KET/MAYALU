import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getConfig } from '../../config/app.config';
import { JWT } from '../constants/index';

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  phone: string;
  type: 'access';
  familyId: string;
}

export interface SignOptions {
  sub: string;
  phone: string;
  type: 'access';
  familyId: string;
}

@Injectable()
export class JwtService {
  private readonly secret: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expiry: string;

  constructor() {
    const config = getConfig();

    if (config.JWT_SECRET.length < JWT.MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${JWT.MIN_SECRET_LENGTH} characters long`,
      );
    }

    this.secret = new TextEncoder().encode(config.JWT_SECRET);
    this.issuer = config.JWT_ISSUER;
    this.audience = config.JWT_AUDIENCE;
    this.expiry = config.JWT_ACCESS_EXPIRY;
  }

  async sign(payload: SignOptions): Promise<string> {
    return new SignJWT({ phone: payload.phone, type: payload.type, familyId: payload.familyId })
      .setProtectedHeader({ alg: JWT.ALGORITHM })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime(this.expiry)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new UnauthorizedException({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'Authentication token is required.',
      });
    }

    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [JWT.ALGORITHM],
      });

      if (payload['type'] !== 'access') {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN_TYPE',
          message: 'Token type is invalid.',
        });
      }

      if (!payload.sub || !payload['phone'] || !payload['familyId']) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN_PAYLOAD',
          message: 'Token payload is malformed.',
        });
      }

      return payload as AccessTokenPayload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;

      const message = err instanceof Error ? err.message : '';

      if (message.includes('expired')) {
        throw new UnauthorizedException({
          code: 'ACCESS_TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh your session.',
        });
      }

      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid or malformed token.',
      });
    }
  }
}
