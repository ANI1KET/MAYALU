import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [CartController],
  providers: [CartService, CartRepository, JwtService],
  exports: [CartService],
})
export class CartModule {}
