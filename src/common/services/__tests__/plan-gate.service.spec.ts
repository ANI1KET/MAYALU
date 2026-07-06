import { PlanGateService } from '../../services/plan-gate.service';
import { ForbiddenException } from '@nestjs/common';

const baseLimits = {
  maxProducts: 50, maxVariantsPerProduct: 10,
  maxWarehouses: 1, maxStaffMembers: 1,
};

const makeDb = (totalProducts = 0) => ({
  query: {
    shopResourceUsage: {
      findFirst: jest.fn().mockResolvedValue(
        totalProducts === -1
          ? null
          : { shopId: 's1', totalProducts, totalVariants: 0, totalStaffMembers: 1 }
      ),
    },
  },
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn() }) }),
});

describe('PlanGateService', () => {
  let service: PlanGateService;

  it('passes when current < max', async () => {
    const db = makeDb(10);
    service = new PlanGateService(db as never);
    await expect(service.assertLimit('s1', 'products', baseLimits)).resolves.toBeUndefined();
  });

  it('throws ForbiddenException when current >= max', async () => {
    const db = makeDb(50);
    service = new PlanGateService(db as never);
    await expect(service.assertLimit('s1', 'products', baseLimits)).rejects.toThrow(ForbiddenException);
  });

  it('throws with PLAN_LIMIT_REACHED code', async () => {
    const db = makeDb(50);
    service = new PlanGateService(db as never);
    await expect(service.assertLimit('s1', 'products', baseLimits)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLAN_LIMIT_REACHED' }),
    });
  });

  it('never queries DB when max = -1 (unlimited)', async () => {
    const db = makeDb(9999);
    service = new PlanGateService(db as never);
    await service.assertLimit('s1', 'products', { ...baseLimits, maxProducts: -1 });
    expect(db.query.shopResourceUsage.findFirst).not.toHaveBeenCalled();
  });

  it('treats missing usage row as 0 and passes', async () => {
    const db = makeDb(-1); // returns null
    service = new PlanGateService(db as never);
    await expect(service.assertLimit('s1', 'products', baseLimits)).resolves.toBeUndefined();
  });

  it('passes when current is exactly one below the limit', async () => {
    const db = makeDb(49);
    service = new PlanGateService(db as never);
    await expect(service.assertLimit('s1', 'products', baseLimits)).resolves.toBeUndefined();
  });
});
