import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sita Rai', description: '2–100 characters' })
  @IsOptional() @IsString() @Length(2, 100) fullName?: string;

  @ApiPropertyOptional({ example: 'sita@example.com' })
  @IsOptional() @IsString() email?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', description: 'Cloudinary URL' })
  @IsOptional() @IsString() avatarUrl?: string;
}

export class CreateAddressDto {
  @ApiProperty({ enum: ['home', 'work', 'other'], example: 'home' })
  @IsEnum(['home', 'work', 'other']) type!: 'home' | 'work' | 'other';

  @ApiProperty({ example: 'Sita Rai' })
  @IsString() fullName!: string;

  @ApiProperty({ example: '+9779841234567' })
  @IsString() phone!: string;

  @ApiProperty({ example: 'Thamel, House 23' })
  @IsString() addressLine!: string;

  @ApiPropertyOptional({ example: 'Near Thamel Chowk' })
  @IsOptional() @IsString() landmark?: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsString() city!: string;

  @ApiProperty({ example: 'Bagmati' })
  @IsString() district!: string;

  @ApiPropertyOptional({ example: '44600' })
  @IsOptional() @IsString() pincode?: string;

  @ApiProperty({ enum: ['inside_valley', 'outside_valley', 'remote'], example: 'inside_valley' })
  @IsEnum(['inside_valley', 'outside_valley', 'remote']) zone!: 'inside_valley' | 'outside_valley' | 'remote';

  @ApiPropertyOptional({ example: false, description: 'Setting true unsets the previous default address' })
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
