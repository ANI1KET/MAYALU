import {
  Injectable, Inject, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { SmsService } from '../../common/services/sms.service';
import { generateOrderNumber } from '../../common/utils/slug.util';
import { parsePagination, buildPaginatedResult } from '../../common/utils/pagination.util';
import { DELIVERY_CHARGE_NPR } from '../../common/constants/index';
import type { PlaceOrderDto, OrderFilterDto } from './dto/order.dto';

interface CartItemWithVariant {
  id: string;
  quantity: number;
  priceSnapshot: string;
  variantId: string;
  variant: {
    id: string;
    sku: string;
    name: string;
    price: string;
    isActive: boolean;
    imageUrl?: string | null;
    product: {
      id: string;
      name: string;
      status: string;
      shopId: string;
    };
    attributeValues: Array<{
      attribute: { name: string };
      attributeOption: { label: string } | null;
      customValue: string | null;
    }>;
  };
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
    private readonly smsService: SmsService,
  ) {}

  async placeOrder(userId: string, dto: PlaceOrderDto) {
    // 1. Verify address belongs to user
    const address = await this.db.query.addresses.findFirst({
      where: and(eq(schema.addresses.id, dto.addressId), eq(schema.addresses.userId, userId)),
    });
    if (!address) {
      throw new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Delivery address not found' });
    }

    // 2. Load cart
    const cart = await this.db.query.carts.findFirst({
      where: eq(schema.carts.userId, userId),
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: true,
                attributeValues: { with: { attribute: true, attributeOption: true } as never } as never,
              } as never,
            },
          } as never,
        },
      } as never,
    });

    if (!cart) throw new BadRequestException({ code: 'EMPTY_CART', message: 'Your cart is empty' });

    const cartWithItems = cart as typeof cart & { items: CartItemWithVariant[] };

    if (cartWithItems.items.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_CART', message: 'Your cart is empty' });
    }

    // 2. Validate delivery to this address (before touching stock)
    if (address.zone === 'remote') {
      // Check if any carrier serves remote routes from our origin
      const remoteZone = await this.db.query.deliveryZones.findFirst({
        where: eq(schema.deliveryZones.code, 'REMOTE'),
      });

      if (remoteZone) {
        const carriers = await this.db.query.carrierZoneRoutes.findMany({
          where: and(
            eq(schema.carrierZoneRoutes.destZoneId, remoteZone.id),
            eq(schema.carrierZoneRoutes.isActive, true),
          ),
        });

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
    const order = await this.db.transaction(async (tx) => {
      const orderNumber = generateOrderNumber();

      // Insert order
      const [newOrder] = await tx.insert(schema.orders).values({
        orderNumber,
        userId,
        status: 'pending',
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentMethod === 'cod' ? 'pending' : 'pending',
        subtotal: String(subtotal),
        discountAmount: String(discountAmount),
        deliveryCharge: String(deliveryCharge),
        totalAmount: String(totalAmount),
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        shippingAddressSnap: {
          fullName: address.fullName,
          phone: address.phone,
          addressLine: address.addressLine,
          landmark: address.landmark,
          city: address.city,
          district: address.district,
          pincode: address.pincode,
          zone: address.zone,
        },
        customerNotes: dto.customerNotes ?? null,
        deliveryZone: address.zone,
      }).returning();

      if (!newOrder) throw new Error('Failed to create order');

      // Insert order items (SNAPSHOTS)
      for (const item of cartWithItems.items) {
        const attributesSnap: Record<string, string> = {};
        const vWithAttrs = item.variant as typeof item.variant & {
          attributeValues: Array<{
            attribute: { name: string };
            attributeOption: { label: string } | null;
            customValue: string | null;
          }>;
        };
        for (const av of vWithAttrs.attributeValues ?? []) {
          attributesSnap[av.attribute.name] = av.attributeOption?.label ?? av.customValue ?? '';
        }

        await tx.insert(schema.orderItems).values({
          orderId: newOrder.id,
          shopId: item.variant.product.shopId,
          variantId: item.variantId,
          productNameSnap: item.variant.product.name,
          variantNameSnap: item.variant.name,
          skuSnap: item.variant.sku,
          imageUrlSnap: item.variant.imageUrl ?? null,
          attributesSnap,
          priceSnap: item.priceSnapshot,
          quantity: item.quantity,
          totalPrice: String(parseFloat(item.priceSnapshot) * item.quantity),
        });

        // Deduct inventory atomically with stock floor check — prevents race condition overselling
        const deductResult = await tx.execute<{ id: string; new_on_hand: number }>(
          sql`UPDATE inventory
              SET quantity_on_hand = GREATEST(quantity_on_hand - ${item.quantity}, 0),
                  quantity_reserved = GREATEST(quantity_reserved - ${item.quantity}, 0)
              WHERE variant_id = ${item.variantId}
                AND (quantity_on_hand - quantity_reserved) >= ${item.quantity}
              RETURNING id, quantity_on_hand as new_on_hand`,
        );

        if (deductResult.rows.length === 0) {
          // Stock ran out between pre-check and transaction — rollback entire order
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for "${item.variant.name}". Please refresh your cart.`,
          });
        }

        const deducted = deductResult.rows[0]!;

        await tx.insert(schema.inventoryTransactions).values({
          inventoryId: deducted.id,
          type: 'sale',
          quantityDelta: -item.quantity,
          quantityAfter: deducted.new_on_hand,
          referenceType: 'order',
          referenceId: newOrder.id,
        });

        // Update product totalSold
        await tx.update(schema.products)
          .set({ totalSold: sql`total_sold + ${item.quantity}` })
          .where(eq(schema.products.id, item.variant.product.id));
      }

      // Order status history
      await tx.insert(schema.orderStatusHistory).values({
        orderId: newOrder.id,
        toStatus: 'pending',
        note: 'Order placed successfully',
        changedByUserId: userId,
      });

      // Atomic coupon increment — prevents concurrent overselling of limited coupons
      if (coupon) {
        const updated = await tx.execute<{ id: string }>(
          sql`UPDATE coupons
              SET usage_count = usage_count + 1
              WHERE id = ${coupon.id}
                AND (usage_limit_total IS NULL OR usage_count < usage_limit_total)
              RETURNING id`,
        );

        if (updated.rows.length === 0) {
          throw new BadRequestException({
            code: 'COUPON_EXHAUSTED',
            message: 'Coupon has just reached its usage limit. Please try without a coupon.',
          });
        }

        await tx.insert(schema.couponUsages).values({
          couponId: coupon.id,
          userId,
          orderId: newOrder.id,
          amountSaved: String(discountAmount),
        });
      }

      // Clear cart
      await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id));

      return newOrder;
    });

    // 8. Send SMS after transaction (async, non-blocking)
    const user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (user?.phone) {
      void this.smsService.sendOrderConfirmation(user.phone, order.orderNumber).catch(() => {});
    }

    return {
      ...order,
      stalePriceWarnings: stalePriceWarnings.length > 0 ? stalePriceWarnings : undefined,
    };
  }

  private async validateCoupon(code: string, userId: string, orderAmount: number) {
    const coupon = await this.db.query.coupons.findFirst({
      where: and(eq(schema.coupons.code, code), eq(schema.coupons.isActive, true)),
    });

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

    const userUsages = await this.db.query.couponUsages.findMany({
      where: and(eq(schema.couponUsages.couponId, coupon.id), eq(schema.couponUsages.userId, userId)),
    });

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
      this.db.query.orders.findMany({
        where,
        orderBy: desc(schema.orders.createdAt),
        limit,
        offset,
        with: { items: true } as never,
      }),
      this.db.execute<{ count: string }>(
        sql`SELECT COUNT(*) as count FROM orders WHERE user_id = ${userId}`,
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.count ?? '0', 10);
    return buildPaginatedResult(orders, total, page, limit);
  }

  async getOrderDetail(orderId: string, userId: string) {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)),
      with: { items: true } as never,
    });

    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    // Fetch status history separately for clean ordering
    const statusHistory = await this.db.query.orderStatusHistory.findMany({
      where: eq(schema.orderStatusHistory.orderId, orderId),
      orderBy: (h, { asc }) => [asc(h.changedAt)],
    });

    return { ...order, statusHistory };
  }
}
