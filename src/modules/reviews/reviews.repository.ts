import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import type { CreateReviewDto } from './dto/reviews.dto';

@Injectable()
export class ReviewsRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getProductReviews(productId: string) {
    return this.db.query.reviews.findMany({
      where: and(
        eq(schema.reviews.productId, productId),
        eq(schema.reviews.status, 'approved'),
      ),
      with: {
        user: { columns: { fullName: true, avatarUrl: true } } as never,
        media: true,
      } as never,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      limit: 50,
    });
  }

  findOrderById(orderId: string, userId: string) {
    return this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.userId, userId),
      ),
    });
  }

  findOrderItemByOrderId(orderId: string) {
    return this.db.query.orderItems.findFirst({
      where: eq(schema.orderItems.orderId, orderId),
    });
  }

  findVariantById(variantId: string) {
    return this.db.query.productVariants.findFirst({
      where: eq(schema.productVariants.id, variantId),
    });
  }

  findProductById(productId: string) {
    return this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });
  }

  findReviewByOrderId(orderId: string) {
    return this.db.query.reviews.findFirst({
      where: eq(schema.reviews.orderId, orderId),
    });
  }

  async createReview(userId: string, productId: string, shopId: string, dto: CreateReviewDto) {
    const [review] = await this.db.insert(schema.reviews).values({
      productId,
      shopId,
      userId,
      orderId: dto.orderId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      isVerifiedPurchase: true,
      status: 'pending',
    }).returning();
    return review;
  }

  async getProductRatingAggregate(productId: string) {
    const result = await this.db.execute<{ avg_rating: string; total_reviews: string }>(
      sql`SELECT AVG(rating)::numeric(3,2) as avg_rating, COUNT(*) as total_reviews
          FROM reviews WHERE product_id = ${productId} AND status = 'approved'`,
    );
    return result.rows[0];
  }

  async updateProductRating(productId: string, avgRating: string, totalReviews: number) {
    await this.db.update(schema.products)
      .set({
        avgRating,
        totalReviews,
      })
      .where(eq(schema.products.id, productId));
  }
}
