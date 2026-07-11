import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import type { CreateReviewDto } from './dto/reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
  ) {}

  async getProductReviews(productId: string) {
    return this.reviewsRepository.getProductReviews(productId);
  }

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    // Verify order is delivered and belongs to user
    const order = await this.reviewsRepository.findOrderById(dto.orderId, userId);

    if (!order || order.status !== 'delivered') {
      throw new BadRequestException({
        code: 'ORDER_NOT_DELIVERED',
        message: 'You can only review products from delivered orders',
      });
    }

    // Verify product is in the order (handle deleted variants via skuSnap)
    const orderItem = await this.reviewsRepository.findOrderItemByOrderId(dto.orderId);

    if (!orderItem) {
      throw new BadRequestException({
        code: 'PRODUCT_NOT_IN_ORDER',
        message: 'This product was not part of the specified order.',
      });
    }

    // If variant still exists, validate it belongs to this product
    if (orderItem.variantId) {
      const variant = await this.reviewsRepository.findVariantById(orderItem.variantId);
      if (!variant || variant.productId !== productId) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_IN_ORDER',
          message: 'This product was not part of the specified order.',
        });
      }
    } else {
      // Variant was deleted — verify via productNameSnap
      const product = await this.reviewsRepository.findProductById(productId);
      if (!product || orderItem.productNameSnap !== product.name) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_IN_ORDER',
          message: 'This product was not part of the specified order.',
        });
      }
    }

    // One review per order (orderId is UNIQUE in reviews)
    const existingReview = await this.reviewsRepository.findReviewByOrderId(dto.orderId);

    if (existingReview) {
      throw new BadRequestException({
        code: 'REVIEW_EXISTS',
        message: 'You have already reviewed this order',
      });
    }

    const product = await this.reviewsRepository.findProductById(productId);

    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    const review = await this.reviewsRepository.createReview(userId, productId, product.shopId, dto);

    // Update product avg rating (only approved reviews)
    await this.updateProductRating(productId);

    return review;
  }

  private async updateProductRating(productId: string): Promise<void> {
    const row = await this.reviewsRepository.getProductRatingAggregate(productId);

    if (row) {
      await this.reviewsRepository.updateProductRating(
        productId,
        row.avg_rating ?? '0',
        parseInt(row.total_reviews ?? '0', 10),
      );
    }
  }
}
