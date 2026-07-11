import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { SmsService } from '../../common/services/sms.service';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, SmsService, JwtService],
  exports: [OrdersService],
})
export class OrdersModule {}
