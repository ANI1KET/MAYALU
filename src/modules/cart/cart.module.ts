import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Module,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse,
  ApiNotFoundResponse, ApiUnauthorizedResponse,
  ApiProperty,
} from '@nestjs/swagger';
import {
  CartResponseDto, CartItemDto, MessageResponseDto, ErrorResponseDto,
} from '../../common/swagger/response.dto';
import { IsNumber, IsString, Min, Max } from 'class-validator';
import { CartService } from './cart.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';
import { CART } from '../../common/constants/index';

class AddItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ProductVariant UUID' })
  @IsString() variantId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 99, description: 'Quantity to add' })
  @IsNumber() @Min(1) @Max(CART.MAX_QUANTITY_PER_ITEM) quantity!: number;
}

class UpdateItemDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: 99 })
  @IsNumber() @Min(1) @Max(CART.MAX_QUANTITY_PER_ITEM) quantity!: number;
}

@ApiTags('Cart')
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get cart with items, prices, and totals' })
  @ApiOkResponse({ type: CartResponseDto, description: 'Current cart contents' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getCart(@CurrentUser() user: { sub: string }) {
    return this.cartService.getCartWithItems(user.sub);
  }

  @Post('items')
  @ApiBody({ type: AddItemDto })
  @ApiOperation({
    summary: 'Add item to cart',
    description: 'Checks stock availability. Merges quantity if variant already in cart. Max 99 per item.',
  })
  @ApiCreatedResponse({ type: CartItemDto, description: 'Item added/updated in cart' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'INSUFFICIENT_STOCK | VARIANT_NOT_FOUND | PRODUCT_INACTIVE' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  addItem(@CurrentUser() user: { sub: string }, @Body() dto: AddItemDto) {
    return this.cartService.addItem(user.sub, dto.variantId, dto.quantity);
  }

  @Patch('items/:itemId')
  @ApiBody({ type: UpdateItemDto })
  @ApiOperation({ summary: 'Update item quantity', description: 'Re-validates stock on every update.' })
  @ApiParam({ name: 'itemId', description: 'Cart item UUID' })
  @ApiOkResponse({ type: CartItemDto, description: 'Updated cart item' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'CART_ITEM_NOT_FOUND' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'INSUFFICIENT_STOCK' })
  updateItem(
    @CurrentUser() user: { sub: string },
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cartService.updateItem(user.sub, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiParam({ name: 'itemId', description: 'Cart item UUID' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Item removed' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'CART_ITEM_NOT_FOUND' })
  removeItem(@CurrentUser() user: { sub: string }, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(user.sub, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Cart cleared' })
  clearCart(@CurrentUser() user: { sub: string }) {
    return this.cartService.clearCart(user.sub);
  }
}

@Module({
  controllers: [CartController],
  providers: [CartService, JwtService],
  exports: [CartService],
})
export class CartModule {}
