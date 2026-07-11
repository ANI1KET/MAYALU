import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class InventoryRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createWarehouse(shopId: string, name: string, addressId?: string) {
    const [warehouse] = await this.db.insert(schema.warehouses).values({
      shopId, name, addressId: addressId ?? null, isActive: true, isDefault: false,
    }).returning();
    return warehouse;
  }

  async getWarehouses(shopId: string) {
    return this.db.query.warehouses.findMany({
      where: eq(schema.warehouses.shopId, shopId),
    });
  }

  async findWarehouseInShop(warehouseId: string, shopId: string) {
    return this.db.query.warehouses.findFirst({
      where: and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.shopId, shopId)),
    });
  }

  async getInventory(shopId: string) {
    return this.db.execute<{
      inventory_id: string;
      variant_id: string;
      warehouse_id: string;
      warehouse_name: string;
      sku: string;
      quantity_on_hand: number;
      quantity_reserved: number;
      quantity_available: number;
      low_stock_threshold: number;
    }>(
      sql`SELECT i.id as inventory_id, i.variant_id, i.warehouse_id, w.name as warehouse_name,
               pv.sku, i.quantity_on_hand, i.quantity_reserved,
               (i.quantity_on_hand - i.quantity_reserved) as quantity_available,
               i.low_stock_threshold
          FROM inventory i
          JOIN warehouses w ON w.id = i.warehouse_id
          JOIN product_variants pv ON pv.id = i.variant_id
          JOIN products p ON p.id = pv.product_id
          WHERE w.shop_id = ${shopId}`,
    );
  }

  async getLowStock(shopId: string) {
    return this.db.execute<{
      inventory_id: string;
      sku: string;
      product_name: string;
      quantity_available: number;
      low_stock_threshold: number;
    }>(
      sql`SELECT i.id as inventory_id, pv.sku, p.name as product_name,
               (i.quantity_on_hand - i.quantity_reserved) as quantity_available,
               i.low_stock_threshold
          FROM inventory i
          JOIN warehouses w ON w.id = i.warehouse_id
          JOIN product_variants pv ON pv.id = i.variant_id
          JOIN products p ON p.id = pv.product_id
          WHERE w.shop_id = ${shopId}
            AND (i.quantity_on_hand - i.quantity_reserved) <= i.low_stock_threshold`,
    );
  }

  async findInventoryByVariantAndWarehouse(variantId: string, warehouseId: string) {
    return this.db.query.inventory.findFirst({
      where: and(
        eq(schema.inventory.variantId, variantId),
        eq(schema.inventory.warehouseId, warehouseId),
      ),
    });
  }

  async createInventory(variantId: string, warehouseId: string) {
    const [created] = await this.db.insert(schema.inventory).values({
      variantId,
      warehouseId,
      quantityOnHand: 0,
      quantityReserved: 0,
      lowStockThreshold: 5,
      allowBackorder: false,
    }).returning();
    return created;
  }

  async updateQuantityOnHand(inventoryId: string, newOnHand: number) {
    return this.db.update(schema.inventory)
      .set({ quantityOnHand: newOnHand })
      .where(eq(schema.inventory.id, inventoryId));
  }

  async insertTransaction(values: {
    inventoryId: string;
    type: 'restock' | 'adjustment' | 'damage' | 'return' | 'opening' | 'sale';
    quantityDelta: number;
    quantityAfter: number;
    notes?: string | null;
    createdByUserId?: string | null;
    referenceType?: string;
    referenceId?: string;
  }) {
    return this.db.insert(schema.inventoryTransactions).values(values);
  }

  async getTransactions(inventoryId: string) {
    return this.db.query.inventoryTransactions.findMany({
      where: eq(schema.inventoryTransactions.inventoryId, inventoryId),
      orderBy: (t, { desc: d }) => [d(t.createdAt)],
      limit: 100,
    });
  }

  async findInventoryByVariantAndWarehouseOptional(variantId: string, warehouseId: string | null) {
    const whereClause = warehouseId
      ? and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.warehouseId, warehouseId))
      : eq(schema.inventory.variantId, variantId);

    return this.db.query.inventory.findFirst({ where: whereClause });
  }

  async incrementReserved(inventoryId: string, quantity: number) {
    return this.db.update(schema.inventory)
      .set({ quantityReserved: sql`quantity_reserved + ${quantity}` })
      .where(eq(schema.inventory.id, inventoryId));
  }

  async updateOnHandAndReserved(inventoryId: string, newOnHand: number, newReserved: number) {
    return this.db.update(schema.inventory)
      .set({ quantityOnHand: newOnHand, quantityReserved: newReserved })
      .where(eq(schema.inventory.id, inventoryId));
  }

  async findInventoryByVariant(variantId: string) {
    return this.db.query.inventory.findFirst({
      where: eq(schema.inventory.variantId, variantId),
    });
  }
}
