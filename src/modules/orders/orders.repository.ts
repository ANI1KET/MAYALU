import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

export interface CartItemWithVariant {
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

export interface PlaceOrderTxParams {
  orderNumber: string;
  userId: string;
  paymentMethod: 'cod' | 'esewa' | 'fonepay';
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  coupon: typeof schema.coupons.$inferSelect | null;
  address: {
    fullName: string;
    phone: string;
    addressLine: string;
    landmark: string | null;
    city: string;
    district: string;
    pincode: string | null;
    zone: typeof schema.addresses.$inferSelect['zone'];
  };
  customerNotes?: string;
  cartId: string;
  items: CartItemWithVariant[];
}

@Injectable()
export class OrdersRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findAddressForUser(addressId: string, userId: string) {
    return this.db.query.addresses.findFirst({
      where: and(eq(schema.addresses.id, addressId), eq(schema.addresses.userId, userId)),
    });
  }

  findCartWithItems(userId: string) {
    return this.db.query.carts.findFirst({
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
  }

  findRemoteZone() {
    return this.db.query.deliveryZones.findFirst({
      where: eq(schema.deliveryZones.code, 'REMOTE'),
    });
  }

  findActiveCarrierRoutesForZone(destZoneId: string) {
    return this.db.query.carrierZoneRoutes.findMany({
      where: and(
        eq(schema.carrierZoneRoutes.destZoneId, destZoneId),
        eq(schema.carrierZoneRoutes.isActive, true),
      ),
    });
  }

  findActiveCouponByCode(code: string) {
    return this.db.query.coupons.findFirst({
      where: and(eq(schema.coupons.code, code), eq(schema.coupons.isActive, true)),
    });
  }

  findCouponUsagesForUser(couponId: string, userId: string) {
    return this.db.query.couponUsages.findMany({
      where: and(eq(schema.couponUsages.couponId, couponId), eq(schema.couponUsages.userId, userId)),
    });
  }

  findUserById(userId: string) {
    return this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  }

  async runPlaceOrderTransaction(params: PlaceOrderTxParams) {
    const {
      orderNumber, userId, paymentMethod, subtotal, discountAmount, deliveryCharge, totalAmount,
      coupon, address, customerNotes, cartId, items,
    } = params;

    return this.db.transaction(async (tx) => {
      // Insert order
      const [newOrder] = await tx.insert(schema.orders).values({
        orderNumber,
        userId,
        status: 'pending',
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
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
        customerNotes: customerNotes ?? null,
        deliveryZone: address.zone,
      }).returning();

      if (!newOrder) throw new Error('Failed to create order');

      // Insert order items (SNAPSHOTS)
      for (const item of items) {
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
      await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cartId));

      return newOrder;
    });
  }

  findOrdersPaginated(
    where: ReturnType<typeof and> | ReturnType<typeof eq>,
    limit: number,
    offset: number,
  ) {
    return this.db.query.orders.findMany({
      where,
      orderBy: desc(schema.orders.createdAt),
      limit,
      offset,
      with: { items: true } as never,
    });
  }

  countOrdersForUser(userId: string) {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(*) as count FROM orders WHERE user_id = ${userId}`,
    );
  }

  findOrderById(orderId: string, userId: string) {
    return this.db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)),
      with: { items: true } as never,
    });
  }

  findOrderStatusHistory(orderId: string) {
    return this.db.query.orderStatusHistory.findMany({
      where: eq(schema.orderStatusHistory.orderId, orderId),
      orderBy: (h, { asc }) => [asc(h.changedAt)],
    });
  }
}
