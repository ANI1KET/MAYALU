import { IsString, IsEnum, Matches, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NEPAL_PHONE_REGEX, normalizeNepalPhone } from '../../../common/utils/phone.util';

const PHONE_MSG = 'Must be a valid Nepal mobile number (e.g. +9779841234567 or 9841234567)';

export class SendOtpDto {
  @ApiProperty({ example: '+9779841234567', description: 'Nepal mobile number — any format (normalized to E.164 internally)' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeNepalPhone(value) : value))
  @IsString()
  @Matches(NEPAL_PHONE_REGEX, { message: PHONE_MSG })
  phone!: string;

  @ApiProperty({ enum: ['login', 'register'], example: 'login', description: 'Purpose determines OTP lifecycle' })
  @IsEnum(['login', 'register'])
  purpose!: 'login' | 'register';
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+9779841234567' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeNepalPhone(value) : value))
  @IsString()
  @Matches(NEPAL_PHONE_REGEX, { message: PHONE_MSG })
  phone!: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP from SMS' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp!: string;

  @ApiProperty({ enum: ['login', 'register'], example: 'login' })
  @IsEnum(['login', 'register'])
  purpose!: 'login' | 'register';
}

export class RegisterDto {
  @ApiProperty({ example: '+9779841234567', description: 'Must have been OTP-verified first' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeNepalPhone(value) : value))
  @IsString()
  @Matches(NEPAL_PHONE_REGEX, { message: PHONE_MSG })
  phone!: string;

  @ApiProperty({ example: 'Sita Rai', description: '2-100 characters' })
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @ApiPropertyOptional({ example: 'sita@example.com' })
  @IsOptional()
  @IsString()
  email?: string;
}
