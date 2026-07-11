import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { DELIVERY_CACHE_TTL_MS } from '../../common/constants/index';
import { DEFAULT_ORIGIN_ZONE_CODE } from '../../common/constants/index';
import type { ServiceabilityResult } from './dto/delivery.dto';

@Injectable()
export class DeliveryRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findActiveZones() {
    return this.db.query.deliveryZones.findMany({
      where: eq(schema.deliveryZones.isActive, true),
    });
  }

  findPincodeZoneMap(destPincode: string) {
    return this.db.query.pincodeZoneMap.findFirst({
      where: and(
        eq(schema.pincodeZoneMap.pincode, destPincode),
        eq(schema.pincodeZoneMap.isActive, true),
      ),
    });
  }

  findWarehouseByShopId(shopId: string) {
    return this.db.query.warehouses.findFirst({
      where: and(
        eq(schema.warehouses.shopId, shopId),
        eq(schema.warehouses.isDefault, true),
      ),
    });
  }

  findAddressById(addressId: string) {
    return this.db.query.addresses.findFirst({ where: eq(schema.addresses.id, addressId) });
  }

  findPincodeZoneByPincode(pincode: string) {
    return this.db.query.pincodeZoneMap.findFirst({
      where: eq(schema.pincodeZoneMap.pincode, pincode),
    });
  }

  findDeliveryZoneByCode(code: string = DEFAULT_ORIGIN_ZONE_CODE) {
    return this.db.query.deliveryZones.findFirst({
      where: eq(schema.deliveryZones.code, code),
    });
  }

  findCachedServiceability(
    originZoneId: string,
    destZoneId: string,
    sizeClass: 'SMALL' | 'MEDIUM' | 'LARGE' | 'BULKY' | 'HEAVY_BULKY' | 'FRAGILE',
  ) {
    return this.db.query.deliveryServiceabilityCache.findFirst({
      where: and(
        eq(schema.deliveryServiceabilityCache.originZoneId, originZoneId),
        eq(schema.deliveryServiceabilityCache.destZoneId, destZoneId),
        eq(schema.deliveryServiceabilityCache.sizeClass, sizeClass),
        gt(schema.deliveryServiceabilityCache.expiresAt, new Date()),
      ),
    });
  }

  findActiveCarrierRoutes(originZoneId: string, destZoneId: string) {
    return this.db.query.carrierZoneRoutes.findMany({
      where: and(
        eq(schema.carrierZoneRoutes.originZoneId, originZoneId),
        eq(schema.carrierZoneRoutes.destZoneId, destZoneId),
        eq(schema.carrierZoneRoutes.isActive, true),
      ),
      orderBy: (c, { asc }) => [asc(c.baseCostNpr)],
    });
  }

  async writeServiceabilityCache(
    originZoneId: string,
    destZoneId: string,
    sizeClass: 'SMALL' | 'MEDIUM' | 'LARGE' | 'BULKY' | 'HEAVY_BULKY' | 'FRAGILE',
    result: ServiceabilityResult,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + DELIVERY_CACHE_TTL_MS);
    await this.db
      .insert(schema.deliveryServiceabilityCache)
      .values({
        originZoneId,
        destZoneId,
        sizeClass,
        result: result.result,
        buyerMessage: result.buyerMessage,
        availableCarriersJson: result.availableCarriers,
        minDeliveryCostNpr: result.minDeliveryCostNpr,
        fastestDeliveryDays: result.fastestDeliveryDays,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          schema.deliveryServiceabilityCache.originZoneId,
          schema.deliveryServiceabilityCache.destZoneId,
          schema.deliveryServiceabilityCache.sizeClass,
        ],
        set: {
          result: result.result,
          buyerMessage: result.buyerMessage,
          availableCarriersJson: result.availableCarriers,
          minDeliveryCostNpr: result.minDeliveryCostNpr,
          fastestDeliveryDays: result.fastestDeliveryDays,
          computedAt: new Date(),
          expiresAt,
        },
      });
  }
}
