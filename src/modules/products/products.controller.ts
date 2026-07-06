import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse,
  ApiNotFoundResponse, ApiUnauthorizedResponse, ApiForbiddenResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public } from '../../common/decorators/index';
import {
  CreateProductDto, UpdateProductDto, CreateVariantDto,
  AddMediaDto, ProductFilterDto,
} from './dto/product.dto';
import {
  ProductListResponseDto, ProductDetailDto, ProductVariantDto,
  ProductMediaDto, PresignResponseDto, ErrorResponseDto, MessageResponseDto,
} from '../../common/swagger/response.dto';

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
  @ApiOkResponse({ type: ProductListResponseDto, description: 'Paginated product listing' })
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
  @ApiOkResponse({ type: ProductDetailDto, description: 'Full product detail' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PRODUCT_NOT_FOUND or product not active' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}

// ─── CMS (shop owner / staff) ──────────────────────────────────────────────

@ApiTags('CMS - Products')
@UseGuards(AuthGuard)
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
  @ApiCreatedResponse({ type: ProductDetailDto, description: 'Draft product created' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'SLUG_TAKEN' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'PLAN_LIMIT_REACHED — upgrade plan' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  create(@Body() dto: CreateProductDto, @Query('shopId') shopId: string) {
    return this.productsService.create(shopId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '[CMS] Get product by ID (any status, staff view)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkResponse({ type: ProductDetailDto, description: 'Product with all variants and media' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PRODUCT_NOT_FOUND' })
  findOne(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.findOne(id, shopId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateProductDto })
  @ApiOperation({ summary: '[CMS] Update product details' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkResponse({ type: ProductDetailDto, description: 'Updated product' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PRODUCT_NOT_FOUND' })
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
  @ApiOkResponse({ type: ProductDetailDto, description: 'Published product' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'MISSING_VARIANTS | MISSING_MEDIA' })
  publish(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.publish(id, shopId);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: '[CMS] Archive product (hidden from storefront)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Product archived' })
  archive(@Param('id') id: string, @Query('shopId') shopId: string) {
    return this.productsService.archive(id, shopId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[CMS] Delete draft product', description: 'Only draft products can be deleted.' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Product deleted' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'CANNOT_DELETE_ACTIVE — archive first' })
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
  @ApiCreatedResponse({ type: ProductVariantDto, description: 'Variant created' })
  @ApiConflictResponse({ description: 'SKU_TAKEN' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'PLAN_LIMIT_REACHED' })
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
  @ApiOkResponse({ type: PresignResponseDto, description: 'Signed upload parameters' })
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
  @ApiCreatedResponse({ type: ProductMediaDto, description: 'Media saved' })
  addMedia(@Param('id') id: string, @Query('shopId') shopId: string, @Body() dto: AddMediaDto) {
    return this.productsService.addMedia(id, shopId, dto);
  }
}
