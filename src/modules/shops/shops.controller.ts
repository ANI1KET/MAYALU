import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse,
  ApiUnauthorizedResponse, ApiForbiddenResponse,
  ApiNotFoundResponse, ApiConflictResponse,
} from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import {
  ShopDto, ShopSubscriptionDto, ShopUsageDto, ShopMemberDto,
  MessageResponseDto, ErrorResponseDto,
} from '../../common/swagger/response.dto';

@ApiTags('Shops')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @UseGuards(AuthGuard)
  @Post()
  @ApiCookieAuth('access_token')
  @ApiBody({ type: CreateShopDto })
  @ApiOperation({
    summary: 'Register a new shop',
    description: 'Creates a shop and assigns the authenticated user as owner. Starts a Starter plan trial.',
  })
  @ApiCreatedResponse({ type: ShopDto, description: 'Shop created successfully' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'PHONE_NOT_VERIFIED — verify phone before creating shop' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'SHOP_ALREADY_EXISTS | SLUG_TAKEN' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  create(@Body() dto: CreateShopDto, @CurrentUser() user: { sub: string }) {
    return this.shopsService.create(user.sub, dto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public shop profile by slug' })
  @ApiParam({ name: 'slug', example: 'sita-fashion-house' })
  @ApiOkResponse({ type: ShopDto, description: 'Shop public profile' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'SHOP_NOT_FOUND' })
  findBySlug(@Param('slug') slug: string) {
    return this.shopsService.findBySlug(slug);
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  @ApiCookieAuth('access_token')
  @ApiBody({ type: UpdateShopDto })
  @ApiOperation({ summary: 'Update shop details (owner/manager only)' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkResponse({ type: ShopDto, description: 'Shop updated' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'SHOP_NOT_FOUND' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'INSUFFICIENT_PERMISSIONS' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  update(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopsService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @Get(':id/subscription')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get shop current subscription & plan limits' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkResponse({ type: ShopSubscriptionDto, description: 'Subscription details' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'SHOP_NOT_FOUND' })
  getSubscription(@Param('id') id: string) {
    return this.shopsService.getSubscription(id);
  }

  @UseGuards(AuthGuard)
  @Get(':id/usage')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get shop resource usage (products, variants, storage)' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkResponse({ type: ShopUsageDto, description: 'Resource usage counters' })
  getUsage(@Param('id') id: string) {
    return this.shopsService.getUsage(id);
  }

  @UseGuards(AuthGuard)
  @Get(':id/members')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List shop team members' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkResponse({ type: [ShopMemberDto], description: 'Shop members list' })
  getMembers(@Param('id') id: string) {
    return this.shopsService.getMembers(id);
  }
}
