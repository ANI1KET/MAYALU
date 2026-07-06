import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam,
  ApiOkResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AttributesService } from './attributes.service';
import { AttributeDto, ErrorResponseDto } from '../../common/swagger/response.dto';

@ApiTags('Attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all attributes with options',
    description: 'Returns full attribute catalog (size, color, material, etc.) with sorted options. Used to build filter UIs.',
  })
  @ApiOkResponse({ type: [AttributeDto], description: 'All attributes with their options sorted by sortOrder' })
  findAll() {
    return this.attributesService.findAll();
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get single attribute by code' })
  @ApiParam({ name: 'code', example: 'color', description: 'Attribute code (e.g. color, size, material)' })
  @ApiOkResponse({ type: AttributeDto, description: 'Attribute with options' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ATTRIBUTE_NOT_FOUND' })
  findByCode(@Param('code') code: string) {
    return this.attributesService.findByCode(code);
  }

  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Get attributes for a category',
    description: 'Returns attributes applicable to a category with `isRequired` and `isVariantAttribute` flags. Used on product create form.',
  })
  @ApiParam({ name: 'categoryId', description: 'Category UUID' })
  @ApiOkResponse({ type: [AttributeDto], description: 'Category-specific attributes with requirement flags' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'CATEGORY_NOT_FOUND' })
  getForCategory(@Param('categoryId') categoryId: string) {
    return this.attributesService.getForCategory(categoryId);
  }
}
