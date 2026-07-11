import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'Main Warehouse - Thamel' })
  @IsString() name!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Address UUID — used to resolve origin delivery zone' })
  @IsOptional() @IsString() addressId?: string;
}

export class AdjustStockBodyDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ProductVariant UUID' })
  @IsString() variantId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Warehouse UUID' })
  @IsString() warehouseId!: string;

  @ApiProperty({ example: 50, description: 'Positive = add stock. Negative = deduct. Absolute for opening count.' })
  @IsNumber() delta!: number;

  @ApiProperty({ enum: ['restock', 'adjustment', 'damage', 'return', 'opening'], example: 'restock',
    description: 'restock=new stock arrived, damage=write-off, return=customer return, opening=initial count' })
  @IsEnum(['restock', 'adjustment', 'damage', 'return', 'opening'])
  type!: 'restock' | 'adjustment' | 'damage' | 'return' | 'opening';

  @ApiPropertyOptional({ example: 'Received 50 units from Bhaktapur supplier' })
  @IsOptional() @IsString() notes?: string;
}

export interface AdjustStockDto {
  variantId: string;
  warehouseId: string;
  delta: number;
  type: 'restock' | 'adjustment' | 'damage' | 'return' | 'opening';
  notes?: string;
  userId?: string;
}
