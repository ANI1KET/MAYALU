import { Injectable, BadRequestException, UnauthorizedException,
  ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import * as schema from '../../database/schema/index';
import { JwtService } from '../../common/services/jwt.service';
import { TokenService, type IssuePairMeta } from '../../common/services/token.service';
import { SmsService } from '../../common/services/sms.service';
import { hashOtp, verifyOtp, generateOtp } from '../../common/utils/hash.util';
import { getConfig } from '../../config/app.config';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly smsService: SmsService,
  ) {}

  async sendOtp(
    phone: string,
    purpose: 'login' | 'register',
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const config = getConfig();
    const cooldownSeconds = config.OTP_RESEND_COOLDOWN_SECONDS;
    const cooldownBoundary = new Date(Date.now() - cooldownSeconds * 1000);

    // Check for recent OTP (cooldown)
    const recentOtp = await this.authRepository.findRecentOtp(phone, purpose, cooldownBoundary);

    if (recentOtp) {
      const secondsRemaining = Math.ceil(
        (recentOtp.createdAt.getTime() + cooldownSeconds * 1000 - Date.now()) / 1000,
      );
      throw new BadRequestException({
        code: 'OTP_COOLDOWN',
        message: `Please wait ${secondsRemaining} seconds before requesting a new OTP.`,
        details: { secondsRemaining },
      });
    }

    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.authRepository.insertOtpToken({
      phone,
      codeHash,
      purpose,
      attempts: 0,
      expiresAt,
      ipAddress: ipAddress ?? null,
    });

    await this.smsService.sendOtp(phone, otp);

    this.logger.log(`OTP sent to ${phone.slice(0, 4)}**** for purpose: ${purpose}`);
    return { message: 'OTP sent successfully. Valid for 5 minutes.' };
  }

  async verifyOtpAndLogin(
    phone: string,
    otp: string,
    purpose: 'login' | 'register',
    meta: IssuePairMeta,
  ): Promise<
    | { purpose: 'login'; accessToken: string; rawRefreshToken: string; isNewUser: boolean; user: typeof schema.users.$inferSelect }
    | { purpose: 'register' }
  > {
    const config = getConfig();

    const record = await this.authRepository.findActiveOtp(phone, purpose);

    if (!record) {
      throw new UnauthorizedException({
        code: 'INVALID_OTP',
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    if (record.attempts >= config.OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        code: 'OTP_MAX_ATTEMPTS',
        message: `Maximum attempts exceeded. Please request a new OTP.`,
      });
    }

    const isValid = await verifyOtp(record.codeHash, otp);

    if (!isValid) {
      // Atomic increment — prevents race condition on concurrent requests
      await this.authRepository.incrementOtpAttempts(record.id);

      const remainingAttempts = config.OTP_MAX_ATTEMPTS - record.attempts - 1;
      throw new UnauthorizedException({
        code: 'INVALID_OTP',
        message: remainingAttempts > 0
          ? `Incorrect OTP. ${remainingAttempts} attempt(s) remaining.`
          : 'Incorrect OTP. Maximum attempts reached — please request a new OTP.',
      });
    }

    // Mark OTP as used
    await this.authRepository.markOtpUsed(record.id);

    if (purpose === 'register') {
      // Registration is completed via POST /auth/register (name/email required).
      // Only confirm phone ownership here — do not create the user or a session yet.
      const existing = await this.authRepository.findUserByPhone(phone);
      if (existing) {
        throw new ConflictException({
          code: 'PHONE_TAKEN',
          message: 'An account with this phone number already exists.',
        });
      }
      return { purpose: 'register' };
    }

    // Upsert user
    let user = await this.authRepository.findUserByPhone(phone);

    const isNewUser = !user;

    if (!user) {
      const created = await this.authRepository.createUser({
        phone,
        isPhoneVerified: true,
        status: 'active',
      });
      user = created!;
    } else {
      if (user.status === 'suspended') {
        throw new ForbiddenException({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact support.',
        });
      }
      if (user.status === 'deleted') {
        throw new ForbiddenException({
          code: 'ACCOUNT_DELETED',
          message: 'This account no longer exists.',
        });
      }

      await this.authRepository.markUserLoggedIn(user.id);
    }

    const tokenPair = await this.tokenService.issuePair(user.id, user.phone, meta);
    return { purpose: 'login', ...tokenPair, isNewUser, user };
  }

  async register(
    phone: string,
    fullName: string,
    email: string | undefined,
    meta: IssuePairMeta,
  ): Promise<{ accessToken: string; rawRefreshToken: string; user: typeof schema.users.$inferSelect }> {
    const existing = await this.authRepository.findUserByPhone(phone);

    if (existing) {
      throw new ConflictException({
        code: 'PHONE_TAKEN',
        message: 'An account with this phone number already exists.',
      });
    }

    // Check OTP was verified
    const usedOtp = await this.authRepository.findLatestOtpByPurpose(phone, 'register');

    if (!usedOtp?.usedAt) {
      throw new BadRequestException({
        code: 'PHONE_NOT_VERIFIED',
        message: 'Phone number must be verified before registration.',
      });
    }

    const user = await this.authRepository.createRegisteredUser({
      phone,
      fullName,
      email: email ?? null,
      isPhoneVerified: true,
      status: 'active',
    });

    if (!user) throw new BadRequestException({ code: 'REGISTRATION_FAILED', message: 'Registration failed. Please try again.' });

    const tokenPair = await this.tokenService.issuePair(user.id, user.phone, meta);
    return { ...tokenPair, user };
  }

  async logout(userId: string, familyId: string): Promise<void> {
    await this.tokenService.revokeFamily(familyId);
    this.logger.log(`User ${userId} logged out`);
  }

  async getMe(userId: string): Promise<typeof schema.users.$inferSelect> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return user;
  }
}
