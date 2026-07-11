import { CartService } from '../cart.service';

const mockVariant = {
  id: 'v1', sku: 'SKU-001', name: 'Red-L', price: '1299', isActive: true,
  product: { id: 'p1', name: 'Kurti', status: 'active', shopId: 's1' },
};
const mockCart = { id: 'cart1', userId: 'u1', items: [] };
const mockInventory = { id: 'inv1', variantId: 'v1', quantityOnHand: 10, quantityReserved: 0, quantityAvailable: 10, allowBackorder: false };

const makeRepo = () => ({
  findCartByUserId: jest.fn(),
  insertCart: jest.fn(),
  findVariantWithProduct: jest.fn(),
  findInventoryByVariantId: jest.fn(),
  findCartItem: jest.fn().mockResolvedValue(null),
  findCartItemById: jest.fn(),
  updateCartItemQuantity: jest.fn().mockResolvedValue({ id: 'item1', quantity: 2 }),
  updateCartTimestamp: jest.fn().mockResolvedValue(undefined),
  insertCartItem: jest.fn().mockResolvedValue({ id: 'item1', quantity: 1 }),
  deleteCartItemById: jest.fn().mockResolvedValue([]),
  deleteCartItemsByCartId: jest.fn().mockResolvedValue([]),
  findCartWithItemsDetailed: jest.fn(),
});

describe('CartService', () => {
  let service: CartService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new CartService(repo as never);
    repo.findCartByUserId.mockResolvedValue({ ...mockCart, items: [] });
    repo.findVariantWithProduct.mockResolvedValue(mockVariant);
    repo.findInventoryByVariantId.mockResolvedValue(mockInventory);
    repo.findCartItemById.mockResolvedValue({ id: 'ci1', quantity: 1, variantId: 'v1', cartId: 'cart1' });
  });

  it('addItem: throws NotFoundException when variant not found', async () => {
    repo.findVariantWithProduct.mockResolvedValue(null);
    await expect(service.addItem('u1', 'bad-variant', 1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VARIANT_NOT_FOUND' }),
    });
  });

  it('addItem: throws BadRequestException when product is inactive', async () => {
    repo.findVariantWithProduct.mockResolvedValue({ ...mockVariant, product: { ...mockVariant.product, status: 'draft' } });
    await expect(service.addItem('u1', 'v1', 1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_UNAVAILABLE' }),
    });
  });

  it('addItem: throws BadRequestException INSUFFICIENT_STOCK', async () => {
    repo.findInventoryByVariantId.mockResolvedValue({ ...mockInventory, quantityOnHand: 0, quantityReserved: 0 });
    await expect(service.addItem('u1', 'v1', 5)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    });
  });

  it('addItem: increments quantity if item exists in cart', async () => {
    repo.findCartItem.mockResolvedValue({ id: 'ci1', quantity: 2, variantId: 'v1', cartId: 'cart1' });
    await service.addItem('u1', 'v1', 1);
    expect(repo.updateCartItemQuantity).toHaveBeenCalled();
  });

  it('updateItem: re-checks stock against new quantity', async () => {
    repo.findCartItemById.mockResolvedValue({ id: 'ci1', quantity: 1, variantId: 'v1', cartId: 'cart1' });
    repo.findInventoryByVariantId.mockResolvedValue({ ...mockInventory, quantityOnHand: 2, quantityReserved: 0 });
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
    expect(repo.deleteCartItemsByCartId).toHaveBeenCalled();
  });
});
