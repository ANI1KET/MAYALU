import {
  Controller, Get, Post, Patch, Delete, Param, Body,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam,
} from '@nestjs/swagger';
import {
  CartResponseDto, CartItemDto, MessageResponseDto,
} from '../../common/swagger/response.dto';
import { CartService } from './cart.service';
import { CurrentUser } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { AddItemDto, UpdateItemDto } from './dto/cart.dto';

@ApiTags('Cart')
@ApiCookieAuth('access_token')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get cart with items, prices, and totals' })
  @ApiOkEnvelope(CartResponseDto, 'Current cart contents')
  @ApiStandardErrors()
  getCart(@CurrentUser() user: { sub: string }) {
    return this.cartService.getCartWithItems(user.sub);
  }

  @Post('items')
  @ApiBody({ type: AddItemDto })
  @ApiOperation({
    summary: 'Add item to cart',
    description: 'Checks stock availability. Merges quantity if variant already in cart. Max 99 per item.',
  })
  @ApiCreatedEnvelope(CartItemDto, 'Item added/updated in cart')
  @ApiStandardErrors({
    badRequest: 'PRODUCT_UNAVAILABLE | INSUFFICIENT_STOCK',
    notFound: 'Variant',
  })
  addItem(@CurrentUser() user: { sub: string }, @Body() dto: AddItemDto) {
    return this.cartService.addItem(user.sub, dto.variantId, dto.quantity);
  }

  @Patch('items/:itemId')
  @ApiBody({ type: UpdateItemDto })
  @ApiOperation({ summary: 'Update item quantity', description: 'Re-validates stock on every update.' })
  @ApiParam({ name: 'itemId', description: 'Cart item UUID' })
  @ApiOkEnvelope(CartItemDto, 'Updated cart item')
  @ApiStandardErrors({
    badRequest: 'INSUFFICIENT_STOCK',
    notFound: 'Item',
  })
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
  @ApiOkEnvelope(MessageResponseDto, 'Item removed')
  @ApiStandardErrors()
  removeItem(@CurrentUser() user: { sub: string }, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(user.sub, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiOkEnvelope(MessageResponseDto, 'Cart cleared')
  @ApiStandardErrors()
  clearCart(@CurrentUser() user: { sub: string }) {
    return this.cartService.clearCart(user.sub);
  }
}
