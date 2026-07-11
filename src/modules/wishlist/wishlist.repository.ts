import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class WishlistRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findWishlistByUserId(userId: string) {
    return this.db.query.wishlists.findFirst({
      where: eq(schema.wishlists.userId, userId),
    });
  }

  async createWishlist(userId: string) {
    const [created] = await this.db.insert(schema.wishlists)
      .values({ userId }).returning();
    return created!;
  }

  findWishlistWithItems(userId: string) {
    return this.db.query.wishlists.findFirst({
      where: eq(schema.wishlists.userId, userId),
      with: {
        items: {
          with: {
            product: {
              with: { media: { limit: 1 } as never, variants: { limit: 1 } as never } as never,
            },
          } as never,
        },
      } as never,
    });
  }

  findActiveProductById(productId: string) {
    return this.db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.status, 'active')),
    });
  }

  addItem(wishlistId: string, productId: string) {
    return this.db.insert(schema.wishlistItems)
      .values({ wishlistId, productId })
      .onConflictDoNothing();
  }

  removeItem(wishlistId: string, productId: string) {
    return this.db.delete(schema.wishlistItems)
      .where(and(
        eq(schema.wishlistItems.wishlistId, wishlistId),
        eq(schema.wishlistItems.productId, productId),
      ));
  }
}
