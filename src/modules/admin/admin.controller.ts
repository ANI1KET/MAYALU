import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  AdminDashboardDto, OrderListResponseDto, OrderDto, ShopDto,
  BannerDto, ReviewDto,
} from '../../common/swagger/response.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiOkEnvelopeSchema, ApiCreatedEnvelopeSchema, ApiStandardErrors, ApiUnauthorized } from '../../common/decorators/api-responses.decorator';
import { AdminService } from './admin.service';
import { UpdateOrderStatusDto, CreateCouponDto, CreateBannerDto, UpdateShopStatusDto } from './dto/admin.dto';

@ApiTags('Admin')
@Public()
@UseGuards(AdminGuard)
@ApiSecurity('X-Admin-Key')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: '[Admin] Platform dashboard stats',
    description: 'Approximate counts via pg_stat_user_tables (O(1) — no full table scans). Pending orders is always exact.',
  })
  @ApiOkEnvelope(AdminDashboardDto, 'Platform-wide metrics')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false })
  getDashboard() { return this.adminService.getDashboard(); }

  @Get('orders')
  @ApiOperation({ summary: '[Admin] List all orders across all shops' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending','confirmed','packed','shipped','delivered','cancelled','returned'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkEnvelope(OrderListResponseDto, 'All orders paginated')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, badRequest: true })
  getOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) { return this.adminService.getOrders(page, limit, status); }

  @Patch('orders/:id/status')
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOperation({
    summary: '[Admin] Update order status',
    description: 'Appends to status history. Sends SMS confirmation when status changes to "shipped". Note: the service does not currently validate status transition order — any enum value is accepted for any current status.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiOkEnvelope(OrderDto, 'Updated order')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, badRequest: true, notFound: 'Order' })
  updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrderStatus(id, dto);
  }

  @Get('shops')
  @ApiOperation({ summary: '[Admin] List all shops with plan and verification status' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending','active','suspended','rejected'] })
  @ApiOkEnvelope([ShopDto], 'Shops list')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, badRequest: true })
  getShops(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getShops(page, limit);
  }

  @Patch('shops/:id/status')
  @ApiBody({ type: UpdateShopStatusDto })
  @ApiOperation({ summary: '[Admin] Approve, suspend or reject a shop' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkEnvelope(ShopDto, 'Updated shop')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, badRequest: true, notFound: 'Shop' })
  updateShopStatus(@Param('id') id: string, @Body() dto: UpdateShopStatusDto) {
    return this.adminService.updateShopStatus(id, dto);
  }

  @Post('coupons')
  @ApiBody({ type: CreateCouponDto })
  @ApiOperation({ summary: '[Admin] Create platform-wide coupon' })
  @ApiCreatedEnvelopeSchema(
    { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, code: { type: 'string', example: 'DASHAIN30' } } },
    'Coupon created',
  )
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, badRequest: true })
  createCoupon(@Body() dto: CreateCouponDto) { return this.adminService.createCoupon(dto); }

  @Patch('coupons/:id/toggle')
  @ApiOperation({ summary: '[Admin] Toggle coupon active/inactive' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  @ApiOkEnvelopeSchema(
    { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, code: { type: 'string' }, isActive: { type: 'boolean' } } },
    'Coupon state toggled — returns the updated coupon row',
  )
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, notFound: 'Coupon' })
  toggleCoupon(@Param('id') id: string) { return this.adminService.toggleCoupon(id); }

  @Post('banners')
  @ApiBody({ type: CreateBannerDto })
  @ApiOperation({ summary: '[Admin] Create banner' })
  @ApiCreatedEnvelope(BannerDto, 'Banner created')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, badRequest: true })
  createBanner(@Body() dto: CreateBannerDto) { return this.adminService.createBanner(dto); }

  @Patch('banners/:id/toggle')
  @ApiOperation({ summary: '[Admin] Toggle banner active/inactive' })
  @ApiParam({ name: 'id', description: 'Banner UUID' })
  @ApiOkEnvelope(BannerDto, 'Banner state toggled')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, notFound: 'Banner' })
  toggleBanner(@Param('id') id: string) { return this.adminService.toggleBanner(id); }

  @Get('reviews/pending')
  @ApiOperation({ summary: '[Admin] Get reviews pending moderation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiOkEnvelope([ReviewDto], 'Pending reviews')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false })
  getPendingReviews(@Query('page') page?: number) {
    return this.adminService.getPendingReviews(page);
  }

  @Patch('reviews/:id/approve')
  @ApiOperation({
    summary: '[Admin] Approve review',
    description: 'Approves the review and atomically recalculates the product avgRating and totalReviews.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiOkEnvelope(ReviewDto, 'Approved review')
  @ApiUnauthorized('INVALID_ADMIN_KEY — missing or invalid X-Admin-Key header')
  @ApiStandardErrors({ auth: false, notFound: 'Review' })
  approveReview(@Param('id') id: string) { return this.adminService.approveReview(id); }
}
