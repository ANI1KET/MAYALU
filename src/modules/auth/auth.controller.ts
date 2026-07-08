import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  UseGuards,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiHeader, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TokenService } from '../../common/services/token.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public } from '../../common/decorators/index';
import { SendOtpDto, VerifyOtpDto, RegisterDto } from './dto/auth.dto';
import { getConfig } from '../../config/app.config';
import { COOKIE } from '../../common/constants/index';
import type { SafeUser } from '../../common/types/index';
import {
  OtpSentResponseDto,
  LoginResponseDto,
  RegisterResponseDto,
  MessageResponseDto,
  UserDto,
} from '../../common/swagger/response.dto';
import {
  ApiOkEnvelope,
  ApiCreatedEnvelope,
  ApiBadRequest,
  ApiUnauthorized,
  ApiForbidden,
  ApiConflict,
  ApiTooManyRequests,
  ApiInternalServerError,
  ApiStandardErrors,
} from '../../common/decorators/api-responses.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/send')
  @HttpCode(200)
  @ApiBody({ type: SendOtpDto })
  @ApiOperation({
    summary: 'Send OTP',
    description: 'Send a 6-digit OTP to a Nepal mobile number. Throttled to 5 requests/min. Cooldown of 60 s between resends.',
  })
  @ApiOkEnvelope(OtpSentResponseDto, 'OTP dispatched successfully')
  @ApiBadRequest('OTP_COOLDOWN — wait before requesting again')
  @ApiTooManyRequests()
  @ApiInternalServerError()
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress;
    return this.authService.sendOtp(dto.phone, dto.purpose, ip);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/verify')
  @HttpCode(200)
  @ApiBody({ type: VerifyOtpDto })
  @ApiOperation({
    summary: 'Verify OTP & Login',
    description:
      'Verify the 6-digit OTP and receive JWT cookies. ' +
      'Pass `X-Session-Id` header to auto-merge a guest cart on login. ' +
      'Sets `access_token` (15 min) and `refresh_token` (30 days) as HttpOnly cookies.',
  })
  @ApiHeader({ name: 'X-Session-Id', description: 'Guest cart session ID for merge on login', required: false })
  @ApiOkEnvelope(LoginResponseDto, 'Login successful — JWT cookies set')
  @ApiBadRequest()
  @ApiUnauthorized('INVALID_OTP — wrong code | OTP_MAX_ATTEMPTS — locked')
  @ApiForbidden('ACCOUNT_SUSPENDED')
  @ApiTooManyRequests()
  @ApiInternalServerError()
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const config = getConfig();
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.authService.verifyOtpAndLogin(dto.phone, dto.otp, dto.purpose, meta);
    this.tokenService.setTokenCookies(res, result.accessToken, result.rawRefreshToken, config.NODE_ENV === 'production');
    const sessionId = (req.headers as Record<string, string>)['x-session-id'] ?? (req.query as Record<string, string>)['sessionId'];
    void this.authService.mergeGuestCartIfPresent(result.user.id, sessionId);
    return { isNewUser: result.isNewUser, user: this.sanitizeUser(result.user) };
  }

  @Public()
  @Post('register')
  @HttpCode(201)
  @ApiBody({ type: RegisterDto })
  @ApiOperation({
    summary: 'Complete registration',
    description: 'Register name & email after phone has been OTP-verified. Sets JWT cookies.',
  })
  @ApiCreatedEnvelope(RegisterResponseDto, 'User registered and logged in')
  @ApiBadRequest('PHONE_NOT_VERIFIED — send and verify OTP first')
  @ApiConflict('PHONE_TAKEN — account already exists')
  @ApiTooManyRequests()
  @ApiInternalServerError()
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const config = getConfig();
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.authService.register(dto.phone, dto.fullName, dto.email, meta);
    this.tokenService.setTokenCookies(res, result.accessToken, result.rawRefreshToken, config.NODE_ENV === 'production');
    return { user: this.sanitizeUser(result.user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Exchange the `refresh_token` cookie for a new token pair. ' +
      'The old token is invalidated. Token reuse triggers family-wide revocation.',
  })
  @ApiOkEnvelope(MessageResponseDto, 'New JWT cookies set')
  @ApiUnauthorized('MISSING_REFRESH_TOKEN | INVALID_REFRESH_TOKEN | REFRESH_TOKEN_EXPIRED')
  @ApiForbidden('REFRESH_TOKEN_REUSE_DETECTED — all sessions revoked')
  @ApiTooManyRequests()
  @ApiInternalServerError()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const config = getConfig();
    const rawToken = (req.cookies as Record<string, string> | undefined)?.[COOKIE.REFRESH_TOKEN_NAME];
    if (!rawToken) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token found. Please log in again.' });
    }
    const result = await this.tokenService.rotate(rawToken, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.tokenService.setTokenCookies(res, result.accessToken, result.rawRefreshToken, config.NODE_ENV === 'production');
    return { message: 'Session refreshed successfully.' };
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Logout', description: 'Revoke the refresh token and clear both JWT cookies.' })
  @ApiOkEnvelope(MessageResponseDto, 'Logged out — cookies cleared')
  @ApiStandardErrors()
  async logout(
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const config = getConfig();
    const rawToken = (req.cookies as Record<string, string> | undefined)?.[COOKIE.REFRESH_TOKEN_NAME];
    await this.authService.logout(user.sub, rawToken);
    this.tokenService.clearTokenCookies(res, config.NODE_ENV === 'production');
    return { message: 'Logged out successfully.' };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get current user', description: 'Return the authenticated user profile.' })
  @ApiOkEnvelope(UserDto, 'Authenticated user profile')
  @ApiStandardErrors()
  async me(@CurrentUser() user: { sub: string }) {
    const result = await this.authService.getMe(user.sub);
    return this.sanitizeUser(result);
  }

  private sanitizeUser(user: typeof import('../../database/schema/index').users.$inferSelect): SafeUser {
    return {
      id: user['id'] as string,
      phone: user['phone'] as string,
      email: (user['email'] as string | null) ?? null,
      fullName: (user['fullName'] as string | null) ?? null,
      avatarUrl: (user['avatarUrl'] as string | null) ?? null,
      status: user['status'] as string,
      isPhoneVerified: user['isPhoneVerified'] as boolean,
      isEmailVerified: user['isEmailVerified'] as boolean,
      lastLoginAt: (user['lastLoginAt'] as Date | null) ?? null,
      createdAt: user['createdAt'] as Date,
      updatedAt: user['updatedAt'] as Date,
    };
  }
}
