import { InventoryService } from '../inventory.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockWarehouse = { id: 'wh1', shopId: 's1', name: 'Main Warehouse', isActive: true };
const mockInventory = { id: 'inv1', variantId: 'v1', warehouseId: 'wh1', quantityOnHand: 10, quantityReserved: 2, quantityAvailable: 8 };

const makeDb = () => ({
  query: {
    warehouses: { findFirst: jest.fn().mockResolvedValue(mockWarehouse), findMany: jest.fn().mockResolvedValue([mockWarehouse]) },
    inventory: { findFirst: jest.fn().mockResolvedValue(mockInventory) },
    inventoryTransactions: { findMany: jest.fn().mockResolvedValue([]) },
  },
  insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([mockInventory]) }) }),
  update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockInventory]) }) }),
  execute: jest.fn().mockResolvedValue({ rows: [] }),
});

describe('InventoryService', () => {
  let service: InventoryService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new InventoryService(db as never);
  });

  it('createWarehouse: success', async () => {
    const result = await service.createWarehouse('s1', 'New Warehouse');
    expect(db.insert).toHaveBeenCalled();
  });

  it('adjustStock: throws NotFoundException when warehouse not in shop', async () => {
    db.query.warehouses.findFirst.mockResolvedValue(null);
    await expect(service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh-other', delta: 10, type: 'restock',
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WAREHOUSE_NOT_FOUND' }),
    });
  });

  it('adjustStock: throws BadRequestException when stock would go negative', async () => {
    db.query.inventory.findFirst.mockResolvedValue({ ...mockInventory, quantityOnHand: 5 });
    await expect(service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh1', delta: -10, type: 'adjustment',
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    });
  });

  it('adjustStock: creates inventory record if missing on positive delta', async () => {
    db.query.inventory.findFirst.mockResolvedValue(null);
    const result = await service.adjustStock('s1', {
      variantId: 'v1', warehouseId: 'wh1', delta: 20, type: 'opening',
    });
    expect(db.insert).toHaveBeenCalled();
  });

  it('adjustStock: throws when trying to decrease without inventory record', async () => {
    db.query.inventory.findFirst.mockResolvedValue(null);
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
    // insert called twice: once for tx, once potentially for inventory if missing
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });
});
