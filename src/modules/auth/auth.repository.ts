import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gt, isNull, desc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findRecentOtp(phone: string, purpose: 'login' | 'register', cooldownBoundary: Date) {
    return this.db.query.otpTokens.findFirst({
      where: and(
        eq(schema.otpTokens.phone, phone),
        eq(schema.otpTokens.purpose, purpose),
        gt(schema.otpTokens.createdAt, cooldownBoundary),
        isNull(schema.otpTokens.usedAt),
      ),
      orderBy: desc(schema.otpTokens.createdAt),
    });
  }

  insertOtpToken(values: {
    phone: string;
    codeHash: string;
    purpose: 'login' | 'register';
    attempts: number;
    expiresAt: Date;
    ipAddress: string | null;
  }) {
    return this.db.insert(schema.otpTokens).values(values);
  }

  findActiveOtp(phone: string, purpose: 'login' | 'register') {
    return this.db.query.otpTokens.findFirst({
      where: and(
        eq(schema.otpTokens.phone, phone),
        eq(schema.otpTokens.purpose, purpose),
        gt(schema.otpTokens.expiresAt, new Date()),
        isNull(schema.otpTokens.usedAt),
      ),
      orderBy: desc(schema.otpTokens.createdAt),
    });
  }

  incrementOtpAttempts(otpId: string) {
    return this.db
      .update(schema.otpTokens)
      .set({ attempts: sql`attempts + 1` })
      .where(eq(schema.otpTokens.id, otpId));
  }

  markOtpUsed(otpId: string) {
    return this.db
      .update(schema.otpTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.otpTokens.id, otpId));
  }

  findUserByPhone(phone: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.phone, phone),
    });
  }

  findUserById(userId: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
  }

  async createUser(values: {
    phone: string;
    isPhoneVerified: boolean;
    status: 'active';
  }) {
    const [created] = await this.db.insert(schema.users).values(values).returning();
    return created;
  }

  markUserLoggedIn(userId: string) {
    return this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date(), isPhoneVerified: true })
      .where(eq(schema.users.id, userId));
  }

  findLatestOtpByPurpose(phone: string, purpose: 'login' | 'register') {
    return this.db.query.otpTokens.findFirst({
      where: and(
        eq(schema.otpTokens.phone, phone),
        eq(schema.otpTokens.purpose, purpose),
      ),
      orderBy: desc(schema.otpTokens.createdAt),
    });
  }

  async createRegisteredUser(values: {
    phone: string;
    fullName: string;
    email: string | null;
    isPhoneVerified: boolean;
    status: 'active';
  }) {
    const [user] = await this.db.insert(schema.users).values(values).returning();
    return user;
  }
}
