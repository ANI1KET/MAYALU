import {
  Injectable, Inject, BadRequestException, NotFoundException,
  Module, Controller, Get, Post, Param, Body, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse,
  ApiNotFoundResponse, ApiUnauthorizedResponse, ApiConflictResponse,
  ApiProperty, ApiPropertyOptional,
} from '@nestjs/swagger';
import { ReviewDto, MessageResponseDto, ErrorResponseDto } from '../../common/swagger/response.dto';
import { IsString, IsNumber, IsOptional, IsUUID, Min, Max, Length } from 'class-validator';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';
import { REVIEW } from '../../common/constants/index';

class CreateReviewDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Order UUID — must contain this product with status delivered' })
  @IsUUID() orderId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: '1=Poor, 3=Average, 5=Excellent' })
  @IsNumber() @Min(REVIEW.MIN_RATING) @Max(REVIEW.MAX_RATING) rating!: number;

  @ApiPropertyOptional({ example: 'Beautiful fabric, fast delivery! Highly recommend.', maxLength: 1000 })
  @IsOptional() @IsString() @Length(0, REVIEW.MAX_COMMENT_LENGTH) comment?: string;
}

@Injectable()
export class ReviewsService {
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

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    // Verify order is delivered and belongs to user
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, dto.orderId),
        eq(schema.orders.userId, userId),
      ),
    });

    if (!order || order.status !== 'delivered') {
      throw new BadRequestException({
        code: 'ORDER_NOT_DELIVERED',
        message: 'You can only review products from delivered orders',
      });
    }

    // Verify product is in the order (handle deleted variants via skuSnap)
    const orderItem = await this.db.query.orderItems.findFirst({
      where: eq(schema.orderItems.orderId, dto.orderId),
    });

    if (!orderItem) {
      throw new BadRequestException({
        code: 'PRODUCT_NOT_IN_ORDER',
        message: 'This product was not part of the specified order.',
      });
    }

    // If variant still exists, validate it belongs to this product
    if (orderItem.variantId) {
      const variant = await this.db.query.productVariants.findFirst({
        where: eq(schema.productVariants.id, orderItem.variantId),
      });
      if (!variant || variant.productId !== productId) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_IN_ORDER',
          message: 'This product was not part of the specified order.',
        });
      }
    } else {
      // Variant was deleted — verify via productNameSnap
      const product = await this.db.query.products.findFirst({
        where: eq(schema.products.id, productId),
      });
      if (!product || orderItem.productNameSnap !== product.name) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_IN_ORDER',
          message: 'This product was not part of the specified order.',
        });
      }
    }

    // One review per order (orderId is UNIQUE in reviews)
    const existingReview = await this.db.query.reviews.findFirst({
      where: eq(schema.reviews.orderId, dto.orderId),
    });

    if (existingReview) {
      throw new BadRequestException({
        code: 'REVIEW_EXISTS',
        message: 'You have already reviewed this order',
      });
    }

    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });

    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    const [review] = await this.db.insert(schema.reviews).values({
      productId,
      shopId: product.shopId,
      userId,
      orderId: dto.orderId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      isVerifiedPurchase: true,
      status: 'pending',
    }).returning();

    // Update product avg rating (only approved reviews)
    await this.updateProductRating(productId);

    return review;
  }

  private async updateProductRating(productId: string): Promise<void> {
    const result = await this.db.execute<{ avg_rating: string; total_reviews: string }>(
      sql`SELECT AVG(rating)::numeric(3,2) as avg_rating, COUNT(*) as total_reviews
          FROM reviews WHERE product_id = ${productId} AND status = 'approved'`,
    );

    const row = result.rows[0];
    if (row) {
      await this.db.update(schema.products)
        .set({
          avgRating: row.avg_rating ?? '0',
          totalReviews: parseInt(row.total_reviews ?? '0', 10),
        })
        .where(eq(schema.products.id, productId));
    }
  }
}

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'Get approved reviews for a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiOkResponse({ type: [ReviewDto], description: 'Approved reviews sorted by newest' })
  getProductReviews(@Param('productId') productId: string) {
    return this.reviewsService.getProductReviews(productId);
  }

  @UseGuards(AuthGuard)
  @ApiCookieAuth('access_token')
  @Post('product/:productId')
  @ApiBody({ type: CreateReviewDto })
  @ApiOperation({
    summary: 'Create review',
    description: 'Requires a delivered order containing the product. One review per user per product.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiCreatedResponse({ type: ReviewDto, description: 'Review submitted (pending moderation)' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'PRODUCT_NOT_IN_ORDER | ORDER_NOT_DELIVERED' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'REVIEW_ALREADY_EXISTS' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  create(
    @CurrentUser() user: { sub: string },
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.sub, productId, dto);
  }
}

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, JwtService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
