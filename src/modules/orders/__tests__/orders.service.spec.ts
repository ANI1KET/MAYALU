import { OrdersService } from '../orders.service';
import { OrdersRepository } from '../orders.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockAddress = { id: 'addr1', userId: 'u1', zone: 'inside_valley', fullName: 'Test', phone: '+977', addressLine: 'KTM', city: 'KTM', district: 'KTM', pincode: null, landmark: null };
const mockVariant = { id: 'v1', sku: 'SKU1', name: 'Red-L', price: '1299', isActive: true, product: { id: 'p1', name: 'Kurti', status: 'active', shopId: 's1' }, attributeValues: [] };
const mockCartItem = { id: 'ci1', quantity: 2, priceSnapshot: '1299', variantId: 'v1', variant: mockVariant };
const mockCart = { id: 'cart1', userId: 'u1', items: [mockCartItem] };
const mockOrder = { id: 'ord1', orderNumber: 'MW-2025-123456', userId: 'u1', status: 'pending' };
const mockInventory = { id: 'inv1', variantId: 'v1', quantityOnHand: 10, quantityReserved: 0, quantityAvailable: 10, allowBackorder: false };

const makeDb = () => ({
  query: {
    addresses: { findFirst: jest.fn().mockResolvedValue(mockAddress) },
    carts: { findFirst: jest.fn().mockResolvedValue(mockCart) },
    inventory: { findFirst: jest.fn().mockResolvedValue(mockInventory) },
    coupons: { findFirst: jest.fn().mockResolvedValue(null) },
    couponUsages: { findMany: jest.fn().mockResolvedValue([]) },
    orders: { findFirst: jest.fn().mockResolvedValue(mockOrder), findMany: jest.fn().mockResolvedValue([]) },
    users: { findFirst: jest.fn().mockResolvedValue({ phone: '+977' }) },
    productVariants: { findFirst: jest.fn() },
  },
  insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockOrder]) }) }),
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) }),
  delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
  execute: jest.fn().mockResolvedValue({ rows: [{ count: '1' }] }),
  transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const txDb = {
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockOrder]) }) }),
      update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) }),
      delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      query: { inventory: { findFirst: jest.fn().mockResolvedValue(mockInventory) } },
    };
    return fn(txDb);
  }),
});

const mockSms = { sendOrderConfirmation: jest.fn().mockResolvedValue(undefined) };

describe('OrdersService', () => {
  let service: OrdersService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    const ordersRepository = new OrdersRepository(db as never);
    service = new OrdersService(ordersRepository, mockSms as never);
  });

  it('placeOrder: throws NotFoundException when address not found', async () => {
    db.query.addresses.findFirst.mockResolvedValue(null);
    await expect(service.placeOrder('u1', { addressId: 'bad', paymentMethod: 'cod' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ADDRESS_NOT_FOUND' }),
    });
  });

  it('placeOrder: throws BadRequestException EMPTY_CART when no cart', async () => {
    db.query.carts.findFirst.mockResolvedValue(null);
    await expect(service.placeOrder('u1', { addressId: 'addr1', paymentMethod: 'cod' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EMPTY_CART' }),
    });
  });

  it('placeOrder: throws BadRequestException when cart is empty', async () => {
    db.query.carts.findFirst.mockResolvedValue({ ...mockCart, items: [] });
    await expect(service.placeOrder('u1', { addressId: 'addr1', paymentMethod: 'cod' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EMPTY_CART' }),
    });
  });

  it('placeOrder: throws BadRequestException when product is unavailable', async () => {
    db.query.carts.findFirst.mockResolvedValue({
      ...mockCart,
      items: [{ ...mockCartItem, variant: { ...mockVariant, product: { ...mockVariant.product, status: 'draft' } } }],
    });
    await expect(service.placeOrder('u1', { addressId: 'addr1', paymentMethod: 'cod' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ITEMS_UNAVAILABLE' }),
    });
  });

  it('placeOrder: throws BadRequestException INSUFFICIENT_STOCK', async () => {
    db.query.inventory.findFirst.mockResolvedValue({ ...mockInventory, quantityAvailable: 0 });
    await expect(service.placeOrder('u1', { addressId: 'addr1', paymentMethod: 'cod' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ITEMS_UNAVAILABLE' }),
    });
  });

  it('placeOrder: success — uses transaction', async () => {
    const result = await service.placeOrder('u1', { addressId: 'addr1', paymentMethod: 'cod' });
    expect(db.transaction).toHaveBeenCalled();
    expect(result.orderNumber).toBeDefined();
  });

  it('placeOrder: SMS is sent after transaction (async)', async () => {
    await service.placeOrder('u1', { addressId: 'addr1', paymentMethod: 'cod' });
    // SMS is fired async - wait a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSms.sendOrderConfirmation).toHaveBeenCalled();
  });
});
