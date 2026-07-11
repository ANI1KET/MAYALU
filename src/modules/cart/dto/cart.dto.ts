import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, Max } from 'class-validator';
import { CART } from '../../../common/constants/index';

export class AddItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ProductVariant UUID' })
  @IsString() variantId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 99, description: 'Quantity to add' })
  @IsNumber() @Min(1) @Max(CART.MAX_QUANTITY_PER_ITEM) quantity!: number;
}

export class UpdateItemDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: 99 })
  @IsNumber() @Min(1) @Max(CART.MAX_QUANTITY_PER_ITEM) quantity!: number;
}
