import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'], example: 'shipped' })
  @IsEnum(['confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'])
  status!: 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

  @ApiPropertyOptional({ example: 'Shipped via Pathao Courier' })
  @IsOptional() @IsString() note?: string;

  @ApiPropertyOptional({ example: 'TXN-2025-000123' })
  @IsOptional() @IsString() paymentReference?: string;
}

export class CreateCouponDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Null = platform-wide coupon' })
  @IsOptional() @IsString() shopId?: string;

  @ApiProperty({ example: 'DASHAIN30', description: 'Uppercase alphanumeric, max 20 chars' })
  @IsString() code!: string;

  @ApiPropertyOptional({ example: '30% off for Dashain festival' })
  @IsOptional() @IsString() description?: string;

  @ApiProperty({ enum: ['percentage', 'fixed'], example: 'percentage' })
  @IsEnum(['percentage', 'fixed']) discountType!: 'percentage' | 'fixed';

  @ApiProperty({ example: 30, description: 'Percentage (0-100) or fixed NPR amount' })
  @IsNumber() @Min(0) discountValue!: number;

  @ApiPropertyOptional({ example: 500, description: 'Minimum order subtotal in NPR' })
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Max discount cap in NPR (for percentage discounts)' })
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;

  @ApiPropertyOptional({ example: 100, description: 'Total uses across all users. Null = unlimited.' })
  @IsOptional() @IsNumber() @Min(1) usageLimitTotal?: number;

  @ApiPropertyOptional({ example: 1, description: 'Max uses per user. Null = unlimited.' })
  @IsOptional() @IsNumber() @Min(1) usageLimitPerUser?: number;

  @ApiPropertyOptional({ example: '2025-10-01T00:00:00.000Z' })
  @IsOptional() startsAt?: string;

  @ApiPropertyOptional({ example: '2025-10-15T23:59:59.000Z' })
  @IsOptional() expiresAt?: string;
}

export class CreateBannerDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Null = platform banner' })
  @IsOptional() @IsString() shopId?: string;

  @ApiProperty({ example: 'Dashain Mega Sale — Up to 50% Off' })
  @IsString() title!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/my-cloud/image/upload/v1/mayalu-wears/banners/dashain.jpg' })
  @IsString() imageUrl!: string;

  @ApiProperty({ example: 'mayalu-wears/banners/dashain', description: 'Cloudinary public_id for deletion' })
  @IsString() publicId!: string;

  @ApiPropertyOptional({ example: '/browse?tag=dashain-sale', description: 'Click destination URL' })
  @IsOptional() @IsString() linkUrl?: string;

  @ApiProperty({ enum: ['hero', 'category', 'promo'], example: 'hero', description: 'hero=homepage full-width, category=sidebar, promo=small banner' })
  @IsEnum(['hero', 'category', 'promo']) position!: 'hero' | 'category' | 'promo';

  @ApiPropertyOptional({ example: 0, description: 'Lower number = higher priority' })
  @IsOptional() @IsNumber() @Min(0) sortOrder?: number;
}

export class UpdateShopStatusDto {
  @ApiProperty({ enum: ['pending','active','suspended','closed'], example: 'active', description: 'active = visible to buyers, suspended = hidden' })
  @IsEnum(['pending', 'active', 'suspended', 'closed']) status!: 'pending' | 'active' | 'suspended' | 'closed';

  @ApiPropertyOptional({ enum: ['unverified','in_review','verified','rejected'], example: 'verified' })
  @IsOptional() @IsEnum(['unverified', 'in_review', 'verified', 'rejected'])
  verificationStatus?: 'unverified' | 'in_review' | 'verified' | 'rejected';
}
