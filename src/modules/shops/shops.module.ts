import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [ShopsController],
  providers: [ShopsService, JwtService],
  exports: [ShopsService],
})
export class ShopsModule {}
