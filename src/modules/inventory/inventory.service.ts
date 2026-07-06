import {
  Injectable, Inject, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { eq, and, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

export interface AdjustStockDto {
  variantId: string;
  warehouseId: string;
  delta: number;
  type: 'restock' | 'adjustment' | 'damage' | 'return' | 'opening';
  notes?: string;
  userId?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ─── Warehouses ───────────────────────────────────────────────

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

  async assertWarehouseInShop(warehouseId: string, shopId: string) {
    const wh = await this.db.query.warehouses.findFirst({
      where: and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.shopId, shopId)),
    });
    if (!wh) {
      throw new NotFoundException({
        code: 'WAREHOUSE_NOT_FOUND',
        message: 'Warehouse not found or does not belong to this shop',
      });
    }
    return wh;
  }

  // ─── Inventory ────────────────────────────────────────────────

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

  async adjustStock(shopId: string, dto: AdjustStockDto) {
    // Validate warehouse belongs to shop
    await this.assertWarehouseInShop(dto.warehouseId, shopId);

    // Get or create inventory record
    let inv = await this.db.query.inventory.findFirst({
      where: and(
        eq(schema.inventory.variantId, dto.variantId),
        eq(schema.inventory.warehouseId, dto.warehouseId),
      ),
    });

    if (!inv) {
      if (dto.delta < 0) {
        throw new BadRequestException({
          code: 'NO_INVENTORY_RECORD',
          message: 'Cannot decrease stock: no inventory record exists. Create with opening stock first.',
        });
      }
      const [created] = await this.db.insert(schema.inventory).values({
        variantId: dto.variantId,
        warehouseId: dto.warehouseId,
        quantityOnHand: 0,
        quantityReserved: 0,
        lowStockThreshold: 5,
        allowBackorder: false,
      }).returning();
      inv = created!;
    }

    const newOnHand = inv.quantityOnHand + dto.delta;

    if (newOnHand < 0) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Adjustment would result in negative stock (current: ${inv.quantityOnHand}, delta: ${dto.delta})`,
        details: { current: inv.quantityOnHand, delta: dto.delta, resultWouldBe: newOnHand },
      });
    }

    await this.db.update(schema.inventory)
      .set({ quantityOnHand: newOnHand })
      .where(eq(schema.inventory.id, inv.id));

    // Append-only transaction log
    await this.db.insert(schema.inventoryTransactions).values({
      inventoryId: inv.id,
      type: dto.type,
      quantityDelta: dto.delta,
      quantityAfter: newOnHand,
      notes: dto.notes ?? null,
      createdByUserId: dto.userId ?? null,
    });

    return { inventoryId: inv.id, quantityOnHand: newOnHand, delta: dto.delta };
  }

  async getTransactions(inventoryId: string) {
    return this.db.query.inventoryTransactions.findMany({
      where: eq(schema.inventoryTransactions.inventoryId, inventoryId),
      orderBy: (t, { desc: d }) => [d(t.createdAt)],
      limit: 100,
    });
  }

  async reserveStock(variantId: string, warehouseId: string, quantity: number): Promise<void> {
    const inv = await this.db.query.inventory.findFirst({
      where: and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.warehouseId, warehouseId)),
    });

    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;

    if (available < quantity) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Insufficient stock. Available: ${available}`,
      });
    }

    await this.db.update(schema.inventory)
      .set({ quantityReserved: sql`quantity_reserved + ${quantity}` })
      .where(eq(schema.inventory.id, inv!.id));
  }

  async deductStock(variantId: string, warehouseId: string | null, quantity: number, orderId: string): Promise<void> {
    const whereClause = warehouseId
      ? and(eq(schema.inventory.variantId, variantId), eq(schema.inventory.warehouseId, warehouseId))
      : eq(schema.inventory.variantId, variantId);

    const inv = await this.db.query.inventory.findFirst({ where: whereClause });
    if (!inv) return;

    const newOnHand = Math.max(0, inv.quantityOnHand - quantity);
    const newReserved = Math.max(0, inv.quantityReserved - quantity);

    await this.db.update(schema.inventory)
      .set({ quantityOnHand: newOnHand, quantityReserved: newReserved })
      .where(eq(schema.inventory.id, inv.id));

    await this.db.insert(schema.inventoryTransactions).values({
      inventoryId: inv.id,
      type: 'sale',
      quantityDelta: -quantity,
      quantityAfter: newOnHand,
      referenceType: 'order',
      referenceId: orderId,
    });
  }

  async checkAvailability(variantId: string, quantity: number): Promise<boolean> {
    const inv = await this.db.query.inventory.findFirst({
      where: eq(schema.inventory.variantId, variantId),
    });
    if (!inv) return false;
    return (inv.quantityOnHand - inv.quantityReserved) >= quantity;
  }
}
