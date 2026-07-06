import {
  Injectable, Inject, NotFoundException, Module,
  Controller, Get, Patch, Post, Body, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiUnauthorizedResponse, ApiNotFoundResponse,
  ApiPropertyOptional, ApiProperty,
} from '@nestjs/swagger';
import { UserDto, AddressDto, MessageResponseDto, ErrorResponseDto } from '../../common/swagger/response.dto';
import { IsString, IsOptional, IsEnum, IsBoolean, Length } from 'class-validator';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';

class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sita Rai', description: '2–100 characters' })
  @IsOptional() @IsString() @Length(2, 100) fullName?: string;

  @ApiPropertyOptional({ example: 'sita@example.com' })
  @IsOptional() @IsString() email?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', description: 'Cloudinary URL' })
  @IsOptional() @IsString() avatarUrl?: string;
}

class CreateAddressDto {
  @IsEnum(['home', 'work', 'other']) type!: 'home' | 'work' | 'other';
  @IsString() fullName!: string;
  @IsString() phone!: string;
  @IsString() addressLine!: string;
  @IsOptional() @IsString() landmark?: string;
  @IsString() city!: string;
  @IsString() district!: string;
  @IsOptional() @IsString() pincode?: string;
  @IsEnum(['inside_valley', 'outside_valley', 'remote']) zone!: 'inside_valley' | 'outside_valley' | 'remote';
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
  @ApiOkResponse({ type: UserDto, description: 'Authenticated user profile' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @ApiBody({ type: UpdateProfileDto })
  @ApiOperation({ summary: 'Update profile (name, email, avatar)' })
  @ApiOkResponse({ type: UserDto, description: 'Updated user profile' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  updateProfile(@CurrentUser() user: { sub: string }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'Get my saved delivery addresses' })
  @ApiOkResponse({ type: [AddressDto], description: 'Addresses sorted by isDefault desc' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getAddresses(@CurrentUser() user: { sub: string }) {
    return this.usersService.getAddresses(user.sub);
  }

  @Post('me/addresses')
  @ApiBody({ type: CreateAddressDto })
  @ApiOperation({ summary: 'Add delivery address' })
  @ApiCreatedResponse({ type: AddressDto, description: 'Address saved' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
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
