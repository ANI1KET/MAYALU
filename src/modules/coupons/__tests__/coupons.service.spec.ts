import { CouponsService } from '../coupons.service';
import { BadRequestException } from '@nestjs/common';

const baseCoupon = {
  id: 'c1', code: 'SAVE10', isActive: true,
  discountType: 'percentage', discountValue: '10',
  minOrderAmount: '500', maxDiscount: '200',
  usageLimitTotal: 100, usageCount: 0,
  usageLimitPerUser: 1,
  startsAt: null, expiresAt: null,
};

const makeRepo = (coupon = baseCoupon, userUsages: unknown[] = []) => ({
  findActiveByCode: jest.fn().mockResolvedValue(coupon),
  findUsagesByCouponAndUser: jest.fn().mockResolvedValue(userUsages),
});

describe('CouponsService', () => {
  let service: CouponsService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new CouponsService(repo as never);
  });

  it('throws COUPON_NOT_FOUND when code is not found or inactive', async () => {
    repo.findActiveByCode.mockResolvedValue(null);
    await expect(service.validate('BADCODE', 'u1', 1000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_NOT_FOUND' }),
    });
  });

  it('throws COUPON_EXPIRED when expiresAt is in the past', async () => {
    repo.findActiveByCode.mockResolvedValue({
      ...baseCoupon, expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.validate('SAVE10', 'u1', 1000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_EXPIRED' }),
    });
  });

  it('throws COUPON_NOT_STARTED when startsAt is in the future', async () => {
    repo.findActiveByCode.mockResolvedValue({
      ...baseCoupon, startsAt: new Date(Date.now() + 86400000),
    });
    await expect(service.validate('SAVE10', 'u1', 1000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_NOT_STARTED' }),
    });
  });

  it('throws COUPON_EXHAUSTED when usageCount >= usageLimitTotal', async () => {
    repo.findActiveByCode.mockResolvedValue({ ...baseCoupon, usageCount: 100, usageLimitTotal: 100 });
    await expect(service.validate('SAVE10', 'u1', 1000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_EXHAUSTED' }),
    });
  });

  it('throws MIN_ORDER_REQUIRED when order is below minimum', async () => {
    await expect(service.validate('SAVE10', 'u1', 300)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MIN_ORDER_REQUIRED' }),
    });
  });

  it('throws COUPON_ALREADY_USED when user has used coupon max times', async () => {
    repo.findUsagesByCouponAndUser.mockResolvedValue([{ id: 'cu1' }]); // 1 usage, limit=1
    await expect(service.validate('SAVE10', 'u1', 1000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_ALREADY_USED' }),
    });
  });

  it('calculates percentage discount correctly', async () => {
    const result = await service.validate('SAVE10', 'u1', 1000);
    // 10% of 1000 = 100, capped at maxDiscount=200
    expect(result.discountAmount).toBe(100);
  });

  it('caps percentage discount at maxDiscount', async () => {
    repo.findActiveByCode.mockResolvedValue({ ...baseCoupon, discountValue: '30', maxDiscount: '150' });
    const result = await service.validate('SAVE10', 'u1', 1000);
    // 30% of 1000 = 300, capped at 150
    expect(result.discountAmount).toBe(150);
  });

  it('calculates fixed discount correctly', async () => {
    repo.findActiveByCode.mockResolvedValue({
      ...baseCoupon, discountType: 'fixed', discountValue: '100', maxDiscount: null,
    });
    const result = await service.validate('FLAT100', 'u1', 1000);
    expect(result.discountAmount).toBe(100);
  });

  it('caps fixed discount at order amount', async () => {
    repo.findActiveByCode.mockResolvedValue({
      ...baseCoupon, discountType: 'fixed', discountValue: '2000', maxDiscount: null, minOrderAmount: null,
    });
    const result = await service.validate('BIGFLAT', 'u1', 800);
    expect(result.discountAmount).toBe(800);
  });
});
