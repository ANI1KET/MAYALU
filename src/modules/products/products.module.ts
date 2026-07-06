import { Module } from '@nestjs/common';
import { ProductsController, CmsProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PlanGateService } from '../../common/services/plan-gate.service';
import { MediaService } from '../../common/services/media.service';
import { CategoriesModule } from '../categories/categories.module';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  imports: [CategoriesModule],
  controllers: [ProductsController, CmsProductsController],
  providers: [ProductsService, PlanGateService, MediaService, JwtService],
  exports: [ProductsService],
})
export class ProductsModule {}
