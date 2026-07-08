import {
  Injectable, Inject, NotFoundException, Module,
  Controller, Get, Patch, Post, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { UserDto, AddressDto } from '../../common/swagger/response.dto';
import { IsString, IsOptional, IsEnum, IsBoolean, Length } from 'class-validator';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sita Rai', description: '2–100 characters' })
  @IsOptional() @IsString() @Length(2, 100) fullName?: string;

  @ApiPropertyOptional({ example: 'sita@example.com' })
  @IsOptional() @IsString() email?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', description: 'Cloudinary URL' })
  @IsOptional() @IsString() avatarUrl?: string;
}

class CreateAddressDto {
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

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [updated] = await this.db.update(schema.users)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    if (!updated) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return updated;
  }

  async getAddresses(userId: string) {
    return this.db.query.addresses.findMany({
      where: eq(schema.addresses.userId, userId),
      orderBy: (a, { desc }) => [desc(a.isDefault)],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.db.update(schema.addresses)
        .set({ isDefault: false })
        .where(eq(schema.addresses.userId, userId));
    }

    const [address] = await this.db.insert(schema.addresses).values({
      userId, ...dto, isDefault: dto.isDefault ?? false,
    }).returning();

    return address;
  }
}

@ApiTags('Users')
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkEnvelope(UserDto, 'Authenticated user profile')
  @ApiStandardErrors({ notFound: 'User' })
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @ApiBody({ type: UpdateProfileDto })
  @ApiOperation({ summary: 'Update profile (name, email, avatar)' })
  @ApiOkEnvelope(UserDto, 'Updated user profile')
  @ApiStandardErrors({ badRequest: true, notFound: 'User' })
  updateProfile(@CurrentUser() user: { sub: string }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'Get my saved delivery addresses' })
  @ApiOkEnvelope([AddressDto], 'Addresses sorted by isDefault desc')
  @ApiStandardErrors()
  getAddresses(@CurrentUser() user: { sub: string }) {
    return this.usersService.getAddresses(user.sub);
  }

  @Post('me/addresses')
  @ApiBody({ type: CreateAddressDto })
  @ApiOperation({ summary: 'Add delivery address' })
  @ApiCreatedEnvelope(AddressDto, 'Address saved')
  @ApiStandardErrors({ badRequest: true })
  createAddress(@CurrentUser() user: { sub: string }, @Body() dto: CreateAddressDto) {
    return this.usersService.createAddress(user.sub, dto);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService, JwtService],
  exports: [UsersService],
})
export class UsersModule {}
