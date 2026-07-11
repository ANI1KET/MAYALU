import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InventoryRepository } from './inventory.repository';
import type { AdjustStockDto } from './dto/inventory.dto';

export type { AdjustStockDto };

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  // ─── Warehouses ───────────────────────────────────────────────

  async createWarehouse(shopId: string, name: string, addressId?: string) {
    return this.inventoryRepository.createWarehouse(shopId, name, addressId);
  }

  async getWarehouses(shopId: string) {
    return this.inventoryRepository.getWarehouses(shopId);
  }

  async assertWarehouseInShop(warehouseId: string, shopId: string) {
    const wh = await this.inventoryRepository.findWarehouseInShop(warehouseId, shopId);
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
    return this.inventoryRepository.getInventory(shopId);
  }

  async getLowStock(shopId: string) {
    return this.inventoryRepository.getLowStock(shopId);
  }

  async adjustStock(shopId: string, dto: AdjustStockDto) {
    // Validate warehouse belongs to shop
    await this.assertWarehouseInShop(dto.warehouseId, shopId);

    // Get or create inventory record
    let inv = await this.inventoryRepository.findInventoryByVariantAndWarehouse(
      dto.variantId,
      dto.warehouseId,
    );

    if (!inv) {
      if (dto.delta < 0) {
        throw new BadRequestException({
          code: 'NO_INVENTORY_RECORD',
          message: 'Cannot decrease stock: no inventory record exists. Create with opening stock first.',
        });
      }
      const created = await this.inventoryRepository.createInventory(dto.variantId, dto.warehouseId);
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

    await this.inventoryRepository.updateQuantityOnHand(inv.id, newOnHand);

    // Append-only transaction log
    await this.inventoryRepository.insertTransaction({
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
    return this.inventoryRepository.getTransactions(inventoryId);
  }

  async reserveStock(variantId: string, warehouseId: string, quantity: number): Promise<void> {
    const inv = await this.inventoryRepository.findInventoryByVariantAndWarehouse(variantId, warehouseId);

    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;

    if (available < quantity) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Insufficient stock. Available: ${available}`,
      });
    }

    await this.inventoryRepository.incrementReserved(inv!.id, quantity);
  }

  async deductStock(variantId: string, warehouseId: string | null, quantity: number, orderId: string): Promise<void> {
    const inv = await this.inventoryRepository.findInventoryByVariantAndWarehouseOptional(variantId, warehouseId);
    if (!inv) return;

    const newOnHand = Math.max(0, inv.quantityOnHand - quantity);
    const newReserved = Math.max(0, inv.quantityReserved - quantity);

    await this.inventoryRepository.updateOnHandAndReserved(inv.id, newOnHand, newReserved);

    await this.inventoryRepository.insertTransaction({
      inventoryId: inv.id,
      type: 'sale',
      quantityDelta: -quantity,
      quantityAfter: newOnHand,
      referenceType: 'order',
      referenceId: orderId,
    });
  }

  async checkAvailability(variantId: string, quantity: number): Promise<boolean> {
    const inv = await this.inventoryRepository.findInventoryByVariant(variantId);
    if (!inv) return false;
    return (inv.quantityOnHand - inv.quantityReserved) >= quantity;
  }
}
