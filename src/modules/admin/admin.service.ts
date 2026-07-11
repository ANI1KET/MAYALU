import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as schema from '../../database/schema/index';
import { SmsService } from '../../common/services/sms.service';
import { parsePagination, buildPaginatedResult } from '../../common/utils/pagination.util';
import { AdminRepository } from './admin.repository';
import type { UpdateOrderStatusDto, CreateCouponDto, CreateBannerDto, UpdateShopStatusDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly smsService: SmsService,
  ) {}

  // ─── Dashboard ─────────────────────────────────────────────────
  async getDashboard() {
    // Use pg_stat_user_tables for approximate counts (O(1)) on large tables.
    // Exact counts via COUNT(*) require full table scans on Postgres.
    // Pending orders need exact count (small subset) — always exact.
    const [approxStats, pendingOrders, totalRevenue] = await Promise.all([
      this.adminRepository.getApproxTableStats(),
      this.adminRepository.getPendingOrdersCount(),
      this.adminRepository.getTotalRevenuePaid(),
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
      this.adminRepository.findOrders(where, limit, offset),
      this.adminRepository.countOrders(status),
    ]);

    return buildPaginatedResult(orders, parseInt(totalResult.rows[0]?.count ?? '0', 10), page, limit);
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto, adminUserId?: string) {
    const order = await this.adminRepository.findOrderWithUser(orderId);

    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    const now = new Date();
    const timestamps: Record<string, Date | undefined> = {
      confirmed: dto.status === 'confirmed' ? now : undefined,
      packed: dto.status === 'packed' ? now : undefined,
      shipped: dto.status === 'shipped' ? now : undefined,
      delivered: dto.status === 'delivered' ? now : undefined,
      cancelled: dto.status === 'cancelled' ? now : undefined,
    };

    await this.adminRepository.updateOrder(orderId, {
      status: dto.status,
      paymentReference: dto.paymentReference ?? order.paymentReference,
      confirmedAt: timestamps['confirmed'] ?? order.confirmedAt,
      packedAt: timestamps['packed'] ?? order.packedAt,
      shippedAt: timestamps['shipped'] ?? order.shippedAt,
      deliveredAt: timestamps['delivered'] ?? order.deliveredAt,
      cancelledAt: timestamps['cancelled'] ?? order.cancelledAt,
      updatedAt: now,
    });

    await this.adminRepository.insertOrderStatusHistory({
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
      this.adminRepository.findShops(limit, offset),
      this.adminRepository.countShops(),
    ]);
    return buildPaginatedResult(shops, parseInt(totalResult.rows[0]?.count ?? '0', 10), page, limit);
  }

  async updateShopStatus(shopId: string, dto: UpdateShopStatusDto) {
    const updated = await this.adminRepository.updateShopStatus(shopId, dto);
    if (!updated) throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    return updated;
  }

  // ─── Coupons ───────────────────────────────────────────────────
  async createCoupon(dto: CreateCouponDto) {
    const coupon = await this.adminRepository.createCoupon({
      ...dto,
      code: dto.code.toUpperCase(),
      discountValue: String(dto.discountValue),
      minOrderAmount: dto.minOrderAmount ? String(dto.minOrderAmount) : null,
      maxDiscount: dto.maxDiscount ? String(dto.maxDiscount) : null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
      usageCount: 0,
    } as never);
    return coupon;
  }

  async toggleCoupon(couponId: string) {
    const coupon = await this.adminRepository.findCouponById(couponId);
    if (!coupon) throw new NotFoundException({ code: 'COUPON_NOT_FOUND', message: 'Coupon not found' });

    const updated = await this.adminRepository.updateCoupon(couponId, {
      isActive: !coupon.isActive, updatedAt: new Date(),
    });
    return updated;
  }

  // ─── Banners ───────────────────────────────────────────────────
  async createBanner(dto: CreateBannerDto) {
    const banner = await this.adminRepository.createBanner({
      ...dto, isActive: true, sortOrder: dto.sortOrder ?? 0,
    } as never);
    return banner;
  }

  async toggleBanner(bannerId: string) {
    const banner = await this.adminRepository.findBannerById(bannerId);
    if (!banner) throw new NotFoundException({ code: 'BANNER_NOT_FOUND', message: 'Banner not found' });

    const updated = await this.adminRepository.updateBanner(bannerId, {
      isActive: !banner.isActive, updatedAt: new Date(),
    });
    return updated;
  }

  // ─── Reviews ───────────────────────────────────────────────────
  async approveReview(reviewId: string) {
    const review = await this.adminRepository.findReviewById(reviewId);
    if (!review) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });

    await this.adminRepository.updateReviewStatus(reviewId, 'approved');

    // Update product rating
    await this.adminRepository.recalculateProductRating(review.productId);

    return { approved: true };
  }

  async getPendingReviews(page = 1, limit = 20) {
    const { offset } = parsePagination({ page, limit });
    return this.adminRepository.findPendingReviews(limit, offset);
  }
}
