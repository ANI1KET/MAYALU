import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CategoryDto } from '../../common/swagger/response.dto';
import { Public } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiOkEnvelopeSchema, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get category tree',
    description: 'Returns all active categories as a nested tree. Cached-friendly — rarely changes.',
  })
  @ApiOkEnvelope([CategoryDto], 'Full category tree (nested children)')
  @ApiStandardErrors({ auth: false })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiParam({ name: 'slug', example: 'women' })
  @ApiOkEnvelope(CategoryDto, 'Category detail')
  @ApiStandardErrors({ auth: false, notFound: 'Category' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Public()
  @Get(':id/subtree-ids')
  @ApiOperation({
    summary: 'Get subcategory IDs (ltree)',
    description: 'Returns all descendant category IDs using a GiST-indexed ltree query. Used for category-filtered product browse.',
  })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkEnvelopeSchema(
    { type: 'array', items: { type: 'string', format: 'uuid' }, example: ['uuid1', 'uuid2'] },
    'Array of category UUIDs including the requested one',
  )
  @ApiStandardErrors({ auth: false, notFound: 'Category' })
  getSubtreeIds(@Param('id') id: string) {
    return this.categoriesService.getSubtreeIds(id);
  }

  @Public()
  @Get(':id/breadcrumb')
  @ApiOperation({ summary: 'Get breadcrumb path for a category' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkEnvelope([CategoryDto], 'Breadcrumb array from root to the category')
  @ApiStandardErrors({ auth: false, notFound: 'Category' })
  getBreadcrumb(@Param('id') id: string) {
    return this.categoriesService.getBreadcrumb(id);
  }
}
