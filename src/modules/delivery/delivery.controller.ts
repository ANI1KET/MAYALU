import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { DeliveryZoneDto, ServiceabilityResponseDto } from '../../common/swagger/response.dto';
import { Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { DeliveryService } from './delivery.service';
import { CheckServiceabilityDto } from './dto/delivery.dto';

@ApiTags('Delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Public()
  @Get('zones')
  @ApiOperation({ summary: 'Get all active delivery zones' })
  @ApiOkEnvelope([DeliveryZoneDto], 'All active delivery zones')
  @ApiStandardErrors({ auth: false })
  getZones() {
    return this.deliveryService.getZones();
  }

  @Public()
  @Post('check')
  @ApiBody({ type: CheckServiceabilityDto })
  @ApiOperation({
    summary: 'Check delivery serviceability',
    description:
      'Checks if delivery is available to a pincode and returns carrier options with costs. ' +
      'Results are cached for 24 hours (DELIVERY_CACHE_TTL_MS). Remote areas enforce online payment.',
  })
  @ApiOkEnvelope(ServiceabilityResponseDto, 'Serviceability result with carriers and costs')
  @ApiStandardErrors({ auth: false, badRequest: 'Invalid pincode or shopId' })
  check(@Body() dto: CheckServiceabilityDto) {
    return this.deliveryService.checkServiceability(dto);
  }
}
