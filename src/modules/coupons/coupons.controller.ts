import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { CouponValidationResponseDto } from '../../common/swagger/response.dto';
import { CurrentUser } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/coupons.dto';

@ApiTags('Coupons')
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
  @ApiOkEnvelope(CouponValidationResponseDto, 'Valid coupon — discount calculated')
  @ApiStandardErrors({
    badRequest:
      'COUPON_NOT_FOUND | COUPON_NOT_STARTED | COUPON_EXPIRED | COUPON_EXHAUSTED | ' +
      'MIN_ORDER_REQUIRED | COUPON_ALREADY_USED | VALIDATION_ERROR',
  })
  validate(@CurrentUser() user: { sub: string }, @Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto.code, user.sub, dto.orderAmount);
  }
}
