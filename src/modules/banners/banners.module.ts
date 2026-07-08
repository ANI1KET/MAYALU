import { Injectable, Inject, Module, Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiQuery,
} from '@nestjs/swagger';
import { BannerDto } from '../../common/swagger/response.dto';
import { eq, and, or, isNull, lte, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

@Injectable()
export class BannersService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getActiveBanners(position?: 'hero' | 'category' | 'promo', shopId?: string) {
    const now = new Date();

    return this.db.query.banners.findMany({
      where: and(
        eq(schema.banners.isActive, true),
        position ? eq(schema.banners.position, position) : undefined,
        shopId
          ? or(eq(schema.banners.shopId, shopId), isNull(schema.banners.shopId))
          : isNull(schema.banners.shopId),
        or(isNull(schema.banners.startsAt), lte(schema.banners.startsAt, now)),
        or(isNull(schema.banners.endsAt), gte(schema.banners.endsAt, now)),
      ),
      orderBy: (b, { asc }) => [asc(b.sortOrder)],
    });
  }
}

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

@Module({
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
