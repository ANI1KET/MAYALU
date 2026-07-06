import {
  Injectable, Inject, NotFoundException, BadRequestException,
  Module, Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiSecurity, ApiBody, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse,
  ApiUnauthorizedResponse, ApiNotFoundResponse,
  ApiProperty, ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  AdminDashboardDto, OrderListResponseDto, OrderDto, ShopDto,
  BannerDto, ReviewDto, MessageResponseDto, ErrorResponseDto,
} from '../../common/swagger/response.dto';
import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsUUID, Min, Max } from 'class-validator';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AdminGuard } from '../../common/guards/admin.guard';
import { SmsService } from '../../common/services/sms.service';
import { MediaService } from '../../common/services/media.service';
import { parsePagination, buildPaginatedResult } from '../../common/utils/pagination.util';

class UpdateOrderStatusDto {
  @IsEnum(['confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'])
  status!: 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() paymentReference?: string;
}

class CreateCouponDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Null = platform-wide coupon' })
  @IsOptional() @IsString() shopId?: string;

  @ApiProperty({ example: 'DASHAIN30', description: 'Uppercase alphanumeric, max 20 chars' })
  @IsString() code!: string;

  @ApiPropertyOptional({ example: '30% off for Dashain festival' })
  @IsOptional() @IsString() description?: string;

  @ApiProperty({ enum: ['percentage', 'fixed'], example: 'percentage' })
  @IsEnum(['percentage', 'fixed']) discountType!: 'percentage' | 'fixed';

  @ApiProperty({ example: 30, description: 'Percentage (0-100) or fixed NPR amount' })
  @IsNumber() @Min(0) discountValue!: number;

  @ApiPropertyOptional({ example: 500, description: 'Minimum order subtotal in NPR' })
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Max discount cap in NPR (for percentage discounts)' })
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;

  @ApiPropertyOptional({ example: 100, description: 'Total uses across all users. Null = unlimited.' })
  @IsOptional() @IsNumber() @Min(1) usageLimitTotal?: number;

  @ApiPropertyOptional({ example: 1, description: 'Max uses per user. Null = unlimited.' })
  @IsOptional() @IsNumber() @Min(1) usageLimitPerUser?: number;

  @ApiPropertyOptional({ example: '2025-10-01T00:00:00.000Z' })
  @IsOptional() startsAt?: string;

  @ApiPropertyOptional({ example: '2025-10-15T23:59:59.000Z' })
  @IsOptional() expiresAt?: string;
}

class CreateBannerDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Null = platform banner' })
  @IsOptional() @IsString() shopId?: string;

  @ApiProperty({ example: 'Dashain Mega Sale — Up to 50% Off' })
  @IsString() title!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/my-cloud/image/upload/v1/mayalu-wears/banners/dashain.jpg' })
  @IsString() imageUrl!: string;

  @ApiProperty({ example: 'mayalu-wears/banners/dashain', description: 'Cloudinary public_id for deletion' })
  @IsString() publicId!: string;

  @ApiPropertyOptional({ example: '/browse?tag=dashain-sale', description: 'Click destination URL' })
  @IsOptional() @IsString() linkUrl?: string;

  @ApiProperty({ enum: ['hero', 'category', 'promo'], example: 'hero', description: 'hero=homepage full-width, category=sidebar, promo=small banner' })
  @IsEnum(['hero', 'category', 'promo']) position!: 'hero' | 'category' | 'promo';

  @ApiPropertyOptional({ example: 0, description: 'Lower number = higher priority' })
  @IsOptional() @IsNumber() @Min(0) sortOrder?: number;
}

class UpdateShopStatusDto {
  @ApiProperty({ enum: ['pending','active','suspended','closed'], example: 'active', description: 'active = visible to buyers, suspended = hidden' })
  @IsEnum(['pending', 'active', 'suspended', 'closed']) status!: 'pending' | 'active' | 'suspended' | 'closed';

  @ApiPropertyOptional({ enum: ['unverified','in_review','verified','rejected'], example: 'verified' })
  @IsOptional() @IsEnum(['unverified', 'in_review', 'verified', 'rejected'])
  verificationStatus?: 'unverified' | 'in_review' | 'verified' | 'rejected';
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
    private readonly smsService: SmsService,
  ) {}

  // ─── Dashboard ─────────────────────────────────────────────────
  async getDashboard() {
    // Use pg_stat_user_tables for approximate counts (O(1)) on large tables.
    // Exact counts via COUNT(*) require full table scans on Postgres.
    // Pending orders need exact count (small subset) — always exact.
    const [approxStats, pendingOrders, totalRevenue] = await Promise.all([
      this.db.execute<{ tablename: string; n_live_tup: string }>(
        sql`SELECT relname AS tablename, n_live_tup
            FROM pg_stat_user_tables
            WHERE relname IN ('users', 'shops', 'orders', 'products')`,
      ),
      this.db.execute<{ count: string }>(
        sql`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`,
      ),
      this.db.execute<{ total: string }>(
        sql`SELECT COALESCE(SUM(total_amount), 0)::text AS total
            FROM orders WHERE payment_status = 'paid'`,
      ),
    ]);

    const statMap = Object.fromEntries(
      approxStats.rows.map((r) => [r.tablename, parseInt(r.n_live_tup, 10)]),
    );

    return {
      totalUsers:          statMap['users']    ?? 0,
      totalShops:          statMap['shops']    ?? 0,
      totalOrders:         statMap['orders']   ?? 0,
      totalActiveProducts: statMap['products'] ?? 0,
      pendingOrders:       parseInt(pendingOrders.rows[0]?.count ?? '0', 10),
      totalRevenuePaid:    parseFloat(totalRevenue.rows[0]?.total ?? '0'),
      note: 'User/shop/order/product counts are approximate (pg_stat_user_tables). Pending orders is exact.',
    };
  }

  // ─── Orders ────────────────────────────────────────────────────
  async getOrders(page = 1, limit = 20, status?: string) {
    const { offset } = parsePagination({ page, limit });
    const where = status
      ? eq(schema.orders.status, status as typeof schema.orders.$inferSelect['status'])
      : undefined;

    const [orders, totalResult] = await Promise.all([
      this.db.query.orders.findMany({
        where,
        orderBy: desc(schema.orders.createdAt),
        limit,
        offset,
        with: { items: true, user: { columns: { phone: true, fullName: true } } } as never,
      }),
      this.db.execute<{ count: string }>(
        status
          ? sql`SELECT COUNT(*) as count FROM orders WHERE status = ${status}`
          : sql`SELECT COUNT(*) as count FROM orders`,
      ),
    ]);

    return buildPaginatedResult(orders, parseInt(totalResult.rows[0]?.count ?? '0', 10), page, limit);
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto, adminUserId?: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: { user: true } as never,
    });

    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    const now = new Date();
    const timestamps: Record<string, Date | undefined> = {
      confirmed: dto.status === 'confirmed' ? now : undefined,
      packed: dto.status === 'packed' ? now : undefined,
      shipped: dto.status === 'shipped' ? now : undefined,
      delivered: dto.status === 'delivered' ? now : undefined,
      cancelled: dto.status === 'cancelled' ? now : undefined,
    };

    await this.db.update(schema.orders)
      .set({
        status: dto.status,
        paymentReference: dto.paymentReference ?? order.paymentReference,
        confirmedAt: timestamps['confirmed'] ?? order.confirmedAt,
        packedAt: timestamps['packed'] ?? order.packedAt,
        shippedAt: timestamps['shipped'] ?? order.shippedAt,
        deliveredAt: timestamps['delivered'] ?? order.deliveredAt,
        cancelledAt: timestamps['cancelled'] ?? order.cancelledAt,
        updatedAt: now,
      })
      .where(eq(schema.orders.id, orderId));

    await this.db.insert(schema.orderStatusHistory).values({
      orderId,
      fromStatus: order.status,
      toStatus: dto.status,
      note: dto.note ?? null,
      changedByUserId: adminUserId ?? null,
      changedAt: now,
    });

    const orderWithUser = order as typeof order & { user: typeof schema.users.$inferSelect };

    // SMS notifications
    if (dto.status === 'shipped' && orderWithUser.user?.phone) {
      void this.smsService.sendShippingUpdate(orderWithUser.user.phone, order.orderNumber).catch(() => {});
    }

    return { updated: true, status: dto.status };
  }

  // ─── Shops ─────────────────────────────────────────────────────
  async getShops(page = 1, limit = 20) {
    const { offset } = parsePagination({ page, limit });
    const [shops, totalResult] = await Promise.all([
      this.db.query.shops.findMany({
        limit, offset,
        orderBy: desc(schema.shops.createdAt),
        with: { owner: { columns: { phone: true, fullName: true } }, subscription: true } as never,
      }),
      this.db.execute<{ count: string }>(sql`SELECT COUNT(*) as count FROM shops`),
    ]);
    return buildPaginatedResult(shops, parseInt(totalResult.rows[0]?.count ?? '0', 10), page, limit);
  }

  async updateShopStatus(shopId: string, dto: UpdateShopStatusDto) {
    const [updated] = await this.db.update(schema.shops)
      .set({ status: dto.status, verificationStatus: dto.verificationStatus, updatedAt: new Date() })
      .where(eq(schema.shops.id, shopId))
      .returning();
    if (!updated) throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    return updated;
  }

  // ─── Coupons ───────────────────────────────────────────────────
  async createCoupon(dto: CreateCouponDto) {
    const [coupon] = await this.db.insert(schema.coupons).values({
      ...dto,
      code: dto.code.toUpperCase(),
      discountValue: String(dto.discountValue),
      minOrderAmount: dto.minOrderAmount ? String(dto.minOrderAmount) : null,
      maxDiscount: dto.maxDiscount ? String(dto.maxDiscount) : null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
      usageCount: 0,
    }).returning();
    return coupon;
  }

  async toggleCoupon(couponId: string) {
    const coupon = await this.db.query.coupons.findFirst({ where: eq(schema.coupons.id, couponId) });
    if (!coupon) throw new NotFoundException({ code: 'COUPON_NOT_FOUND', message: 'Coupon not found' });

    const [updated] = await this.db.update(schema.coupons)
      .set({ isActive: !coupon.isActive, updatedAt: new Date() })
      .where(eq(schema.coupons.id, couponId))
      .returning();
    return updated;
  }

  // ─── Banners ───────────────────────────────────────────────────
  async createBanner(dto: CreateBannerDto) {
    const [banner] = await this.db.insert(schema.banners).values({
      ...dto, isActive: true, sortOrder: dto.sortOrder ?? 0,
    }).returning();
    return banner;
  }

  async toggleBanner(bannerId: string) {
    const banner = await this.db.query.banners.findFirst({ where: eq(schema.banners.id, bannerId) });
    if (!banner) throw new NotFoundException({ code: 'BANNER_NOT_FOUND', message: 'Banner not found' });

    const [updated] = await this.db.update(schema.banners)
      .set({ isActive: !banner.isActive, updatedAt: new Date() })
      .where(eq(schema.banners.id, bannerId))
      .returning();
    return updated;
  }

  // ─── Reviews ───────────────────────────────────────────────────
  async approveReview(reviewId: string) {
    const review = await this.db.query.reviews.findFirst({ where: eq(schema.reviews.id, reviewId) });
    if (!review) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });

    await this.db.update(schema.reviews)
      .set({ status: 'approved' })
      .where(eq(schema.reviews.id, reviewId));

    // Update product rating
    await this.db.execute(
      sql`UPDATE products SET
          avg_rating = (SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = ${review.productId} AND status = 'approved'),
          total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = ${review.productId} AND status = 'approved')
          WHERE id = ${review.productId}`,
    );

    return { approved: true };
  }

  async getPendingReviews(page = 1, limit = 20) {
    const { offset } = parsePagination({ page, limit });
    return this.db.query.reviews.findMany({
      where: eq(schema.reviews.status, 'pending'),
      limit, offset,
      orderBy: desc(schema.reviews.createdAt),
      with: { user: { columns: { fullName: true, phone: true } } } as never,
    });
  }
}

@ApiTags('Admin')
@UseGuards(AdminGuard)
@ApiSecurity('X-Admin-Key')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: '[Admin] Platform dashboard stats',
    description: 'Approximate counts via pg_stat_user_tables (O(1) — no full table scans). Pending orders is always exact.',
  })
  @ApiOkResponse({ type: AdminDashboardDto, description: 'Platform-wide metrics' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  getDashboard() { return this.adminService.getDashboard(); }

  @Get('orders')
  @ApiOperation({ summary: '[Admin] List all orders across all shops' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending','confirmed','packed','shipped','delivered','cancelled','returned'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: OrderListResponseDto, description: 'All orders paginated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  getOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) { return this.adminService.getOrders(page, limit, status); }

  @Patch('orders/:id/status')
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOperation({
    summary: '[Admin] Update order status',
    description: 'Appends to status history. Sends SMS confirmation when status changes to "shipped".',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiOkResponse({ type: OrderDto, description: 'Updated order' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ORDER_NOT_FOUND' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'INVALID_STATUS_TRANSITION' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrderStatus(id, dto);
  }

  @Get('shops')
  @ApiOperation({ summary: '[Admin] List all shops with plan and verification status' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending','active','suspended','rejected'] })
  @ApiOkResponse({ type: [ShopDto], description: 'Shops list' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  getShops(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getShops(page, limit);
  }

  @Patch('shops/:id/status')
  @ApiBody({ type: UpdateShopStatusDto })
  @ApiOperation({ summary: '[Admin] Approve, suspend or reject a shop' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkResponse({ type: ShopDto, description: 'Updated shop' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'SHOP_NOT_FOUND' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  updateShopStatus(@Param('id') id: string, @Body() dto: UpdateShopStatusDto) {
    return this.adminService.updateShopStatus(id, dto);
  }

  @Post('coupons')
  @ApiBody({ type: CreateCouponDto })
  @ApiOperation({ summary: '[Admin] Create platform-wide coupon' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { id: { type: 'string' }, code: { type: 'string' } } }, description: 'Coupon created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  createCoupon(@Body() dto: CreateCouponDto) { return this.adminService.createCoupon(dto); }

  @Patch('coupons/:id/toggle')
  @ApiOperation({ summary: '[Admin] Toggle coupon active/inactive' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Coupon state toggled' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  toggleCoupon(@Param('id') id: string) { return this.adminService.toggleCoupon(id); }

  @Post('banners')
  @ApiBody({ type: CreateBannerDto })
  @ApiOperation({ summary: '[Admin] Create banner' })
  @ApiCreatedResponse({ type: BannerDto, description: 'Banner created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  createBanner(@Body() dto: CreateBannerDto) { return this.adminService.createBanner(dto); }

  @Patch('banners/:id/toggle')
  @ApiOperation({ summary: '[Admin] Toggle banner active/inactive' })
  @ApiParam({ name: 'id', description: 'Banner UUID' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Banner state toggled' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  toggleBanner(@Param('id') id: string) { return this.adminService.toggleBanner(id); }

  @Get('reviews/pending')
  @ApiOperation({ summary: '[Admin] Get reviews pending moderation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiOkResponse({ type: [ReviewDto], description: 'Pending reviews' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  getPendingReviews(@Query('page') page?: number) {
    return this.adminService.getPendingReviews(page);
  }

  @Patch('reviews/:id/approve')
  @ApiOperation({
    summary: '[Admin] Approve review',
    description: 'Approves the review and atomically recalculates the product avgRating and totalReviews.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiOkResponse({ type: ReviewDto, description: 'Approved review' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'REVIEW_NOT_FOUND' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_ADMIN_KEY' })
  approveReview(@Param('id') id: string) { return this.adminService.approveReview(id); }
}

@Module({
  controllers: [AdminController],
  providers: [AdminService, SmsService, MediaService],
})
export class AdminModule {}
