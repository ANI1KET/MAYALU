import {
  Injectable, Inject, BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
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
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
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
    const existing = await this.db.query.products.findFirst({
      where: and(eq(schema.products.shopId, shopId), eq(schema.products.slug, dto.slug)),
    });
    if (existing) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Product slug already exists in this shop' });

    const [product] = await this.db.insert(schema.products).values({
      shopId,
      ...dto,
      status: 'draft',
    }).returning();

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
      this.db.execute<{
        id: string; shop_id: string; name: string; slug: string;
        short_description: string | null; avg_rating: string;
        total_sold: number; is_featured: boolean; is_trending: boolean;
        is_new_arrival: boolean; published_at: Date; category_id: string | null;
        // Denormalized — no JOIN needed
        primary_image_url: string | null;
        min_price_npr: string | null;
        max_price_npr: string | null;
        active_variant_count: number;
      }>(
        sql`SELECT
              p.id, p.shop_id, p.name, p.slug, p.short_description,
              p.avg_rating, p.total_sold, p.is_featured, p.is_trending,
              p.is_new_arrival, p.published_at, p.category_id,
              p.primary_image_url,
              p.min_price_npr,
              p.max_price_npr,
              p.active_variant_count
            FROM products p
            WHERE ${whereClause}
            ORDER BY ${orderClause}
            LIMIT ${limit} OFFSET ${offset}`,
      ),
      this.db.execute<{ count: string }>(
        sql`SELECT COUNT(*) AS count FROM products p WHERE ${whereClause}`,
      ),
    ]);

    return buildPaginatedResult(rows.rows, parseInt(countResult.rows[0]?.count ?? '0', 10), page, limit);
  }

  async findOne(productId: string, shopId?: string) {
    const where = shopId
      ? and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId))
      : eq(schema.products.id, productId);

    const product = await this.db.query.products.findFirst({
      where,
      with: {
        variants: { with: { attributeValues: true } as never },
        category: true,
        tags: true,
      } as never,
    });

    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    // Media fetched separately — top-level orderBy is fully typed,
    // unlike orderBy nested inside a relational `with:` clause.
    const media = await this.db.query.productMedia.findMany({
      where: eq(schema.productMedia.productId, productId),
      orderBy: (m, { asc }) => [asc(m.sortOrder)],
    });

    return { ...product, media };
  }

  async findBySlug(slug: string) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(schema.products.slug, slug), eq(schema.products.status, 'active')),
      with: {
        variants: {
          where: eq(schema.productVariants.isActive, true),
          with: { attributeValues: true } as never,
        },
        category: true,
        shop: { columns: { id: true, name: true, slug: true, logoUrl: true } },
      } as never,
    });

    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    const media = await this.db.query.productMedia.findMany({
      where: eq(schema.productMedia.productId, product.id),
      orderBy: (m, { asc }) => [asc(m.sortOrder)],
    });

    // Async view tracking — non-blocking, errors silently suppressed
    void this.db.insert(schema.productViews).values({
      productId: product.id,
      shopId: product.shopId,
    }).catch(() => {});

    return { ...product, media };
  }

  async update(productId: string, shopId: string, dto: UpdateProductDto) {
    await this.assertProductInShop(productId, shopId);

    const [updated] = await this.db.update(schema.products)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)))
      .returning();

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

    const [updated] = await this.db.update(schema.products)
      .set({ status: 'active', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.products.id, productId))
      .returning();

    await this.db.update(schema.shopResourceUsage)
      .set({ totalActiveProducts: sql`total_active_products + 1`, updatedAt: new Date() })
      .where(eq(schema.shopResourceUsage.shopId, shopId));

    return updated;
  }

  async archive(productId: string, shopId: string) {
    const product = await this.assertProductInShop(productId, shopId);
    const wasActive = product.status === 'active';

    const [updated] = await this.db.update(schema.products)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(schema.products.id, productId))
      .returning();

    if (wasActive) {
      await this.db.update(schema.shopResourceUsage)
        .set({ totalActiveProducts: sql`GREATEST(total_active_products - 1, 0)`, updatedAt: new Date() })
        .where(eq(schema.shopResourceUsage.shopId, shopId));
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

    await this.db.delete(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)));

    await this.planGate.decrementUsage(shopId, 'products');
    return { deleted: true };
  }

  async createVariant(productId: string, shopId: string, dto: CreateVariantDto) {
    await this.assertProductInShop(productId, shopId);

    const skuExists = await this.db.query.productVariants.findFirst({
      where: eq(schema.productVariants.sku, dto.sku),
    });
    if (skuExists) throw new ConflictException({ code: 'SKU_TAKEN', message: `SKU "${dto.sku}" is already in use` });

    const limits = await this.getShopLimits(shopId);
    await this.planGate.assertLimit(shopId, 'variants', limits);

    const { attributeValues, ...variantData } = dto;

    const [variant] = await this.db.insert(schema.productVariants).values({
      productId,
      ...variantData,
      price: String(variantData.price),
      compareAtPrice: variantData.compareAtPrice ? String(variantData.compareAtPrice) : null,
      costPrice: variantData.costPrice ? String(variantData.costPrice) : null,
    }).returning();

    if (!variant) throw new BadRequestException('Failed to create variant');

    if (attributeValues?.length) {
      await this.db.insert(schema.variantAttributeValues).values(
        attributeValues.map((av) => ({ variantId: variant.id, ...av })),
      );
    }

    // Maintain denormalized price stats on product — eliminates variant JOIN on browse
    await this.db.execute(
      sql`UPDATE products SET
            min_price_npr = (SELECT MIN(price) FROM product_variants WHERE product_id = ${productId} AND is_active = true),
            max_price_npr = (SELECT MAX(price) FROM product_variants WHERE product_id = ${productId} AND is_active = true),
            active_variant_count = (SELECT COUNT(*) FROM product_variants WHERE product_id = ${productId} AND is_active = true),
            updated_at = NOW()
          WHERE id = ${productId}`,
    );

    await this.planGate.incrementUsage(shopId, 'variants');
    return variant;
  }

  async addMedia(productId: string, shopId: string, dto: AddMediaDto) {
    await this.assertProductInShop(productId, shopId);

    const existingCount = await this.db.query.productMedia.findMany({
      where: eq(schema.productMedia.productId, productId),
    });

    const isPrimary = existingCount.length === 0;
    const sortOrder = existingCount.length;

    const [media] = await this.db.insert(schema.productMedia).values({
      productId,
      variantId: dto.variantId ?? null,
      url: dto.url,
      publicId: dto.publicId,
      type: dto.type ?? 'image',
      altText: dto.altText ?? null,
      isPrimary,
      sortOrder,
      fileSizeBytes: dto.fileSizeBytes ?? null,
    }).returning();

    // Maintain denormalized primaryImageUrl — eliminates media JOIN on browse
    if (isPrimary) {
      await this.db.update(schema.products)
        .set({ primaryImageUrl: dto.url, updatedAt: new Date() })
        .where(eq(schema.products.id, productId));
    }

    if (dto.fileSizeBytes) {
      const storageMb = this.mediaService.getStorageMbFromBytes(dto.fileSizeBytes);
      await this.db.update(schema.shopResourceUsage)
        .set({ storageMbUsed: sql`storage_mb_used + ${storageMb}` })
        .where(eq(schema.shopResourceUsage.shopId, shopId));
    }

    return media;
  }

  async getPresignUrl(productId: string, shopId: string, filename: string) {
    await this.assertProductInShop(productId, shopId);
    return this.mediaService.generatePresignedUpload(`products/${shopId}`, filename);
  }

  private async assertProductInShop(productId: string, shopId: string) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)),
    });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found in this shop' });
    return product;
  }

  private async getShopLimits(shopId: string) {
    const sub = await this.db.query.shopSubscriptions.findFirst({
      where: eq(schema.shopSubscriptions.shopId, shopId),
    });
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
