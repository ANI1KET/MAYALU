import { Controller, Get } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth,
} from '@nestjs/swagger';
import { NavigationResponseDto } from '../../common/swagger/response.dto';
import { CurrentUser } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { NavigationService } from './navigation.service';
import type { NavigationResponse } from './dto/navigation.dto';

@ApiTags('Navigation')
@ApiCookieAuth('access_token')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get sidebar navigation for current user',
    description:
      'Returns role-based menu, permissions, plan features, and badge counts. ' +
      '**Roles**: customer | owner | manager | inventory | support | analyst | admin. ' +
      '**O(1) complexity**: menu structure from constants (no DB query), ' +
      'plan features from JSONB snapshot (no JOIN to plans table), ' +
      'badge counts from indexed partial queries. ' +
      '3 parallel DB calls maximum.',
  })
  @ApiOkEnvelope(NavigationResponseDto, 'Role-based navigation with live badge counts')
  @ApiStandardErrors()
  getNavigation(@CurrentUser() user: { sub: string }): Promise<NavigationResponse> {
    return this.navigationService.getNavigation(user.sub);
  }
}
