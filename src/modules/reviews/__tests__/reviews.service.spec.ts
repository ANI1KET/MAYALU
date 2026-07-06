import { ReviewsService } from '../reviews.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockOrder = { id: 'ord1', userId: 'u1', status: 'delivered' };
const mockOrderItem = { id: 'oi1', orderId: 'ord1', variantId: 'v1' };
const mockVariant = { id: 'v1', productId: 'p1' };
const mockProduct = { id: 'p1', shopId: 's1', name: 'Kurti' };
const mockReview = { id: 'rev1', productId: 'p1', userId: 'u1', rating: 5, status: 'pending' };

const makeDb = () => ({
  query: {
    orders: { findFirst: jest.fn().mockResolvedValue(mockOrder) },
    orderItems: { findFirst: jest.fn().mockResolvedValue(mockOrderItem) },
    productVariants: { findFirst: jest.fn().mockResolvedValue(mockVariant) },
    products: { findFirst: jest.fn().mockResolvedValue(mockProduct) },
    reviews: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
  },
  insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockReview]) }) }),
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) }),
  execute: jest.fn().mockResolvedValue({ rows: [{ avg_rating: '5.00', total_reviews: '1' }] }),
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new ReviewsService(db as never);
  });

  it('throws ORDER_NOT_DELIVERED when order is not delivered', async () => {
    db.query.orders.findFirst.mockResolvedValue({ ...mockOrder, status: 'shipped' });
    await expect(service.create('u1', 'p1', { orderId: 'ord1', rating: 5 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORDER_NOT_DELIVERED' }),
    });
  });

  it('throws ORDER_NOT_DELIVERED when order belongs to different user', async () => {
    db.query.orders.findFirst.mockResolvedValue(null); // query filters by userId
    await expect(service.create('u2', 'p1', { orderId: 'ord1', rating: 5 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORDER_NOT_DELIVERED' }),
    });
  });

  it('throws PRODUCT_NOT_IN_ORDER when product variant does not match', async () => {
    db.query.productVariants.findFirst.mockResolvedValue({ id: 'v1', productId: 'other-product' });
    await expect(service.create('u1', 'p1', { orderId: 'ord1', rating: 4 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRODUCT_NOT_IN_ORDER' }),
    });
  });

  it('throws REVIEW_EXISTS when review already exists for this order', async () => {
    db.query.reviews.findFirst.mockResolvedValue(mockReview);
    await expect(service.create('u1', 'p1', { orderId: 'ord1', rating: 5 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_EXISTS' }),
    });
  });

  it('creates review and updates product avgRating on success', async () => {
    const result = await service.create('u1', 'p1', { orderId: 'ord1', rating: 5, comment: 'Great!' });
    expect(db.insert).toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalled(); // rating update
    expect(result.id).toBe('rev1');
  });
});
