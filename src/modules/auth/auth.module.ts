import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '../../common/services/jwt.service';
import { TokenService } from '../../common/services/token.service';
import { SmsService } from '../../common/services/sms.service';
import { CartService } from '../cart/cart.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtService, TokenService, SmsService, CartService],
  exports: [AuthService, JwtService, TokenService],
})
export class AuthModule {}
