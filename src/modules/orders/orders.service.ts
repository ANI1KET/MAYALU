import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../database/schema/index';
import { SmsService } from '../../common/services/sms.service';
import { generateOrderNumber } from '../../common/utils/slug.util';
import { parsePagination, buildPaginatedResult } from '../../common/utils/pagination.util';
import { DELIVERY_CHARGE_NPR } from '../../common/constants/index';
import type { PlaceOrderDto, OrderFilterDto } from './dto/order.dto';
import { OrdersRepository, type CartItemWithVariant } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly smsService: SmsService,
  ) {}

  async placeOrder(userId: string, dto: PlaceOrderDto) {
    // 1. Verify address belongs to user
    const address = await this.ordersRepository.findAddressForUser(dto.addressId, userId);
    if (!address) {
      throw new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Delivery address not found' });
    }

    // 2. Load cart
    const cart = await this.ordersRepository.findCartWithItems(userId);

    if (!cart) throw new BadRequestException({ code: 'EMPTY_CART', message: 'Your cart is empty' });

    const cartWithItems = cart as typeof cart & { items: CartItemWithVariant[] };

    if (cartWithItems.items.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_CART', message: 'Your cart is empty' });
    }

    // 2. Validate delivery to this address (before touching stock)
    if (address.zone === 'remote') {
      // Check if any carrier serves remote routes from our origin
      const remoteZone = await this.ordersRepository.findRemoteZone();

      if (remoteZone) {
        const carriers = await this.ordersRepository.findActiveCarrierRoutesForZone(remoteZone.id);

        if (carriers.length === 0) {
          throw new BadRequestException({
            code: 'DELIVERY_UNSERVICEABLE',
            message: 'Sorry, we cannot deliver to remote areas at this time. Please use an address in a major city.',
          });
        }

        // COD not available for remote areas — force online payment
        if (dto.paymentMethod === 'cod' && !carriers.some((c) => c.supportsCod)) {
          throw new BadRequestException({
            code: 'COD_NOT_AVAILABLE',
            message: 'Cash on Delivery is not available for remote areas. Please use eSewa or Fonepay.',
          });
        }
      }
    }
    const unavailableItems = cartWithItems.items
      .filter((item) => !item.variant.isActive || item.variant.product.status !== 'active')
      .map((item) => `"${item.variant.product.name} - ${item.variant.name}" is no longer available`);

    if (unavailableItems.length > 0) {
      throw new BadRequestException({
        code: 'ITEMS_UNAVAILABLE',
        message: 'Some items are no longer available',
        details: unavailableItems,
      });
    }

    // 4. Detect stale prices (price changed since item was added to cart)
    const stalePriceWarnings: string[] = [];
    for (const item of cartWithItems.items) {
      const currentPrice = parseFloat(item.variant.price);
      const snapshotPrice = parseFloat(item.priceSnapshot);
      if (Math.abs(currentPrice - snapshotPrice) > 0.01) {
        stalePriceWarnings.push(
          `"${item.variant.name}": price changed from NPR ${snapshotPrice} → NPR ${currentPrice}`,
        );
      }
    }

    // Recalculate with CURRENT prices (not stale snapshots) for safety
    const subtotal = cartWithItems.items.reduce(
      (sum, item) => sum + parseFloat(item.variant.price) * item.quantity,
      0,
    );

    // 5. Delivery charge from constants (single source of truth)
    const deliveryCharge = DELIVERY_CHARGE_NPR[address.zone] ?? (DELIVERY_CHARGE_NPR['outside_valley'] as number);

    // 6. Validate coupon if provided
    let coupon: typeof schema.coupons.$inferSelect | null = null;
    let discountAmount = 0;

    if (dto.couponCode) {
      const couponResult = await this.validateCoupon(dto.couponCode, userId, subtotal);
      coupon = couponResult.coupon;
      // Cap discount: cannot exceed subtotal (prevents negative totalAmount)
      discountAmount = Math.min(couponResult.discountAmount, subtotal);
    }

    const totalAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);

    // Update priceSnap to use current price (not stale cart snapshot)
    for (const item of cartWithItems.items) {
      item.priceSnapshot = item.variant.price;
    }

    // 7. Atomic transaction
    const orderNumber = generateOrderNumber();
    const order = await this.ordersRepository.runPlaceOrderTransaction({
      orderNumber,
      userId,
      paymentMethod: dto.paymentMethod,
      subtotal,
      discountAmount,
      deliveryCharge,
      totalAmount,
      coupon,
      address,
      customerNotes: dto.customerNotes,
      cartId: cart.id,
      items: cartWithItems.items,
    });

    // 8. Send SMS after transaction (async, non-blocking)
    const user = await this.ordersRepository.findUserById(userId);
    if (user?.phone) {
      void this.smsService.sendOrderConfirmation(user.phone, order.orderNumber).catch(() => {});
    }

    return {
      ...order,
      stalePriceWarnings: stalePriceWarnings.length > 0 ? stalePriceWarnings : undefined,
    };
  }

  private async validateCoupon(code: string, userId: string, orderAmount: number) {
    const coupon = await this.ordersRepository.findActiveCouponByCode(code);

    if (!coupon) throw new BadRequestException({ code: 'COUPON_NOT_FOUND', message: `Coupon "${code}" not found` });

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException({ code: 'COUPON_NOT_STARTED', message: 'This coupon is not active yet' });
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException({ code: 'COUPON_EXPIRED', message: 'This coupon has expired' });
    }
    if (coupon.usageLimitTotal !== null && coupon.usageCount >= coupon.usageLimitTotal) {
      throw new BadRequestException({ code: 'COUPON_EXHAUSTED', message: 'This coupon has reached its usage limit' });
    }
    if (coupon.minOrderAmount && orderAmount < parseFloat(coupon.minOrderAmount)) {
      throw new BadRequestException({
        code: 'MIN_ORDER_REQUIRED',
        message: `Minimum order amount is NPR ${coupon.minOrderAmount}`,
      });
    }

    const userUsages = await this.ordersRepository.findCouponUsagesForUser(coupon.id, userId);

    if (userUsages.length >= coupon.usageLimitPerUser) {
      throw new BadRequestException({ code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon' });
    }

    let discountAmount: number;
    const discountValue = parseFloat(coupon.discountValue);

    if (coupon.discountType === 'percentage') {
      discountAmount = (orderAmount * discountValue) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
      }
    } else {
      discountAmount = Math.min(discountValue, orderAmount);
    }

    return { coupon, discountAmount };
  }

  async getOrders(userId: string, filter: OrderFilterDto) {
    const { page, limit, offset } = parsePagination(filter);

    const where = filter.status
      ? and(
          eq(schema.orders.userId, userId),
          eq(schema.orders.status, filter.status as typeof schema.orders.$inferSelect['status']),
        )
      : eq(schema.orders.userId, userId);

    const [orders, totalResult] = await Promise.all([
      this.ordersRepository.findOrdersPaginated(where, limit, offset),
      this.ordersRepository.countOrdersForUser(userId),
    ]);

    const total = parseInt(totalResult.rows[0]?.count ?? '0', 10);
    return buildPaginatedResult(orders, total, page, limit);
  }

  async getOrderDetail(orderId: string, userId: string) {
    const order = await this.ordersRepository.findOrderById(orderId, userId);

    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    // Fetch status history separately for clean ordering
    const statusHistory = await this.ordersRepository.findOrderStatusHistory(orderId);

    return { ...order, statusHistory };
  }
}
