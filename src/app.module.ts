import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ShopsModule } from './modules/shops/shops.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { BannersModule } from './modules/banners/banners.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RATE_LIMIT } from './common/constants/index';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'global', ttl: RATE_LIMIT.GLOBAL_TTL_MS, limit: RATE_LIMIT.GLOBAL_MAX },
    ]),
    DatabaseModule,
    AuthModule,
    ShopsModule,
    CategoriesModule,
    AttributesModule,
    ProductsModule,
    InventoryModule,
    DeliveryModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    CouponsModule,
    ReviewsModule,
    BannersModule,
    NotificationsModule,
    UsersModule,
    AdminModule,
    NavigationModule,
  ],
  providers: [
    { provide: APP_FILTER,       useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR,  useClass: ResponseInterceptor },
    { provide: APP_GUARD,        useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
