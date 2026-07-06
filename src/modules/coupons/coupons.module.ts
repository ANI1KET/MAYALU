import {
  Injectable, Inject, BadRequestException, Module,
  Controller, Post, Body, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody,
  ApiOkResponse, ApiBadRequestResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CouponValidationResponseDto, ErrorResponseDto } from '../../common/swagger/response.dto';
import { IsString, IsNumber, Min } from 'class-validator';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';

class ValidateCouponDto {
  @IsString() code!: string;
  @IsNumber() @Min(0) orderAmount!: number;
}

@Injectable()
export class CouponsService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async validate(code: string, userId: string, orderAmount: number) {
    const coupon = await this.db.query.coupons.findFirst({
      where: and(eq(schema.coupons.code, code.toUpperCase()), eq(schema.coupons.isActive, true)),
    });

    if (!coupon) {
      throw new BadRequestException({ code: 'COUPON_NOT_FOUND', message: `Coupon "${code}" not found or inactive` });
    }

    const now = new Date();

    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException({ code: 'COUPON_NOT_STARTED', message: 'This coupon is not active yet' });
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException({ code: 'COUPON_EXPIRED', message: 'This coupon has expired' });
    }

    if (coupon.usageLimitTotal !== null && coupon.usageCount >= coupon.usageLimitTotal) {
      throw new BadRequestException({ code: 'COUPON_EXHAUSTED', message: 'This coupon has reached its usage limit' });
    }

    if (coupon.minOrderAmount && orderAmount < parseFloat(coupon.minOrderAmount)) {
      throw new BadRequestException({
        code: 'MIN_ORDER_REQUIRED',
        message: `Minimum order amount of NPR ${coupon.minOrderAmount} is required`,
        details: { required: parseFloat(coupon.minOrderAmount), provided: orderAmount },
      });
    }

    const userUsages = await this.db.query.couponUsages.findMany({
      where: and(eq(schema.couponUsages.couponId, coupon.id), eq(schema.couponUsages.userId, userId)),
    });

    if (userUsages.length >= coupon.usageLimitPerUser) {
      throw new BadRequestException({ code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon the maximum number of times' });
    }

    const discountValue = parseFloat(coupon.discountValue);
    let discountAmount: number;

    if (coupon.discountType === 'percentage') {
      discountAmount = (orderAmount * discountValue) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
      }
    } else {
      discountAmount = Math.min(discountValue, orderAmount);
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round((orderAmount - discountAmount) * 100) / 100,
    };
  }
}

@ApiTags('Coupons')
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate')
  @ApiBody({ schema: { type: 'object', required: ['code','orderAmount'], properties: {
    code: { type: 'string', example: 'SAVE10' },
    orderAmount: { type: 'number', example: 2598 },
  }}})
  @ApiOperation({
    summary: 'Validate coupon code',
    description: 'Validates the coupon against the order amount. Checks expiry, per-user limit, and global usage limit.',
  })
  @ApiOkResponse({ type: CouponValidationResponseDto, description: 'Valid coupon — discount calculated' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'COUPON_NOT_FOUND | COUPON_EXPIRED | COUPON_EXHAUSTED | COUPON_USER_LIMIT | COUPON_MIN_ORDER' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  validate(@CurrentUser() user: { sub: string }, @Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto.code, user.sub, dto.orderAmount);
  }
}

@Module({
  controllers: [CouponsController],
  providers: [CouponsService, JwtService],
  exports: [CouponsService],
})
export class CouponsModule {}
