import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class CartRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findCartByUserId(userId: string) {
    return this.db.query.carts.findFirst({
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
  }

  async insertCart(userId: string) {
    const [cart] = await this.db.insert(schema.carts).values({ userId }).returning();
    return cart!;
  }

  findVariantWithProduct(variantId: string) {
    return this.db.query.productVariants.findFirst({
      where: eq(schema.productVariants.id, variantId),
      with: { product: true } as never,
    });
  }

  findInventoryByVariantId(variantId: string) {
    return this.db.query.inventory.findFirst({
      where: eq(schema.inventory.variantId, variantId),
    });
  }

  findCartItem(cartId: string, variantId: string) {
    return this.db.query.cartItems.findFirst({
      where: and(eq(schema.cartItems.cartId, cartId), eq(schema.cartItems.variantId, variantId)),
    });
  }

  findCartItemById(itemId: string, cartId: string) {
    return this.db.query.cartItems.findFirst({
      where: and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cartId)),
    });
  }

  async updateCartItemQuantity(itemId: string, quantity: number) {
    const [updated] = await this.db.update(schema.cartItems)
      .set({ quantity })
      .where(eq(schema.cartItems.id, itemId))
      .returning();
    return updated;
  }

  updateCartTimestamp(cartId: string) {
    return this.db.update(schema.carts)
      .set({ updatedAt: new Date() })
      .where(eq(schema.carts.id, cartId));
  }

  async insertCartItem(cartId: string, variantId: string, quantity: number, priceSnapshot: string) {
    const [item] = await this.db.insert(schema.cartItems).values({
      cartId,
      variantId,
      quantity,
      priceSnapshot,
    }).returning();
    return item;
  }

  deleteCartItemById(itemId: string, cartId: string) {
    return this.db.delete(schema.cartItems)
      .where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.cartId, cartId)));
  }

  deleteCartItemsByCartId(cartId: string) {
    return this.db.delete(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cartId));
  }

  findCartWithItemsDetailed(userId: string) {
    return this.db.query.carts.findFirst({
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
  }
}
