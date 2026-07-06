import { ProductsService } from '../products.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

process.env['CLOUDINARY_CLOUD_NAME'] = 'test';
process.env['CLOUDINARY_API_KEY'] = 'test';
process.env['CLOUDINARY_API_SECRET'] = 'test';
process.env['ADMIN_SECRET_KEY'] = 'test-admin-key-16ch';

const mockProduct = { id: 'p1', shopId: 's1', name: 'Test Product', slug: 'test-product', status: 'draft' };
const mockVariant = { id: 'v1', productId: 'p1', sku: 'SKU-001', isActive: true };
const mockMedia = { id: 'm1', productId: 'p1', isPrimary: true };

const makePlanGate = () => ({
  assertLimit: jest.fn().mockResolvedValue(undefined),
  incrementUsage: jest.fn().mockResolvedValue(undefined),
  decrementUsage: jest.fn().mockResolvedValue(undefined),
});

const makeMedia = () => ({
  generatePresignedUpload: jest.fn().mockReturnValue({ uploadUrl: 'https://cloudinary.com', publicId: 'pub1' }),
  getStorageMbFromBytes: jest.fn().mockReturnValue(0.5),
});

const makeCategories = () => ({
  findById: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Women' }),
  getSubtreeIds: jest.fn().mockResolvedValue(['cat1']),
});

const makeDb = () => ({
  query: {
    products: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    productVariants: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    productMedia: { findMany: jest.fn().mockResolvedValue([]) },
    shopSubscriptions: { findFirst: jest.fn().mockResolvedValue({ planFeaturesSnapshot: { maxProducts: 50, maxVariantsPerProduct: 10 } }) },
    productViews: { insert: jest.fn() },
  },
  insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockProduct]) }) }),
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockProduct]) }) }) }),
  delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
  execute: jest.fn().mockResolvedValue({ rows: [{ count: '0' }] }),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let db: ReturnType<typeof makeDb>;
  let planGate: ReturnType<typeof makePlanGate>;

  beforeEach(() => {
    db = makeDb();
    planGate = makePlanGate();
    service = new ProductsService(db as never, planGate as never, makeMedia() as never, makeCategories() as never);
    jest.clearAllMocks();
  });

  it('create: plan limit is checked before insert', async () => {
    db.query.products.findFirst.mockResolvedValue(null);
    await service.create('s1', { name: 'Kurti', slug: 'kurti-1' });
    expect(planGate.assertLimit).toHaveBeenCalledWith('s1', 'products', expect.any(Object));
  });

  it('create: throws ForbiddenException when PLAN_LIMIT_REACHED', async () => {
    const { ForbiddenException } = require('@nestjs/common');
    planGate.assertLimit.mockRejectedValue(new ForbiddenException({ code: 'PLAN_LIMIT_REACHED' }));
    await expect(service.create('s1', { name: 'P', slug: 's' })).rejects.toThrow(ForbiddenException);
  });

  it('create: throws NotFoundException when category not found', async () => {
    makeCategories().findById.mockRejectedValue(new NotFoundException('not found'));
    const cats = makeCategories();
    cats.findById.mockRejectedValue(new NotFoundException('Category not found'));
    service = new ProductsService(db as never, planGate as never, makeMedia() as never, cats as never);
    await expect(service.create('s1', { name: 'P', slug: 's', categoryId: 'bad-cat' })).rejects.toThrow(NotFoundException);
  });

  it('findOne: returns product when found in shop', async () => {
    db.query.products.findFirst.mockResolvedValue({ ...mockProduct, media: [], variants: [], category: null, tags: [] });
    const result = await service.findOne('p1', 's1');
    expect(result.id).toBe('p1');
  });

  it('findOne: throws NotFoundException when product not in shop', async () => {
    db.query.products.findFirst.mockResolvedValue(null);
    await expect(service.findOne('p1', 'other-shop')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_NOT_FOUND' }),
    });
  });

  it('publish: throws BadRequestException NO_IMAGES when no media', async () => {
    db.query.products.findFirst.mockResolvedValue({ ...mockProduct, media: [], variants: [mockVariant] });
    await expect(service.publish('p1', 's1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NO_IMAGES' }),
    });
  });

  it('publish: throws BadRequestException NO_VARIANTS when no active variants', async () => {
    db.query.products.findFirst.mockResolvedValue({ ...mockProduct, media: [mockMedia], variants: [] });
    await expect(service.publish('p1', 's1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NO_VARIANTS' }),
    });
  });

  it('remove: throws BadRequestException NOT_DRAFT for non-draft products', async () => {
    db.query.products.findFirst.mockResolvedValue({ ...mockProduct, status: 'active' });
    await expect(service.remove('p1', 's1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOT_DRAFT' }),
    });
  });

  it('remove: deletes successfully for draft products', async () => {
    db.query.products.findFirst.mockResolvedValue({ ...mockProduct, status: 'draft' });
    const result = await service.remove('p1', 's1');
    expect(result.deleted).toBe(true);
  });
});
