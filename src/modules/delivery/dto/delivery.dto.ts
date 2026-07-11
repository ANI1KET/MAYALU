import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CheckServiceabilityDto {
  @ApiProperty({ example: '44600', description: 'Destination postal/pincode' })
  @IsString() destPincode!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Shop UUID (resolves origin warehouse)' })
  @IsString() shopId!: string;

  @ApiPropertyOptional({ enum: ['SMALL', 'MEDIUM', 'LARGE', 'BULKY', 'HEAVY_BULKY', 'FRAGILE'], example: 'SMALL', description: 'Defaults to SMALL' })
  @IsOptional()
  @IsEnum(['SMALL', 'MEDIUM', 'LARGE', 'BULKY', 'HEAVY_BULKY', 'FRAGILE'])
  sizeClass?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'BULKY' | 'HEAVY_BULKY' | 'FRAGILE';
}

export interface CarrierResult {
  name: string;
  code?: string;
  minDays: number;
  maxDays: number;
  costNpr: number;
  supportsCod: boolean;
}

export interface ServiceabilityResult {
  result: 'serviceable' | 'unserviceable' | 'enquiry_required';
  buyerMessage: string | null;
  availableCarriers: CarrierResult[];
  minDeliveryCostNpr: string | null;
  fastestDeliveryDays: number | null;
  fromCache: boolean;
}
