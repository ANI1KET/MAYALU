import { InventoryService } from '../inventory.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockWarehouse = { id: 'wh1', shopId: 's1', name: 'Main Warehouse', isActive: true };
const mockInventory = { id: 'inv1', variantId: 'v1', warehouseId: 'wh1', quantityOnHand: 10, quantityReserved: 2, quantityAvailable: 8 };

const makeRepo = () => ({
  createWarehouse: jest.fn().mockResolvedValue(mockWarehouse),
  getWarehouses: jest.fn().mockResolvedValue([mockWarehouse]),
  findWarehouseInShop: jest.fn().mockResolvedValue(mockWarehouse),
  getInventory: jest.fn().mockResolvedValue({ rows: [] }),
  getLowStock: jest.fn().mockResolvedValue({ rows: [] }),
  findInventoryByVariantAndWarehouse: jest.fn().mockResolvedValue(mockInventory),
  createInventory: jest.fn().mockResolvedValue(mockInventory),
  updateQuantityOnHand: jest.fn().mockResolvedValue([mockInventory]),
  insertTransaction: jest.fn().mockResolvedValue(undefined),
  getTransactions: jest.fn().mockResolvedValue([]),
  findInventoryByVariantAndWarehouseOptional: jest.fn().mockResolvedValue(mockInventory),
  incrementReserved: jest.fn().mockResolvedValue([mockInventory]),
  updateOnHandAndReserved: jest.fn().mockResolvedValue([mockInventory]),
  findInventoryByVariant: jest.fn().mockResolvedValue(mockInventory),
});

describe('InventoryService', () => {
  let service: InventoryService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new InventoryService(repo as never);
  });

  it('createWarehouse: success', async () => {
    const result = await service.createWarehouse('s1', 'New Warehouse');
    expect(repo.createWarehouse).toHaveBeenCalled();
  });

  it('adjustStock: throws NotFoundException when warehouse not in shop', async () => {
    repo.findWarehouseInShop.mockResolvedValue(null);
    await expect(service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh-other', delta: 10, type: 'restock',
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WAREHOUSE_NOT_FOUND' }),
    });
  });

  it('adjustStock: throws BadRequestException when stock would go negative', async () => {
    repo.findInventoryByVariantAndWarehouse.mockResolvedValue({ ...mockInventory, quantityOnHand: 5 });
    await expect(service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh1', delta: -10, type: 'adjustment',
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    });
  });

  it('adjustStock: creates inventory record if missing on positive delta', async () => {
    repo.findInventoryByVariantAndWarehouse.mockResolvedValue(null);
    const result = await service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh1', delta: 20, type: 'opening',
    });
    expect(repo.createInventory).toHaveBeenCalled();
  });

  it('adjustStock: throws when trying to decrease without inventory record', async () => {
    repo.findInventoryByVariantAndWarehouse.mockResolvedValue(null);
    await expect(service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh1', delta: -5, type: 'damage',
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NO_INVENTORY_RECORD' }),
    });
  });

  it('adjustStock: records transaction after successful update', async () => {
    await service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh1', delta: 5, type: 'restock',
    });
    expect(repo.insertTransaction).toHaveBeenCalled();
    expect(repo.updateQuantityOnHand).toHaveBeenCalled();
  });
});
