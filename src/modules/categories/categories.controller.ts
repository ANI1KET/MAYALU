import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam,
  ApiOkResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CategoryDto, ErrorResponseDto } from '../../common/swagger/response.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get category tree',
    description: 'Returns all active categories as a nested tree. Cached-friendly — rarely changes.',
  })
  @ApiOkResponse({ type: [CategoryDto], description: 'Full category tree (nested children)' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiParam({ name: 'slug', example: 'women' })
  @ApiOkResponse({ type: CategoryDto, description: 'Category detail' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'CATEGORY_NOT_FOUND' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':id/subtree-ids')
  @ApiOperation({
    summary: 'Get subcategory IDs (ltree)',
    description: 'Returns all descendant category IDs using a GiST-indexed ltree query. Used for category-filtered product browse.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'string', format: 'uuid' }, example: ['uuid1', 'uuid2'] }, description: 'Array of category UUIDs including the requested one' })
  getSubtreeIds(@Param('id') id: string) {
    return this.categoriesService.getSubtreeIds(id);
  }

  @Get(':id/breadcrumb')
  @ApiOperation({ summary: 'Get breadcrumb path for a category' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkResponse({ type: [CategoryDto], description: 'Breadcrumb array from root to the category' })
  getBreadcrumb(@Param('id') id: string) {
    return this.categoriesService.getBreadcrumb(id);
  }
}
