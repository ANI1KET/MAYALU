import {
  Injectable, Inject, NotFoundException, Module, Controller,
  Get, Post, Delete, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { WishlistResponseDto } from '../../common/swagger/response.dto';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';
import { ApiOkEnvelope, ApiOkEnvelopeSchema, ApiCreatedEnvelopeSchema, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

@Injectable()
export class WishlistService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private async getOrCreate(userId: string) {
    const existing = await this.db.query.wishlists.findFirst({
      where: eq(schema.wishlists.userId, userId),
    });
    if (existing) return existing;

    const [created] = await this.db.insert(schema.wishlists)
      .values({ userId }).returning();
    return created!;
  }

  async getWishlist(userId: string) {
    const wishlist = await this.db.query.wishlists.findFirst({
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
    if (!wishlist) return { items: [] };
    return wishlist;
  }

  async addProduct(userId: string, productId: string) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.status, 'active')),
    });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    const wishlist = await this.getOrCreate(userId);

    await this.db.insert(schema.wishlistItems)
      .values({ wishlistId: wishlist.id, productId })
      .onConflictDoNothing();

    return { added: true, productId };
  }

  async removeProduct(userId: string, productId: string) {
    const wishlist = await this.getOrCreate(userId);
    await this.db.delete(schema.wishlistItems)
      .where(and(
        eq(schema.wishlistItems.wishlistId, wishlist.id),
        eq(schema.wishlistItems.productId, productId),
      ));
    return { removed: true, productId };
  }
}

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

@Module({
  controllers: [WishlistController],
  providers: [WishlistService, JwtService],
  exports: [WishlistService],
})
export class WishlistModule {}
