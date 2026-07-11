import {
  Injectable, Inject, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { CART } from '../../common/constants/index';

@Injectable()
export class CartService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getOrCreate(userId: string) {
    const existing = await this.db.query.carts.findFirst({
      where: eq(schema.carts.userId, userId),
      with: {
        items: {
          with: {
            variant: {
              with: { product: true, media: true } as never,
            },
          } as never,
        },
      } as never,
    });

    if (existing) return existing;

    const [cart] = await this.db.insert(schema.carts).values({ userId }).returning();
    return { ...cart!, items: [] };
  }

  async addItem(userId: string, variantId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);

    // Validate variant and product
    const variant = await this.db.query.productVariants.findFirst({
      where: eq(schema.productVariants.id, variantId),
      with: { product: true } as never,
    });

    if (!variant) {
      throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Product variant not found' });
    }

    const vWithProduct = variant as typeof variant & { product: typeof schema.products.$inferSelect };

    if (!vWithProduct.isActive || vWithProduct.product.status !== 'active') {
      throw new BadRequestException({
        code: 'PRODUCT_UNAVAILABLE',
        message: 'This product is not available for purchase',
      });
    }

    // Check stock
    const inv = await this.db.query.inventory.findFirst({
      where: eq(schema.inventory.variantId, variantId),
    });

    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
    if (available < quantity && !inv?.allowBackorder) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${available} units available`,
        details: { available, requested: quantity },
      });
    }

    // Check if item already in cart
    const existingItem = await this.db.query.cartItems.findFirst({
      where: and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.variantId, variantId)),
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (available < newQty && !inv?.allowBackorder) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Only ${available} units available (${existingItem.quantity} already in cart)`,
        });
      }

      const [updated] = await this.db.update(schema.cartItems)
        .set({ quantity: newQty })
        .where(eq(schema.cartItems.id, existingItem.id))
        .returning();

      await this.db.update(schema.carts)
        .set({ updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.id));

      return updated;
    }

    const [item] = await this.db.insert(schema.cartItems).values({
      cartId: cart.id,
      variantId,
      quantity,
      priceSnapshot: vWithProduct.price,
    }).returning();

    await this.db.update(schema.carts)
      .set({ updatedAt: new Date() })
      .where(eq(schema.carts.id, cart.id));

    return item;
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);

    const item = await this.db.query.cartItems.findFirst({
      where: and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cart.id)),
    });

    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Cart item not found' });

    // Re-check stock for new quantity
    const inv = await this.db.query.inventory.findFirst({
      where: eq(schema.inventory.variantId, item.variantId),
    });

    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
    if (available < quantity && !inv?.allowBackorder) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${available} units available`,
      });
    }

    const [updated] = await this.db.update(schema.cartItems)
      .set({ quantity })
      .where(eq(schema.cartItems.id, itemId))
      .returning();

    return updated;
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreate(userId);

    await this.db.delete(schema.cartItems)
      .where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cart.id)));

    return { removed: true };
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreate(userId);

    await this.db.delete(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cart.id));

    return { cleared: true };
  }

  async getCartWithItems(userId: string) {
    const cart = await this.db.query.carts.findFirst({
      where: eq(schema.carts.userId, userId),
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: { with: { media: { limit: 1 } } as never },
                attributeValues: true,
              } as never,
            },
          } as never,
        },
      } as never,
    });

    if (!cart) return { id: null, items: [], total: 0 };

    const cartWithItems = cart as typeof cart & {
      items: Array<{
        id: string;
        quantity: number;
        priceSnapshot: string;
        variant: typeof schema.productVariants.$inferSelect;
      }>;
    };

    const total = cartWithItems.items.reduce(
      (sum, item) => sum + parseFloat(item.priceSnapshot) * item.quantity,
      0,
    );

    return { ...cart, total };
  }
}
