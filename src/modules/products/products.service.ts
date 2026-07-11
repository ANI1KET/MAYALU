import {
  Injectable, BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import * as schema from '../../database/schema/index';
import { ProductsRepository } from './products.repository';
import { PlanGateService } from '../../common/services/plan-gate.service';
import { MediaService } from '../../common/services/media.service';
import { CategoriesService } from '../categories/categories.service';
import { parsePagination, buildPaginatedResult } from '../../common/utils/pagination.util';
import {
  CreateProductDto, UpdateProductDto, CreateVariantDto,
  AddMediaDto, ProductFilterDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly planGate: PlanGateService,
    private readonly mediaService: MediaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(shopId: string, dto: CreateProductDto) {
    // Plan limit check (O(1))
    const limits = await this.getShopLimits(shopId);
    await this.planGate.assertLimit(shopId, 'products', limits);

    // Validate category
    if (dto.categoryId) {
      await this.categoriesService.findById(dto.categoryId);
    }

    // Ensure slug unique within shop
    const existing = await this.productsRepository.findProductBySlugInShop(shopId, dto.slug);
    if (existing) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Product slug already exists in this shop' });

    const product = await this.productsRepository.insertProduct(shopId, dto);

    if (!product) throw new BadRequestException('Failed to create product');

    await this.planGate.incrementUsage(shopId, 'products');
    return product;
  }

  async browse(filter: ProductFilterDto) {
    const { page, limit, offset } = parsePagination(filter);

    // Category subtree via ltree O(log n)
    let categoryIds: string[] | null = null;
    if (filter.categoryId) {
      categoryIds = await this.categoriesService.getSubtreeIds(filter.categoryId);
      if (categoryIds.length === 0) return buildPaginatedResult([], 0, page, limit);
    }

    // ── Build WHERE — uses denormalized columns, zero JOIN needed ────
    const whereParts: ReturnType<typeof sql>[] = [sql`p.status = 'active'`];

    if (categoryIds)              whereParts.push(sql`p.category_id = ANY(${categoryIds})`);
    if (filter.shopId)            whereParts.push(sql`p.shop_id = ${filter.shopId}`);
    if (filter.isFeatured)        whereParts.push(sql`p.is_featured = true`);
    if (filter.isTrending)        whereParts.push(sql`p.is_trending = true`);
    if (filter.q)                 whereParts.push(sql`p.search_vector @@ plainto_tsquery('simple', ${filter.q})`);
    // Use denormalized min_price_npr — no subquery needed
    if (filter.minPrice !== undefined) whereParts.push(sql`p.min_price_npr >= ${filter.minPrice}`);
    if (filter.maxPrice !== undefined) whereParts.push(sql`p.max_price_npr <= ${filter.maxPrice}`);
    // Only show products with at least one active variant
    whereParts.push(sql`p.active_variant_count > 0`);

    const whereClause = sql.join(whereParts, sql` AND `);

    // ── ORDER BY — all on product columns, no subquery ────────────────
    const orderClause = ((): ReturnType<typeof sql> => {
      switch (filter.sort) {
        case 'price_asc':  return sql`p.min_price_npr ASC  NULLS LAST`;
        case 'price_desc': return sql`p.min_price_npr DESC NULLS LAST`;
        case 'popular':    return sql`p.total_sold DESC`;
        case 'rating':     return sql`p.avg_rating DESC`;
        default:           return sql`p.published_at DESC NULLS LAST`;
      }
    })();

    // ── Single-pass query — uses denormalized data, zero extra joins ──
    const [rows, countResult] = await Promise.all([
      this.productsRepository.browseActiveProducts(whereClause, orderClause, limit, offset),
      this.productsRepository.countActiveProducts(whereClause),
    ]);

    return buildPaginatedResult(rows.rows, parseInt(countResult.rows[0]?.count ?? '0', 10), page, limit);
  }

  async findOne(productId: string, shopId?: string) {
    const product = await this.productsRepository.findProductWithDetails(productId, shopId);

    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    // Media fetched separately — top-level orderBy is fully typed,
    // unlike orderBy nested inside a relational `with:` clause.
    const media = await this.productsRepository.findProductMediaOrdered(productId);

    return { ...product, media };
  }

  async findBySlug(slug: string) {
    const product = await this.productsRepository.findActivePublishedProductBySlug(slug);

    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    const media = await this.productsRepository.findProductMediaOrdered(product.id);

    // Async view tracking — non-blocking, errors silently suppressed
    void this.productsRepository.recordProductView(product.id, product.shopId).catch(() => {});

    return { ...product, media };
  }

  async update(productId: string, shopId: string, dto: UpdateProductDto) {
    await this.assertProductInShop(productId, shopId);

    const updated = await this.productsRepository.updateProductFields(productId, shopId, dto);

    if (!updated) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    return updated;
  }

  async publish(productId: string, shopId: string) {
    const product = await this.findOne(productId, shopId) as typeof schema.products.$inferSelect & {
      media: typeof schema.productMedia.$inferSelect[];
      variants: typeof schema.productVariants.$inferSelect[];
    };

    if (product.media.length === 0) {
      throw new BadRequestException({ code: 'NO_IMAGES', message: 'Product must have at least one image before publishing' });
    }

    const activeVariants = product.variants.filter((v) => v.isActive);
    if (activeVariants.length === 0) {
      throw new BadRequestException({ code: 'NO_VARIANTS', message: 'Product must have at least one active variant before publishing' });
    }

    const updated = await this.productsRepository.publishProduct(productId);

    await this.productsRepository.incrementActiveProductCount(shopId);

    return updated;
  }

  async archive(productId: string, shopId: string) {
    const product = await this.assertProductInShop(productId, shopId);
    const wasActive = product.status === 'active';

    const updated = await this.productsRepository.archiveProduct(productId);

    if (wasActive) {
      await this.productsRepository.decrementActiveProductCount(shopId);
    }

    return updated;
  }

  async remove(productId: string, shopId: string) {
    const product = await this.assertProductInShop(productId, shopId);

    if (product.status !== 'draft') {
      throw new BadRequestException({
        code: 'NOT_DRAFT',
        message: 'Only draft products can be deleted. Archive active products instead.',
      });
    }

    await this.productsRepository.deleteProduct(productId, shopId);

    await this.planGate.decrementUsage(shopId, 'products');
    return { deleted: true };
  }

  async createVariant(productId: string, shopId: string, dto: CreateVariantDto) {
    await this.assertProductInShop(productId, shopId);

    const skuExists = await this.productsRepository.findVariantBySku(dto.sku);
    if (skuExists) throw new ConflictException({ code: 'SKU_TAKEN', message: `SKU "${dto.sku}" is already in use` });

    const limits = await this.getShopLimits(shopId);
    await this.planGate.assertLimit(shopId, 'variants', limits);

    const { attributeValues, ...variantData } = dto;

    const variant = await this.productsRepository.insertVariant(productId, variantData);

    if (!variant) throw new BadRequestException('Failed to create variant');

    if (attributeValues?.length) {
      await this.productsRepository.insertVariantAttributeValues(variant.id, attributeValues);
    }

    // Maintain denormalized price stats on product — eliminates variant JOIN on browse
    await this.productsRepository.refreshProductPriceStats(productId);

    await this.planGate.incrementUsage(shopId, 'variants');
    return variant;
  }

  async addMedia(productId: string, shopId: string, dto: AddMediaDto) {
    await this.assertProductInShop(productId, shopId);

    const existingCount = await this.productsRepository.findProductMediaByProductId(productId);

    const isPrimary = existingCount.length === 0;
    const sortOrder = existingCount.length;

    const media = await this.productsRepository.insertProductMedia(productId, dto, isPrimary, sortOrder);

    // Maintain denormalized primaryImageUrl — eliminates media JOIN on browse
    if (isPrimary) {
      await this.productsRepository.updateProductPrimaryImage(productId, dto.url);
    }

    if (dto.fileSizeBytes) {
      const storageMb = this.mediaService.getStorageMbFromBytes(dto.fileSizeBytes);
      await this.productsRepository.updateShopStorageUsage(shopId, storageMb);
    }

    return media;
  }

  async getPresignUrl(productId: string, shopId: string, filename: string) {
    await this.assertProductInShop(productId, shopId);
    return this.mediaService.generatePresignedUpload(`products/${shopId}`, filename);
  }

  private async assertProductInShop(productId: string, shopId: string) {
    const product = await this.productsRepository.findProductInShop(productId, shopId);
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found in this shop' });
    return product;
  }

  private async getShopLimits(shopId: string) {
    const sub = await this.productsRepository.findShopSubscription(shopId);
    const snapshot = (sub?.planFeaturesSnapshot as Record<string, number> | null) ?? {};
    return {
      maxProducts: snapshot['maxProducts'] ?? 50,
      maxVariantsPerProduct: snapshot['maxVariantsPerProduct'] ?? 10,
      maxImagesPerProduct: snapshot['maxImagesPerProduct'] ?? 5,
      maxWarehouses: snapshot['maxWarehouses'] ?? 1,
      maxStaffMembers: snapshot['maxStaffMembers'] ?? 1,
    };
  }
}
