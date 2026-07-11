import { Controller, Get, Patch, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { UserDto, AddressDto } from '../../common/swagger/response.dto';
import { CurrentUser } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, CreateAddressDto } from './dto/users.dto';

@ApiTags('Users')
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
