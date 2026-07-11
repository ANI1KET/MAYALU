import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { ShopsRepository } from './shops.repository';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [ShopsController],
  providers: [ShopsService, ShopsRepository, JwtService],
  exports: [ShopsService],
})
export class ShopsModule {}
