import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AttributesService } from './attributes.service';
import { AttributeDto } from '../../common/swagger/response.dto';
import { Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

@ApiTags('Attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all attributes with options',
    description: 'Returns full attribute catalog (size, color, material, etc.) with sorted options. Used to build filter UIs.',
  })
  @ApiOkEnvelope([AttributeDto], 'All attributes with their options sorted by sortOrder')
  @ApiStandardErrors({ auth: false })
  findAll() {
    return this.attributesService.findAll();
  }

  @Public()
  @Get('code/:code')
  @ApiOperation({ summary: 'Get single attribute by code' })
  @ApiParam({ name: 'code', example: 'color', description: 'Attribute code (e.g. color, size, material)' })
  @ApiOkEnvelope(AttributeDto, 'Attribute with options')
  @ApiStandardErrors({ auth: false, notFound: 'Attribute' })
  findByCode(@Param('code') code: string) {
    return this.attributesService.findByCode(code);
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Get attributes for a category',
    description: 'Returns attributes applicable to a category with `isRequired` and `isVariantAttribute` flags. Used on product create form.',
  })
  @ApiParam({ name: 'categoryId', description: 'Category UUID' })
  @ApiOkEnvelope([AttributeDto], 'Category-specific attributes with requirement flags')
  @ApiStandardErrors({ auth: false, notFound: 'Category' })
  getForCategory(@Param('categoryId') categoryId: string) {
    return this.attributesService.getForCategory(categoryId);
  }
}
