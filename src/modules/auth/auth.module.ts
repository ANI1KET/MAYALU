import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '../../common/services/jwt.service';
import { TokenService } from '../../common/services/token.service';
import { SmsService } from '../../common/services/sms.service';
import { AuthRepository } from './auth.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtService, TokenService, SmsService],
  exports: [AuthService, JwtService, TokenService],
})
export class AuthModule {}
