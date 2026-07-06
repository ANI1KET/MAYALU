import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber,
  IsUUID, IsArray, Length, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Nepali Silk Saree - Red', description: '2–200 characters' })
  @IsString() @Length(2, 200) name!: string;

  @ApiProperty({ example: 'nepali-silk-saree-red', description: 'URL slug — must be unique per shop. Lowercase, hyphens only.' })
  @IsString() @Length(2, 80) slug!: string;

  @ApiPropertyOptional({ example: 'Handwoven silk saree from Bhaktapur artisans...' })
  @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ example: 'Premium handwoven Nepali silk', description: 'Shown on listing cards (max 200 chars)' })
  @IsOptional() @IsString() shortDescription?: string;

  @ApiPropertyOptional({ example: '100% pure silk, machine wash cold' })
  @IsOptional() @IsString() fabricInfo?: string;

  @ApiPropertyOptional({ example: 'S=32", M=34", L=36", XL=38"' })
  @IsOptional() @IsString() sizeChart?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Category UUID' })
  @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ example: 'Buy Nepali Silk Saree Online | Mayalu' })
  @IsOptional() @IsString() metaTitle?: string;

  @ApiPropertyOptional({ example: 'Shop authentic handwoven silk sarees from Nepal.' })
  @IsOptional() @IsString() metaDescription?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Updated Product Name' })
  @IsOptional() @IsString() @Length(2, 200) name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fabricInfo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sizeChart?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ example: false, description: 'Pin to featured section on homepage' })
  @IsOptional() @IsBoolean() isFeatured?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() isTrending?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean() isNewArrival?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() metaDescription?: string;
}

export class AttributeValueDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Attribute UUID' })
  @IsUUID() attributeId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'AttributeOption UUID' })
  @IsUUID() attributeOptionId!: string;
}

export class CreateVariantDto {
  @ApiProperty({ example: 'Red - L', description: 'Human-readable variant name' })
  @IsString() name!: string;

  @ApiProperty({ example: 'SILK-RED-L-001', description: 'Stock Keeping Unit — globally unique across all shops' })
  @IsString() sku!: string;

  @ApiProperty({ example: 1299, description: 'Selling price in NPR (paisa-free)' })
  @IsNumber() @Min(0) price!: number;

  @ApiPropertyOptional({ example: 1500, description: 'Original price for strikethrough display' })
  @IsOptional() @IsNumber() @Min(0) compareAtPrice?: number;

  @ApiPropertyOptional({ example: 800, description: 'Your cost price (private)' })
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;

  @ApiPropertyOptional({ example: 200, description: 'Stock quantity (creates inventory row)' })
  @IsOptional() @IsNumber() @Min(0) initialStock?: number;

  @ApiPropertyOptional({ type: [AttributeValueDto], description: 'Attribute values (e.g. color=Red, size=L)' })
  @IsOptional() @IsArray() @Type(() => AttributeValueDto)
  attributeValues?: AttributeValueDto[];
}

export class AddMediaDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/my-cloud/image/upload/v1/mayalu-wears/products/abc123.jpg' })
  @IsString() url!: string;

  @ApiProperty({ example: 'mayalu-wears/products/abc123', description: 'Cloudinary public_id for deletion' })
  @IsString() publicId!: string;

  @ApiPropertyOptional({ enum: ['image', 'video'], example: 'image' })
  @IsOptional() @IsEnum(['image', 'video']) type?: 'image' | 'video';

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Link to a specific variant — null = applies to all' })
  @IsOptional() @IsUUID() variantId?: string;

  @ApiPropertyOptional({ example: 'Red Silk Saree - Front View' })
  @IsOptional() @IsString() altText?: string;

  @ApiPropertyOptional({ example: 2048000, description: 'File size in bytes — used for plan storage tracking' })
  @IsOptional() @IsNumber() fileSizeBytes?: number;
}

export class ProductFilterDto {
  @ApiPropertyOptional({ example: 'silk saree', description: 'Full-text search (GIN index on name, description, shortDescription)' })
  @IsOptional() @IsString() q?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Includes all subcategories via ltree GiST subtree query' })
  @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional() @IsUUID() shopId?: string;

  @ApiPropertyOptional({ example: 500, description: 'Min price in NPR (uses denormalized min_price_npr column)' })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) minPrice?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Max price in NPR (uses denormalized max_price_npr column)' })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) maxPrice?: number;

  @ApiPropertyOptional({ enum: ['newest', 'price_asc', 'price_desc', 'popular', 'rating'], example: 'newest' })
  @IsOptional() @IsEnum(['newest', 'price_asc', 'price_desc', 'popular', 'rating']) sort?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() @Type(() => Boolean) isFeatured?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean() @Type(() => Boolean) isTrending?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Page size — max 100' })
  @IsOptional() @IsNumber() @Min(1) @Max(100) @Type(() => Number) limit?: number;
}
