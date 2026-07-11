import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import type { CreateCouponDto, CreateBannerDto, UpdateOrderStatusDto, UpdateShopStatusDto } from './dto/admin.dto';

@Injectable()
export class AdminRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ─── Dashboard ─────────────────────────────────────────────────
  getApproxTableStats() {
    return this.db.execute<{ tablename: string; n_live_tup: string }>(
      sql`SELECT relname AS tablename, n_live_tup
          FROM pg_stat_user_tables
          WHERE relname IN ('users', 'shops', 'orders', 'products')`,
    );
  }

  getPendingOrdersCount() {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`,
    );
  }

  getTotalRevenuePaid() {
    return this.db.execute<{ total: string }>(
      sql`SELECT COALESCE(SUM(total_amount), 0)::text AS total
          FROM orders WHERE payment_status = 'paid'`,
    );
  }

  // ─── Orders ────────────────────────────────────────────────────
  findOrders(where: ReturnType<typeof eq> | undefined, limit: number, offset: number) {
    return this.db.query.orders.findMany({
      where,
      orderBy: desc(schema.orders.createdAt),
      limit,
      offset,
      with: { items: true, user: { columns: { phone: true, fullName: true } } } as never,
    });
  }

  countOrders(status?: string) {
    return this.db.execute<{ count: string }>(
      status
        ? sql`SELECT COUNT(*) as count FROM orders WHERE status = ${status}`
        : sql`SELECT COUNT(*) as count FROM orders`,
    );
  }

  findOrderWithUser(orderId: string) {
    return this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: { user: true } as never,
    });
  }

  updateOrder(orderId: string, values: Partial<typeof schema.orders.$inferInsert>) {
    return this.db.update(schema.orders)
      .set(values)
      .where(eq(schema.orders.id, orderId));
  }

  insertOrderStatusHistory(values: typeof schema.orderStatusHistory.$inferInsert) {
    return this.db.insert(schema.orderStatusHistory).values(values);
  }

  // ─── Shops ─────────────────────────────────────────────────────
  findShops(limit: number, offset: number) {
    return this.db.query.shops.findMany({
      limit, offset,
      orderBy: desc(schema.shops.createdAt),
      with: { owner: { columns: { phone: true, fullName: true } }, subscription: true } as never,
    });
  }

  countShops() {
    return this.db.execute<{ count: string }>(sql`SELECT COUNT(*) as count FROM shops`);
  }

  async updateShopStatus(shopId: string, dto: UpdateShopStatusDto) {
    const [updated] = await this.db.update(schema.shops)
      .set({ status: dto.status, verificationStatus: dto.verificationStatus, updatedAt: new Date() })
      .where(eq(schema.shops.id, shopId))
      .returning();
    return updated;
  }

  // ─── Coupons ───────────────────────────────────────────────────
  async createCoupon(values: typeof schema.coupons.$inferInsert) {
    const [coupon] = await this.db.insert(schema.coupons).values(values).returning();
    return coupon;
  }

  findCouponById(couponId: string) {
    return this.db.query.coupons.findFirst({ where: eq(schema.coupons.id, couponId) });
  }

  async updateCoupon(couponId: string, values: Partial<typeof schema.coupons.$inferInsert>) {
    const [updated] = await this.db.update(schema.coupons)
      .set(values)
      .where(eq(schema.coupons.id, couponId))
      .returning();
    return updated;
  }

  // ─── Banners ───────────────────────────────────────────────────
  async createBanner(values: typeof schema.banners.$inferInsert) {
    const [banner] = await this.db.insert(schema.banners).values(values).returning();
    return banner;
  }

  findBannerById(bannerId: string) {
    return this.db.query.banners.findFirst({ where: eq(schema.banners.id, bannerId) });
  }

  async updateBanner(bannerId: string, values: Partial<typeof schema.banners.$inferInsert>) {
    const [updated] = await this.db.update(schema.banners)
      .set(values)
      .where(eq(schema.banners.id, bannerId))
      .returning();
    return updated;
  }

  // ─── Reviews ───────────────────────────────────────────────────
  findReviewById(reviewId: string) {
    return this.db.query.reviews.findFirst({ where: eq(schema.reviews.id, reviewId) });
  }

  updateReviewStatus(reviewId: string, status: 'approved') {
    return this.db.update(schema.reviews)
      .set({ status })
      .where(eq(schema.reviews.id, reviewId));
  }

  recalculateProductRating(productId: string) {
    return this.db.execute(
      sql`UPDATE products SET
          avg_rating = (SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = ${productId} AND status = 'approved'),
          total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = ${productId} AND status = 'approved')
          WHERE id = ${productId}`,
    );
  }

  findPendingReviews(limit: number, offset: number) {
    return this.db.query.reviews.findMany({
      where: eq(schema.reviews.status, 'pending'),
      limit, offset,
      orderBy: desc(schema.reviews.createdAt),
      with: { user: { columns: { fullName: true, phone: true } } } as never,
    });
  }
}
