import { ShopsService } from '../shops.service';

const mockUser = { id: 'u1', phone: '+977', isPhoneVerified: true, status: 'active' };
const mockShop = { id: 's1', name: 'Test Shop', slug: 'test-shop', ownerUserId: 'u1', status: 'pending' };
const mockPlan = { id: 'p1', slug: 'starter', maxProducts: 50, maxVariantsPerProduct: 10, maxImagesPerProduct: 5, maxWarehouses: 1, maxStaffMembers: 1, storageGb: '2', canUseCod: true, canUseEsewa: false, canUseDiscounts: false, canUseAnalytics: false, commissionRate: '5' };

const makeRepository = () => ({
  findUserById: jest.fn().mockResolvedValue(mockUser),
  findShopByOwnerUserId: jest.fn().mockResolvedValue(null),
  findShopBySlug: jest.fn().mockResolvedValue(null),
  findPlanBySlug: jest.fn().mockResolvedValue(mockPlan),
  createShopWithSubscription: jest.fn().mockResolvedValue(mockShop),
  findShopBySlugWithRelations: jest.fn(),
  findShopById: jest.fn(),
  findShopByOwnerUserIdWithRelations: jest.fn(),
  updateShop: jest.fn(),
  findSubscriptionByShopId: jest.fn(),
  findUsageByShopId: jest.fn(),
  findMembersByShopId: jest.fn().mockResolvedValue([]),
});

describe('ShopsService', () => {
  let service: ShopsService;
  let repository: ReturnType<typeof makeRepository>;

  beforeEach(() => {
    repository = makeRepository();
    service = new ShopsService(repository as never);
  });

  it('create: throws ForbiddenException when phone not verified', async () => {
    repository.findUserById.mockResolvedValue({ ...mockUser, isPhoneVerified: false });
    await expect(service.create('u1', { name: 'Shop', slug: 'shop' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PHONE_NOT_VERIFIED' }),
    });
  });

  it('create: throws ConflictException when user already has a shop', async () => {
    repository.findShopByOwnerUserId.mockResolvedValue(mockShop);
    await expect(service.create('u1', { name: 'Shop', slug: 'shop' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SHOP_ALREADY_EXISTS' }),
    });
  });

  it('create: throws ConflictException when slug is taken', async () => {
    repository.findShopByOwnerUserId.mockResolvedValue(null);
    repository.findShopBySlug.mockResolvedValue(mockShop);
    await expect(service.create('u1', { name: 'Shop', slug: 'test-shop' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLUG_TAKEN' }),
    });
  });

  it('create: throws NotFoundException when plan not seeded', async () => {
    repository.findShopByOwnerUserId.mockResolvedValue(null);
    repository.findShopBySlug.mockResolvedValue(null);
    repository.findPlanBySlug.mockResolvedValue(null);
    await expect(service.create('u1', { name: 'Shop', slug: 'new-shop' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLAN_NOT_FOUND' }),
    });
  });

  it('create: runs createShopWithSubscription (shop + sub + member + usage)', async () => {
    repository.findShopByOwnerUserId.mockResolvedValue(null);
    repository.findShopBySlug.mockResolvedValue(null);
    await service.create('u1', { name: 'My Shop', slug: 'my-shop' });
    expect(repository.createShopWithSubscription).toHaveBeenCalled();
  });

  it('findBySlug: returns shop', async () => {
    repository.findShopBySlugWithRelations.mockResolvedValue(mockShop);
    const result = await service.findBySlug('test-shop');
    expect(result).toEqual(mockShop);
  });

  it('findBySlug: throws NotFoundException when shop not found', async () => {
    repository.findShopBySlugWithRelations.mockResolvedValue(null);
    await expect(service.findBySlug('no-such-shop')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SHOP_NOT_FOUND' }),
    });
  });
});
