import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiQuery,
} from '@nestjs/swagger';
import { BannerDto } from '../../common/swagger/response.dto';
import { Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { BannersService } from './banners.service';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get active banners',
    description: 'Returns active banners filtered by time window (startsAt/endsAt). Pass `position` to filter by placement. Pass `shopId` to include shop-specific banners.',
  })
  @ApiQuery({ name: 'position', required: false, enum: ['hero', 'category', 'promo'] })
  @ApiQuery({ name: 'shopId', required: false, description: 'Include shop-specific banners' })
  @ApiOkEnvelope([BannerDto], 'Active banners sorted by sortOrder')
  @ApiStandardErrors({ auth: false })
  getActiveBanners(
    @Query('position') position?: 'hero' | 'category' | 'promo',
    @Query('shopId') shopId?: string,
  ) {
    return this.bannersService.getActiveBanners(position, shopId);
  }
}
