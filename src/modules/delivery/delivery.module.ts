import { Injectable, Inject, Module, Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryZoneDto, ServiceabilityResponseDto } from '../../common/swagger/response.dto';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { eq, and, gt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { Public } from '../../common/decorators/index';
import {
  DELIVERY_CHARGE_NPR,
  DELIVERY_CACHE_TTL_MS,
  DEFAULT_ORIGIN_ZONE_CODE,
} from '../../common/constants/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

class CheckServiceabilityDto {
  @ApiProperty({ example: '44600', description: 'Destination postal/pincode' })
  @IsString() destPincode!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Shop UUID (resolves origin warehouse)' })
  @IsString() shopId!: string;

  @ApiPropertyOptional({ enum: ['SMALL', 'MEDIUM', 'LARGE', 'BULKY', 'HEAVY_BULKY', 'FRAGILE'], example: 'SMALL', description: 'Defaults to SMALL' })
  @IsOptional()
  @IsEnum(['SMALL', 'MEDIUM', 'LARGE', 'BULKY', 'HEAVY_BULKY', 'FRAGILE'])
  sizeClass?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'BULKY' | 'HEAVY_BULKY' | 'FRAGILE';
}

interface CarrierResult {
  name: string;
  code?: string;
  minDays: number;
  maxDays: number;
  costNpr: number;
  supportsCod: boolean;
}

interface ServiceabilityResult {
  result: 'serviceable' | 'unserviceable' | 'enquiry_required';
  buyerMessage: string | null;
  availableCarriers: CarrierResult[];
  minDeliveryCostNpr: string | null;
  fastestDeliveryDays: number | null;
  fromCache: boolean;
}

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getZones() {
    return this.db.query.deliveryZones.findMany({
      where: eq(schema.deliveryZones.isActive, true),
    });
  }

  async checkServiceability(dto: CheckServiceabilityDto): Promise<ServiceabilityResult> {
    const sizeClass = dto.sizeClass ?? 'SMALL';

    // Step 1: Resolve dest pincode → zoneId (O(1) PK lookup)
    const pincodeMap = await this.db.query.pincodeZoneMap.findFirst({
      where: and(
        eq(schema.pincodeZoneMap.pincode, dto.destPincode),
        eq(schema.pincodeZoneMap.isActive, true),
      ),
    });

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
    const cached = await this.db.query.deliveryServiceabilityCache.findFirst({
      where: and(
        eq(schema.deliveryServiceabilityCache.originZoneId, originZoneId),
        eq(schema.deliveryServiceabilityCache.destZoneId, destZoneId),
        eq(schema.deliveryServiceabilityCache.sizeClass, sizeClass),
        gt(schema.deliveryServiceabilityCache.expiresAt, new Date()),
      ),
    });

    if (cached) {
      return {
        result: cached.result,
        buyerMessage: cached.buyerMessage,
        availableCarriers: cached.availableCarriersJson as CarrierResult[],
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
      await this.writeCache(originZoneId, destZoneId, sizeClass, result);
      return result;
    }

    // Step 4: Query active carrier routes
    const carriers = await this.db.query.carrierZoneRoutes.findMany({
      where: and(
        eq(schema.carrierZoneRoutes.originZoneId, originZoneId),
        eq(schema.carrierZoneRoutes.destZoneId, destZoneId),
        eq(schema.carrierZoneRoutes.isActive, true),
      ),
      orderBy: (c, { asc }) => [asc(c.baseCostNpr)],
    });

    if (carriers.length === 0) {
      const result: ServiceabilityResult = {
        result: 'unserviceable',
        buyerMessage: 'No delivery available for this route currently.',
        availableCarriers: [],
        minDeliveryCostNpr: null,
        fastestDeliveryDays: null,
        fromCache: false,
      };
      await this.writeCache(originZoneId, destZoneId, sizeClass, result);
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

    await this.writeCache(originZoneId, destZoneId, sizeClass, result);
    return result;
  }

  private async resolveOriginZoneId(shopId: string): Promise<string | null> {
    const warehouse = await this.db.query.warehouses.findFirst({
      where: and(
        eq(schema.warehouses.shopId, shopId),
        eq(schema.warehouses.isDefault, true),
      ),
    });

    const pincodeToCheck = warehouse?.addressId
      ? await this.db.query.addresses
          .findFirst({ where: eq(schema.addresses.id, warehouse.addressId) })
          .then((a) => a?.pincode ?? null)
      : null;

    if (pincodeToCheck) {
      const pz = await this.db.query.pincodeZoneMap.findFirst({
        where: eq(schema.pincodeZoneMap.pincode, pincodeToCheck),
      });
      if (pz) return pz.zoneId;
    }

    const defaultZone = await this.db.query.deliveryZones.findFirst({
      where: eq(schema.deliveryZones.code, DEFAULT_ORIGIN_ZONE_CODE),
    });
    return defaultZone?.id ?? null;
  }

  private async writeCache(
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

  calculateDeliveryCharge(zone: 'inside_valley' | 'outside_valley' | 'remote'): number {
    return DELIVERY_CHARGE_NPR[zone] ?? (DELIVERY_CHARGE_NPR['outside_valley'] as number);
  }
}

@ApiTags('Delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Public()
  @Get('zones')
  @ApiOperation({ summary: 'Get all active delivery zones' })
  @ApiOkEnvelope([DeliveryZoneDto], 'All active delivery zones')
  @ApiStandardErrors({ auth: false })
  getZones() {
    return this.deliveryService.getZones();
  }

  @Public()
  @Post('check')
  @ApiBody({ type: CheckServiceabilityDto })
  @ApiOperation({
    summary: 'Check delivery serviceability',
    description:
      'Checks if delivery is available to a pincode and returns carrier options with costs. ' +
      'Results are cached for 24 hours (DELIVERY_CACHE_TTL_MS). Remote areas enforce online payment.',
  })
  @ApiOkEnvelope(ServiceabilityResponseDto, 'Serviceability result with carriers and costs')
  @ApiStandardErrors({ auth: false, badRequest: 'Invalid pincode or shopId' })
  check(@Body() dto: CheckServiceabilityDto) {
    return this.deliveryService.checkServiceability(dto);
  }
}

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
