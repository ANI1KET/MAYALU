import { CartService } from '../cart.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockVariant = {
  id: 'v1', sku: 'SKU-001', name: 'Red-L', price: '1299', isActive: true,
  product: { id: 'p1', name: 'Kurti', status: 'active', shopId: 's1' },
};
const mockCart = { id: 'cart1', userId: 'u1', items: [] };
const mockInventory = { id: 'inv1', variantId: 'v1', quantityOnHand: 10, quantityReserved: 0, quantityAvailable: 10, allowBackorder: false };

const makeDb = () => ({
  query: {
    carts: { findFirst: jest.fn() },
    cartItems: { findFirst: jest.fn().mockResolvedValue(null) },
    productVariants: { findFirst: jest.fn() },
    inventory: { findFirst: jest.fn() },
  },
  insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'item1', quantity: 1 }]) }) }),
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'item1', quantity: 2 }]) }) }) }),
  delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
});

describe('CartService', () => {
  let service: CartService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new CartService(db as never);
    db.query.carts.findFirst.mockResolvedValue({ ...mockCart, items: [] });
    db.query.productVariants.findFirst.mockResolvedValue(mockVariant);
    db.query.inventory.findFirst.mockResolvedValue(mockInventory);
  });

  it('addItem: throws NotFoundException when variant not found', async () => {
    db.query.productVariants.findFirst.mockResolvedValue(null);
    await expect(service.addItem('u1', 'bad-variant', 1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VARIANT_NOT_FOUND' }),
    });
  });

  it('addItem: throws BadRequestException when product is inactive', async () => {
    db.query.productVariants.findFirst.mockResolvedValue({ ...mockVariant, product: { ...mockVariant.product, status: 'draft' } });
    await expect(service.addItem('u1', 'v1', 1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_UNAVAILABLE' }),
    });
  });

  it('addItem: throws BadRequestException INSUFFICIENT_STOCK', async () => {
    db.query.inventory.findFirst.mockResolvedValue({ ...mockInventory, quantityAvailable: 0 });
    await expect(service.addItem('u1', 'v1', 5)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    });
  });

  it('addItem: increments quantity if item exists in cart', async () => {
    db.query.cartItems.findFirst.mockResolvedValue({ id: 'ci1', quantity: 2, variantId: 'v1', cartId: 'cart1' });
    await service.addItem('u1', 'v1', 1);
    expect(db.update).toHaveBeenCalled();
  });

  it('updateItem: re-checks stock against new quantity', async () => {
    db.query.cartItems.findFirst.mockResolvedValue({ id: 'ci1', quantity: 1, variantId: 'v1', cartId: 'cart1' });
    db.query.inventory.findFirst.mockResolvedValue({ ...mockInventory, quantityAvailable: 2 });
    await expect(service.updateItem('u1', 'ci1', 10)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    });
  });

  it('removeItem: removes correctly', async () => {
    const result = await service.removeItem('u1', 'ci1');
    expect(result.removed).toBe(true);
  });

  it('clearCart: deletes all items', async () => {
    await service.clearCart('u1');
    expect(db.delete).toHaveBeenCalled();
  });
});
