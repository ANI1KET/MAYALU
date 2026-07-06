import { IsString, IsEnum, IsUUID, IsOptional, IsArray, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceOrderDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Delivery address UUID' })
  @IsUUID()
  addressId!: string;

  @ApiProperty({ enum: ['cod', 'esewa', 'fonepay'], example: 'cod', description: 'Payment method. COD unavailable for remote zones.' })
  @IsEnum(['cod', 'esewa', 'fonepay'])
  paymentMethod!: 'cod' | 'esewa' | 'fonepay';

  @ApiPropertyOptional({ example: 'SAVE10', description: 'Coupon code to apply. Validated atomically inside the transaction.' })
  @IsOptional() @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'Please leave at the gate', maxLength: 500 })
  @IsOptional() @IsString()
  customerNotes?: string;
}

export class OrderFilterDto {
  @ApiPropertyOptional({ enum: ['pending','confirmed','packed','shipped','delivered','cancelled','returned'] })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional() @IsNumber() @Min(1)
  limit?: number;
}
