import {
  Injectable, Inject, NotFoundException, Module, Controller,
  Get, Post, Delete, Param, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProductDto, MessageResponseDto, ErrorResponseDto } from '../../common/swagger/response.dto';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';

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
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get wishlist with product summaries' })
  @ApiOkResponse({ type: [ProductDto], description: 'Wishlist products' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getWishlist(@CurrentUser() user: { sub: string }) {
    return this.wishlistService.getWishlist(user.sub);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add product to wishlist (idempotent)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiCreatedResponse({ type: MessageResponseDto, description: 'Added to wishlist' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  addProduct(@CurrentUser() user: { sub: string }, @Param('productId') productId: string) {
    return this.wishlistService.addProduct(user.sub, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Removed from wishlist' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
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
