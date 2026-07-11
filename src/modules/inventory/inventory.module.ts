import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository, JwtService],
  exports: [InventoryService],
})
export class InventoryModule {}
