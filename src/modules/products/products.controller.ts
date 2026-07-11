import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CurrentUser, Public } from '../../common/decorators/index';
import {
  CreateProductDto, UpdateProductDto, CreateVariantDto,
  AddMediaDto, ProductFilterDto,
} from './dto/product.dto';
import {
  ProductListResponseDto, ProductDetailDto, ProductVariantDto,
  ProductMediaDto, PresignResponseDto, MessageResponseDto,
} from '../../common/swagger/response.dto';
import {
  ApiOkEnvelope, ApiCreatedEnvelope, ApiStandardErrors,
} from '../../common/decorators/api-responses.decorator';

// ─── Public browsing ───────────────────────────────────────────────────────

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Browse & search products',
    description:
      'Full-text search (GIN index), category subtree filter (ltree GiST), price range, ' +
      'sort (newest/price_asc/price_desc/popular/rating), and pagination. ' +
      'Uses denormalized columns — zero JOINs on the hot path.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Full-text search query' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category (includes all subcategories)' })
  @ApiQuery({ name: 'shopId', required: false, description: 'Filter by shop' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'price_asc', 'price_desc', 'popular', 'rating'] })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiQuery({ name: 'isTrending', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max 100' })
  @ApiOkEnvelope(ProductListResponseDto, 'Paginated product listing')
  @ApiStandardErrors({ auth: false, badRequest: true })
  browse(@Query() filter: ProductFilterDto) {
    return this.productsService.browse(filter);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Get product detail by slug',
    description: 'Full product with active variants, sorted media, and category. Increments view counter asynchronously.',
  })
  @ApiParam({ name: 'slug', example: 'nepali-silk-saree-red' })
  @ApiOkEnvelope(ProductDetailDto, 'Full product detail')
  @ApiStandardErrors({ auth: false, notFound: 'Product' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}

// ─── CMS (shop owner / staff) ──────────────────────────────────────────────

@ApiTags('CMS - Products')
@ApiCookieAuth('access_token')
@Controller('cms/products')
export class CmsProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBody({ type: CreateProductDto })
  @ApiOperation({
    summary: '[CMS] Create product',
    description: 'Creates a draft product. Enforces plan limit (maxProducts). Slug must be unique per shop.',
  })
  @ApiQuery({ name: 'shopId', required: true, description: 'Shop UUID' })
  @ApiCreatedEnvelope(ProductDetailDto, 'Draft product created')
  @ApiStandardErrors({
    badRequest: true,
    forbidden: 'PLAN_LIMIT_REACHED — product limit reached, upgrade plan',
    notFound: 'Category',
    conflict: 'SLUG_TAKEN — product slug already exists in this shop',
  })
  create(@Body() dto: CreateProductDto, @Query('shopId') shopId: string) {
    return this.productsService.create(shopId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '[CMS] Get product by ID (any status, staff view)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope(ProductDetailDto, 'Product with all variants and media')
  @ApiStandardErrors({ notFound: 'Product' })
  findOne(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.findOne(id, shopId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateProductDto })
  @ApiOperation({ summary: '[CMS] Update product details' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope(ProductDetailDto, 'Updated product')
  @ApiStandardErrors({ badRequest: true, notFound: 'Product' })
  update(@Param('id') id: string, @Query('shopId') shopId: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, shopId, dto);
  }

  @Post(':id/publish')
  @ApiOperation({
    summary: '[CMS] Publish product',
    description: 'Sets status to active. Requires at least one variant and one media item.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope(ProductDetailDto, 'Published product')
  @ApiStandardErrors({ badRequest: 'NO_IMAGES | NO_VARIANTS', notFound: 'Product' })
  publish(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.publish(id, shopId);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: '[CMS] Archive product (hidden from storefront)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope(MessageResponseDto, 'Product archived')
  @ApiStandardErrors({ notFound: 'Product' })
  archive(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.archive(id, shopId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[CMS] Delete draft product', description: 'Only draft products can be deleted.' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope(MessageResponseDto, 'Product deleted')
  @ApiStandardErrors({
    badRequest: 'NOT_DRAFT — only draft products can be deleted, archive active products instead',
    notFound: 'Product',
  })
  remove(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.remove(id, shopId);
  }

  @Post(':id/variants')
  @ApiBody({ type: CreateVariantDto })
  @ApiOperation({
    summary: '[CMS] Add variant',
    description: 'SKU must be globally unique. Enforces plan limit (maxVariantsPerProduct). Updates denormalized price columns.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiCreatedEnvelope(ProductVariantDto, 'Variant created')
  @ApiStandardErrors({
    badRequest: true,
    forbidden: 'PLAN_LIMIT_REACHED — variant limit reached, upgrade plan',
    notFound: 'Product',
    conflict: 'SKU_TAKEN — SKU is already in use',
  })
  createVariant(@Param('id') id: string, @Query('shopId') shopId: string, @Body() dto: CreateVariantDto) {
    return this.productsService.createVariant(id, shopId, dto);
  }

  @Get(':id/media/presign')
  @ApiOperation({
    summary: '[CMS] Get Cloudinary presigned upload URL',
    description: 'Use the returned signature + URL to POST the image directly to Cloudinary, then call POST /media with the publicId.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiQuery({ name: 'filename', required: true, example: 'saree-red-front.jpg' })
  @ApiOkEnvelope(PresignResponseDto, 'Signed upload parameters')
  @ApiStandardErrors({ notFound: 'Product' })
  presign(@Param('id') id: string, @Query('shopId') shopId: string, @Query('filename') filename: string) {
    return this.productsService.getPresignUrl(id, shopId, filename);
  }

  @Post(':id/media')
  @ApiBody({ type: AddMediaDto })
  @ApiOperation({
    summary: '[CMS] Save media reference after Cloudinary upload',
    description: 'Call this after successfully uploading to Cloudinary. Updates primaryImageUrl on the product.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiCreatedEnvelope(ProductMediaDto, 'Media saved')
  @ApiStandardErrors({ badRequest: true, notFound: 'Product' })
  addMedia(@Param('id') id: string, @Query('shopId') shopId: string, @Body() dto: AddMediaDto) {
    return this.productsService.addMedia(id, shopId, dto);
  }
}
