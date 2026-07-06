import { AttributesService } from '../attributes.service';
import { NotFoundException } from '@nestjs/common';

const mockAttr = { id: 'a1', name: 'Color', code: 'color', inputType: 'color', isFilterable: true, options: [] };
const mockCatAttr = { categoryId: 'c1', attributeId: 'a1', isRequired: true, isVariantAttribute: true, sortOrder: 0 };

const makeDb = () => ({
  query: {
    attributes: {
      findMany: jest.fn().mockResolvedValue([mockAttr]),
      findFirst: jest.fn().mockResolvedValue(mockAttr),
    },
    categories: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'Kurti' }) },
    categoryAttributes: { findMany: jest.fn().mockResolvedValue([mockCatAttr]) },
  },
});

describe('AttributesService', () => {
  let service: AttributesService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new AttributesService(db as never);
  });

  it('findAll: returns attributes with options', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe('color');
  });

  it('findByCode: returns attribute by code', async () => {
    const result = await service.findByCode('color');
    expect(result.code).toBe('color');
  });

  it('findByCode: throws NotFoundException for unknown code', async () => {
    db.query.attributes.findFirst.mockResolvedValue(null);
    await expect(service.findByCode('nonexistent')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ATTRIBUTE_NOT_FOUND' }),
    });
  });

  it('getForCategory: throws NotFoundException for invalid categoryId', async () => {
    db.query.categories.findFirst.mockResolvedValue(null);
    await expect(service.getForCategory('bad-cat')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
    });
  });

  it('getForCategory: includes isVariantAttribute flag in response', async () => {
    const result = await service.getForCategory('c1');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('isVariantAttribute', true);
    expect(result[0]).toHaveProperty('isRequired', true);
  });

  it('getForCategory: returns empty array for category with no attributes', async () => {
    db.query.categoryAttributes.findMany.mockResolvedValue([]);
    const result = await service.getForCategory('c1');
    expect(result).toHaveLength(0);
  });
});
