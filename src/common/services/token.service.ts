import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Response } from 'express';
import * as crypto from 'crypto';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { JwtService } from './jwt.service';
import { generateRawRefreshToken, sha256 } from '../utils/hash.util';
import { getConfig } from '../../config/app.config';
import { COOKIE } from '../constants/index';

export interface IssuePairMeta {
  ip?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
}

export interface TokenPair {
  accessToken: string;
  rawRefreshToken: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  async issuePair(
    userId: string,
    phone: string,
    meta: IssuePairMeta,
    existingFamilyId?: string,
  ): Promise<TokenPair> {
    const config = getConfig();
    const familyId = existingFamilyId ?? crypto.randomUUID();
    const accessToken = await this.jwtService.sign({ sub: userId, phone, type: 'access', familyId });

    const rawRefreshToken = generateRawRefreshToken();
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + config.JWT_REFRESH_EXPIRE_DAYS * 24 * 60 * 60 * 1_000,
    );

    await this.db.insert(schema.refreshTokens).values({
      familyId,
      userId,
      tokenHash,
      isUsed: false,
      deviceInfo: meta.deviceInfo ?? {},
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt,
    });

    return { accessToken, rawRefreshToken };
  }

  async rotate(rawRefreshToken: string, meta: IssuePairMeta): Promise<TokenPair> {
    const tokenHash = sha256(rawRefreshToken);

    const token = await this.db.query.refreshTokens.findFirst({
      where: eq(schema.refreshTokens.tokenHash, tokenHash),
    });

    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token not found or already used.',
      });
    }

    if (token.revokedAt) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'This session has been revoked. Please log in again.',
      });
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Session expired. Please log in again.',
      });
    }

    if (token.isUsed) {
      // ⚠️ Theft detection: used token presented → revoke entire family
      this.logger.warn(
        `Refresh token reuse detected. Revoking family ${token.familyId} for user ${token.userId}`,
      );
      await this.revokeFamily(token.familyId);

      throw new ForbiddenException({
        code: 'REFRESH_TOKEN_REUSE_DETECTED',
        message: 'Security alert: token reuse detected. All sessions revoked. Please log in again.',
      });
    }

    // Mark old token as consumed atomically
    await this.db
      .update(schema.refreshTokens)
      .set({ isUsed: true })
      .where(eq(schema.refreshTokens.id, token.id));

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, token.userId),
    });

    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User account not found.' });
    }

    return this.issuePair(token.userId, user.phone, meta, token.familyId);
  }

  async revoke(tokenId: string): Promise<void> {
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, tokenId));
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.familyId, familyId));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)),
      );
  }

  async sweepExpired(): Promise<number> {
    const result = await this.db.execute<{ count: string }>(
      sql`WITH deleted AS (
            DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING 1
          )
          SELECT COUNT(*)::text AS count FROM deleted`,
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  setTokenCookies(res: Response, accessToken: string, rawRefreshToken: string, isProd: boolean): void {
    const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const };

    res.cookie(COOKIE.ACCESS_TOKEN_NAME, accessToken, {
      ...base,
      path: '/',
      maxAge: COOKIE.ACCESS_MAX_AGE_SECONDS * 1_000,
    });

    res.cookie(COOKIE.REFRESH_TOKEN_NAME, rawRefreshToken, {
      ...base,
      path: COOKIE.REFRESH_TOKEN_PATH,
      maxAge: COOKIE.REFRESH_MAX_AGE_SECONDS * 1_000,
    });
  }

  clearTokenCookies(res: Response, isProd: boolean): void {
    const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const };
    res.clearCookie(COOKIE.ACCESS_TOKEN_NAME, { ...base, path: '/' });
    res.clearCookie(COOKIE.REFRESH_TOKEN_NAME, { ...base, path: COOKIE.REFRESH_TOKEN_PATH });
  }
}
