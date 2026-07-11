import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { ReviewDto } from '../../common/swagger/response.dto';
import { CurrentUser, Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/reviews.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'Get approved reviews for a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiOkEnvelope([ReviewDto], 'Approved reviews sorted by newest')
  @ApiStandardErrors({ auth: false })
  getProductReviews(@Param('productId') productId: string) {
    return this.reviewsService.getProductReviews(productId);
  }

  @ApiCookieAuth('access_token')
  @Post('product/:productId')
  @ApiBody({ type: CreateReviewDto })
  @ApiOperation({
    summary: 'Create review',
    description: 'Requires a delivered order containing the product. One review per user per product.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiCreatedEnvelope(ReviewDto, 'Review submitted (pending moderation)')
  @ApiStandardErrors({
    badRequest: 'ORDER_NOT_DELIVERED | PRODUCT_NOT_IN_ORDER | REVIEW_EXISTS',
    notFound: 'Product',
  })
  create(
    @CurrentUser() user: { sub: string },
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.sub, productId, dto);
  }
}
