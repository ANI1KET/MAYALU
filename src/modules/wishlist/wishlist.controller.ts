import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { WishlistResponseDto } from '../../common/swagger/response.dto';
import { CurrentUser } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiOkEnvelopeSchema, ApiCreatedEnvelopeSchema, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiCookieAuth('access_token')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get wishlist with product summaries' })
  @ApiOkEnvelope(WishlistResponseDto, 'Wishlist with items (empty items array if never created)')
  @ApiStandardErrors()
  getWishlist(@CurrentUser() user: { sub: string }) {
    return this.wishlistService.getWishlist(user.sub);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add product to wishlist (idempotent)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiCreatedEnvelopeSchema(
    { type: 'object', properties: { added: { type: 'boolean', example: true }, productId: { type: 'string', format: 'uuid' } } },
    'Added to wishlist',
  )
  @ApiStandardErrors({ notFound: 'Product' })
  addProduct(@CurrentUser() user: { sub: string }, @Param('productId') productId: string) {
    return this.wishlistService.addProduct(user.sub, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiOkEnvelopeSchema(
    { type: 'object', properties: { removed: { type: 'boolean', example: true }, productId: { type: 'string', format: 'uuid' } } },
    'Removed from wishlist (idempotent — no error if it was never present)',
  )
  @ApiStandardErrors()
  removeProduct(@CurrentUser() user: { sub: string }, @Param('productId') productId: string) {
    return this.wishlistService.removeProduct(user.sub, productId);
  }
}
