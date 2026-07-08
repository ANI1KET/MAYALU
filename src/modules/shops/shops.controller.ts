import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public } from '../../common/decorators/index';
import { ShopDto, ShopSubscriptionDto, ShopUsageDto, ShopMemberDto } from '../../common/swagger/response.dto';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

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
  @ApiCreatedEnvelope(ShopDto, 'Shop created successfully')
  @ApiStandardErrors({
    badRequest: 'PHONE_NOT_VERIFIED — verify phone before creating shop',
    conflict: 'SHOP_ALREADY_EXISTS | SLUG_TAKEN',
  })
  create(@Body() dto: CreateShopDto, @CurrentUser() user: { sub: string }) {
    return this.shopsService.create(user.sub, dto);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get public shop profile by slug' })
  @ApiParam({ name: 'slug', example: 'sita-fashion-house' })
  @ApiOkEnvelope(ShopDto, 'Shop public profile')
  @ApiStandardErrors({ auth: false, notFound: 'Shop' })
  findBySlug(@Param('slug') slug: string) {
    return this.shopsService.findBySlug(slug);
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  @ApiCookieAuth('access_token')
  @ApiBody({ type: UpdateShopDto })
  @ApiOperation({ summary: 'Update shop details (owner/manager only)' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkEnvelope(ShopDto, 'Shop updated')
  @ApiStandardErrors({ badRequest: true, notFound: 'Shop', forbidden: 'INSUFFICIENT_PERMISSIONS' })
  update(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopsService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @Get(':id/subscription')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get shop current subscription & plan limits' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkEnvelope(ShopSubscriptionDto, 'Subscription details')
  @ApiStandardErrors({ notFound: 'Subscription' })
  getSubscription(@Param('id') id: string) {
    return this.shopsService.getSubscription(id);
  }

  @UseGuards(AuthGuard)
  @Get(':id/usage')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get shop resource usage (products, variants, storage)' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkEnvelope(ShopUsageDto, 'Resource usage counters')
  @ApiStandardErrors({ notFound: 'Usage' })
  getUsage(@Param('id') id: string) {
    return this.shopsService.getUsage(id);
  }

  @UseGuards(AuthGuard)
  @Get(':id/members')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List shop team members' })
  @ApiParam({ name: 'id', description: 'Shop UUID' })
  @ApiOkEnvelope([ShopMemberDto], 'Shop members list')
  @ApiStandardErrors()
  getMembers(@Param('id') id: string) {
    return this.shopsService.getMembers(id);
  }
}
