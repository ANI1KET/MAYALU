import { Injectable } from '@nestjs/common';
import { DeliveryRepository } from './delivery.repository';
import { DELIVERY_CHARGE_NPR } from '../../common/constants/index';
import type { CheckServiceabilityDto, ServiceabilityResult } from './dto/delivery.dto';

@Injectable()
export class DeliveryService {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async getZones() {
    return this.deliveryRepository.findActiveZones();
  }

  async checkServiceability(dto: CheckServiceabilityDto): Promise<ServiceabilityResult> {
    const sizeClass = dto.sizeClass ?? 'SMALL';

    // Step 1: Resolve dest pincode → zoneId (O(1) PK lookup)
    const pincodeMap = await this.deliveryRepository.findPincodeZoneMap(dto.destPincode);

    if (!pincodeMap) {
      return {
        result: 'unserviceable',
        buyerMessage: `Sorry, we don't deliver to pincode ${dto.destPincode} yet.`,
        availableCarriers: [],
        minDeliveryCostNpr: null,
        fastestDeliveryDays: null,
        fromCache: false,
      };
    }

    // Step 2: Resolve shop default warehouse → originZoneId
    const originZoneId = await this.resolveOriginZoneId(dto.shopId);
    if (!originZoneId) {
      return {
        result: 'unserviceable',
        buyerMessage: 'Shop delivery not configured.',
        availableCarriers: [],
        minDeliveryCostNpr: null,
        fastestDeliveryDays: null,
        fromCache: false,
      };
    }

    const destZoneId = pincodeMap.zoneId;

    // Step 3: Check 24h cache
    const cached = await this.deliveryRepository.findCachedServiceability(
      originZoneId,
      destZoneId,
      sizeClass,
    );

    if (cached) {
      return {
        result: cached.result,
        buyerMessage: cached.buyerMessage,
        availableCarriers: cached.availableCarriersJson as ServiceabilityResult['availableCarriers'],
        minDeliveryCostNpr: cached.minDeliveryCostNpr,
        fastestDeliveryDays: cached.fastestDeliveryDays,
        fromCache: true,
      };
    }

    // Same zone → free delivery
    if (originZoneId === destZoneId) {
      const result: ServiceabilityResult = {
        result: 'serviceable',
        buyerMessage: 'Free delivery in 1-2 business days',
        availableCarriers: [{ name: 'IntraCityExpress', minDays: 1, maxDays: 2, costNpr: 0, supportsCod: true }],
        minDeliveryCostNpr: '0',
        fastestDeliveryDays: 1,
        fromCache: false,
      };
      await this.deliveryRepository.writeServiceabilityCache(originZoneId, destZoneId, sizeClass, result);
      return result;
    }

    // Step 4: Query active carrier routes
    const carriers = await this.deliveryRepository.findActiveCarrierRoutes(originZoneId, destZoneId);

    if (carriers.length === 0) {
      const result: ServiceabilityResult = {
        result: 'unserviceable',
        buyerMessage: 'No delivery available for this route currently.',
        availableCarriers: [],
        minDeliveryCostNpr: null,
        fastestDeliveryDays: null,
        fromCache: false,
      };
      await this.deliveryRepository.writeServiceabilityCache(originZoneId, destZoneId, sizeClass, result);
      return result;
    }

    const cheapest = carriers[0]!;
    const fastest = carriers.reduce((prev, cur) =>
      prev.minDays < cur.minDays ? prev : cur,
    );

    const result: ServiceabilityResult = {
      result: 'serviceable',
      buyerMessage: `Delivery in ${fastest.minDays}-${fastest.maxDays} business days`,
      availableCarriers: carriers.map((c) => ({
        name: c.carrierName,
        code: c.carrierCode,
        minDays: c.minDays,
        maxDays: c.maxDays,
        costNpr: parseFloat(c.baseCostNpr),
        supportsCod: c.supportsCod,
      })),
      minDeliveryCostNpr: cheapest.baseCostNpr,
      fastestDeliveryDays: fastest.minDays,
      fromCache: false,
    };

    await this.deliveryRepository.writeServiceabilityCache(originZoneId, destZoneId, sizeClass, result);
    return result;
  }

  private async resolveOriginZoneId(shopId: string): Promise<string | null> {
    const warehouse = await this.deliveryRepository.findWarehouseByShopId(shopId);

    const pincodeToCheck = warehouse?.addressId
      ? await this.deliveryRepository
          .findAddressById(warehouse.addressId)
          .then((a) => a?.pincode ?? null)
      : null;

    if (pincodeToCheck) {
      const pz = await this.deliveryRepository.findPincodeZoneByPincode(pincodeToCheck);
      if (pz) return pz.zoneId;
    }

    const defaultZone = await this.deliveryRepository.findDeliveryZoneByCode();
    return defaultZone?.id ?? null;
  }

  calculateDeliveryCharge(zone: 'inside_valley' | 'outside_valley' | 'remote'): number {
    return DELIVERY_CHARGE_NPR[zone] ?? (DELIVERY_CHARGE_NPR['outside_valley'] as number);
  }
}
