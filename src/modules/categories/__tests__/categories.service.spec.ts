import { CategoriesService } from '../categories.service';
import { NotFoundException } from '@nestjs/common';

const flatCats = [
  { id: 'c1', parentId: null, path: 'women', name: 'Women', slug: 'women', level: 0, imageUrl: null, sortOrder: 1, isActive: true, children: [] },
  { id: 'c2', parentId: 'c1', path: 'women.kurti', name: 'Kurti', slug: 'kurti', level: 1, imageUrl: null, sortOrder: 1, isActive: true, children: [] },
  { id: 'c3', parentId: 'c1', path: 'women.saree', name: 'Saree', slug: 'saree', level: 1, imageUrl: null, sortOrder: 2, isActive: true, children: [] },
  { id: 'c4', parentId: null, path: 'men', name: 'Men', slug: 'men', level: 0, imageUrl: null, sortOrder: 2, isActive: true, children: [] },
];

const makeDb = () => ({
  query: {
    categories: {
      findMany: jest.fn().mockResolvedValue(flatCats),
      findFirst: jest.fn().mockResolvedValue(flatCats[0]),
    },
  },
  execute: jest.fn().mockResolvedValue({ rows: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] }),
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new CategoriesService(db as never);
  });

  it('buildTree: nests children correctly under parent', () => {
    const tree = service.buildTree(flatCats as never);
    expect(tree).toHaveLength(2); // women + men
    const women = tree.find((n) => n.slug === 'women');
    expect(women?.children).toHaveLength(2); // kurti + saree
  });

  it('buildTree: root nodes have no parent', () => {
    const tree = service.buildTree(flatCats as never);
    expect(tree.every((n) => n.level === 0)).toBe(true);
  });

  it('findBySlug: returns category when found', async () => {
    const result = await service.findBySlug('women');
    expect(result?.slug).toBe('women');
  });

  it('findBySlug: throws NotFoundException when not found', async () => {
    db.query.categories.findFirst.mockResolvedValue(null);
    await expect(service.findBySlug('no-cat')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
    });
  });

  it('getSubtreeIds: returns IDs using ltree query', async () => {
    const ids = await service.getSubtreeIds('c1');
    expect(ids).toEqual(['c1', 'c2', 'c3']);
  });
});
