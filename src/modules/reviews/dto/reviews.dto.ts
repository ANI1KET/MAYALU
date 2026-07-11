import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, Min, Max, Length } from 'class-validator';
import { REVIEW } from '../../../common/constants/index';

export class CreateReviewDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Order UUID — must contain this product with status delivered' })
  @IsUUID() orderId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: '1=Poor, 3=Average, 5=Excellent' })
  @IsNumber() @Min(REVIEW.MIN_RATING) @Max(REVIEW.MAX_RATING) rating!: number;

  @ApiPropertyOptional({ example: 'Beautiful fabric, fast delivery! Highly recommend.', maxLength: 1000 })
  @IsOptional() @IsString() @Length(0, REVIEW.MAX_COMMENT_LENGTH) comment?: string;
}
