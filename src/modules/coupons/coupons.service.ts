import { Injectable, BadRequestException } from '@nestjs/common';
import { CouponsRepository } from './coupons.repository';

@Injectable()
export class CouponsService {
  constructor(
    private readonly couponsRepository: CouponsRepository,
  ) {}

  async validate(code: string, userId: string, orderAmount: number) {
    const coupon = await this.couponsRepository.findActiveByCode(code.toUpperCase());

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

    const userUsages = await this.couponsRepository.findUsagesByCouponAndUser(coupon.id, userId);

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
