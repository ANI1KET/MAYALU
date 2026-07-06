import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShopDto {
  @ApiProperty({ example: 'Sita Fashion House', description: '3–100 characters' })
  @IsString() @MinLength(3) @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'sita-fashion-house', description: 'URL-safe slug — auto-generated from name if omitted' })
  @IsOptional() @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase letters, numbers, and hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ example: 'Authentic Nepali fashion and handicrafts' })
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'Thamel, Kathmandu' })
  @IsOptional() @IsString()
  businessAddress?: string;

  @ApiPropertyOptional({ example: '+9779841234567' })
  @IsOptional() @IsString()
  businessPhone?: string;

  @ApiPropertyOptional({ example: '123456789', description: 'Nepal PAN number (9 digits)' })
  @IsOptional() @IsString()
  panNumber?: string;
}

export class UpdateShopDto {
  @ApiPropertyOptional({ example: 'Updated Shop Name' })
  @IsOptional() @IsString() @MinLength(3) @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsOptional() @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '+9779841234567' })
  @IsOptional() @IsString()
  businessPhone?: string;

  @ApiPropertyOptional({ example: 'New Baneshwor, Kathmandu' })
  @IsOptional() @IsString()
  businessAddress?: string;
}
