import {
  Controller, Get, Post, Param, Body, Query, UseGuards, Module,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam, ApiQuery,
  ApiCreatedResponse, ApiOkResponse, ApiBadRequestResponse,
  ApiNotFoundResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  PlaceOrderResponseDto, OrderListResponseDto, OrderDto, ErrorResponseDto,
} from '../../common/swagger/response.dto';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { SmsService } from '../../common/services/sms.service';
import { JwtService } from '../../common/services/jwt.service';
import { PlaceOrderDto, OrderFilterDto } from './dto/order.dto';

@ApiTags('Orders')
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiBody({ type: PlaceOrderDto })
  @ApiOperation({
    summary: 'Place order',
    description:
      'Fully atomic transaction: validates delivery serviceability, detects stale prices, ' +
      'deducts inventory with row-level lock (prevents overselling), ' +
      'increments coupon usage atomically, clears cart, sends SMS confirmation. ' +
      'Returns `stalePriceWarnings` array if any prices changed since items were added to cart.',
  })
  @ApiCreatedResponse({ type: PlaceOrderResponseDto, description: 'Order placed successfully' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'EMPTY_CART | ITEMS_UNAVAILABLE | DELIVERY_UNSERVICEABLE | COD_NOT_AVAILABLE | ' +
      'INSUFFICIENT_STOCK | COUPON_NOT_FOUND | COUPON_EXPIRED | COUPON_EXHAUSTED | ' +
      'COUPON_USER_LIMIT | COUPON_MIN_ORDER',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ADDRESS_NOT_FOUND' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  placeOrder(@CurrentUser() user: { sub: string }, @Body() dto: PlaceOrderDto) {
    return this.ordersService.placeOrder(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my orders with pagination' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending','confirmed','packed','shipped','delivered','cancelled','returned'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: OrderListResponseDto, description: 'Paginated order list' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getOrders(@CurrentUser() user: { sub: string }, @Query() filter: OrderFilterDto) {
    return this.ordersService.getOrders(user.sub, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail with items and full status history' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiOkResponse({ type: OrderDto, description: 'Full order detail' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ORDER_NOT_FOUND' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getOrderDetail(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.ordersService.getOrderDetail(id, user.sub);
  }
}

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, SmsService, JwtService],
  exports: [OrdersService],
})
export class OrdersModule {}
