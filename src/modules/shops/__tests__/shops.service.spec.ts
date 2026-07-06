import { ShopsService } from '../shops.service';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';

const mockUser = { id: 'u1', phone: '+977', isPhoneVerified: true, status: 'active' };
const mockShop = { id: 's1', name: 'Test Shop', slug: 'test-shop', ownerUserId: 'u1', status: 'pending' };
const mockPlan = { id: 'p1', slug: 'starter', maxProducts: 50, maxVariantsPerProduct: 10, maxImagesPerProduct: 5, maxWarehouses: 1, maxStaffMembers: 1, storageGb: '2', canUseCod: true, canUseEsewa: false, canUseDiscounts: false, canUseAnalytics: false, commissionRate: '5' };

const makeDb = () => ({
  query: {
    users: { findFirst: jest.fn().mockResolvedValue(mockUser) },
    shops: { findFirst: jest.fn().mockResolvedValue(null) },
    plans: { findFirst: jest.fn().mockResolvedValue(mockPlan) },
    shopSubscriptions: { findFirst: jest.fn().mockResolvedValue(null) },
    shopResourceUsage: { findFirst: jest.fn() },
    shopMembers: { findMany: jest.fn().mockResolvedValue([]) },
  },
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockShop]) }),
  }),
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockShop]) }) }),
  transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const txDb = {
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockShop]) }) }),
    };
    return fn(txDb);
  }),
});

describe('ShopsService', () => {
  let service: ShopsService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new ShopsService(db as never);
  });

  it('create: throws ForbiddenException when phone not verified', async () => {
    db.query.users.findFirst.mockResolvedValue({ ...mockUser, isPhoneVerified: false });
    await expect(service.create('u1', { name: 'Shop', slug: 'shop', planSlug: 'starter' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PHONE_NOT_VERIFIED' }),
    });
  });

  it('create: throws ConflictException when user already has a shop', async () => {
    db.query.shops.findFirst.mockResolvedValue(mockShop);
    await expect(service.create('u1', { name: 'Shop', slug: 'shop' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SHOP_ALREADY_EXISTS' }),
    });
  });

  it('create: throws ConflictException when slug is taken', async () => {
    // First call (find by owner) returns null, second call (find by slug) returns a shop
    db.query.shops.findFirst
      .mockResolvedValueOnce(null)   // no existing shop for owner
      .mockResolvedValueOnce(mockShop); // slug is taken
    await expect(service.create('u1', { name: 'Shop', slug: 'test-shop' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLUG_TAKEN' }),
    });
  });

  it('create: throws NotFoundException when plan not seeded', async () => {
    db.query.shops.findFirst.mockResolvedValue(null);
    db.query.plans.findFirst.mockResolvedValue(null);
    await expect(service.create('u1', { name: 'Shop', slug: 'new-shop', planSlug: 'nonexistent' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLAN_NOT_FOUND' }),
    });
  });

  it('create: runs in transaction (shop + sub + member + usage)', async () => {
    db.query.shops.findFirst.mockResolvedValue(null);
    await service.create('u1', { name: 'My Shop', slug: 'my-shop' });
    expect(db.transaction).toHaveBeenCalled();
  });

  it('findBySlug: returns shop', async () => {
    db.query.shops.findFirst.mockResolvedValue(mockShop);
    const result = await service.findBySlug('test-shop');
    expect(result).toEqual(mockShop);
  });

  it('findBySlug: throws NotFoundException when shop not found', async () => {
    db.query.shops.findFirst.mockResolvedValue(null);
    await expect(service.findBySlug('no-such-shop')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SHOP_NOT_FOUND' }),
    });
  });
});
