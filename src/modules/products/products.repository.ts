import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { CreateProductDto, UpdateProductDto, CreateVariantDto, AddMediaDto } from './dto/product.dto';

@Injectable()
export class ProductsRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findProductBySlugInShop(shopId: string, slug: string) {
    return this.db.query.products.findFirst({
      where: and(eq(schema.products.shopId, shopId), eq(schema.products.slug, slug)),
    });
  }

  async insertProduct(shopId: string, dto: CreateProductDto) {
    const [product] = await this.db.insert(schema.products).values({
      shopId,
      ...dto,
      status: 'draft',
    }).returning();
    return product;
  }

  async browseActiveProducts(whereClause: ReturnType<typeof sql>, orderClause: ReturnType<typeof sql>, limit: number, offset: number) {
    return this.db.execute<{
      id: string; shop_id: string; name: string; slug: string;
      short_description: string | null; avg_rating: string;
      total_sold: number; is_featured: boolean; is_trending: boolean;
      is_new_arrival: boolean; published_at: Date; category_id: string | null;
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
    );
  }

  countActiveProducts(whereClause: ReturnType<typeof sql>) {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(*) AS count FROM products p WHERE ${whereClause}`,
    );
  }

  findProductWithDetails(productId: string, shopId?: string) {
    const where = shopId
      ? and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId))
      : eq(schema.products.id, productId);

    return this.db.query.products.findFirst({
      where,
      with: {
        variants: { with: { attributeValues: true } as never },
        category: true,
        tags: true,
      } as never,
    });
  }

  findProductMediaOrdered(productId: string) {
    return this.db.query.productMedia.findMany({
      where: eq(schema.productMedia.productId, productId),
      orderBy: (m, { asc }) => [asc(m.sortOrder)],
    });
  }

  findActivePublishedProductBySlug(slug: string) {
    return this.db.query.products.findFirst({
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
  }

  recordProductView(productId: string, shopId: string) {
    return this.db.insert(schema.productViews).values({
      productId,
      shopId,
    });
  }

  async updateProductFields(productId: string, shopId: string, dto: UpdateProductDto) {
    const [updated] = await this.db.update(schema.products)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)))
      .returning();
    return updated;
  }

  async publishProduct(productId: string) {
    const [updated] = await this.db.update(schema.products)
      .set({ status: 'active', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.products.id, productId))
      .returning();
    return updated;
  }

  incrementActiveProductCount(shopId: string) {
    return this.db.update(schema.shopResourceUsage)
      .set({ totalActiveProducts: sql`total_active_products + 1`, updatedAt: new Date() })
      .where(eq(schema.shopResourceUsage.shopId, shopId));
  }

  async archiveProduct(productId: string) {
    const [updated] = await this.db.update(schema.products)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(schema.products.id, productId))
      .returning();
    return updated;
  }

  decrementActiveProductCount(shopId: string) {
    return this.db.update(schema.shopResourceUsage)
      .set({ totalActiveProducts: sql`GREATEST(total_active_products - 1, 0)`, updatedAt: new Date() })
      .where(eq(schema.shopResourceUsage.shopId, shopId));
  }

  deleteProduct(productId: string, shopId: string) {
    return this.db.delete(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)));
  }

  findVariantBySku(sku: string) {
    return this.db.query.productVariants.findFirst({
      where: eq(schema.productVariants.sku, sku),
    });
  }

  async insertVariant(productId: string, variantData: Omit<CreateVariantDto, 'attributeValues'>) {
    const [variant] = await this.db.insert(schema.productVariants).values({
      productId,
      ...variantData,
      price: String(variantData.price),
      compareAtPrice: variantData.compareAtPrice ? String(variantData.compareAtPrice) : null,
      costPrice: variantData.costPrice ? String(variantData.costPrice) : null,
    }).returning();
    return variant;
  }

  insertVariantAttributeValues(variantId: string, attributeValues: CreateVariantDto['attributeValues']) {
    return this.db.insert(schema.variantAttributeValues).values(
      (attributeValues ?? []).map((av) => ({ variantId, ...av })),
    );
  }

  refreshProductPriceStats(productId: string) {
    return this.db.execute(
      sql`UPDATE products SET
            min_price_npr = (SELECT MIN(price) FROM product_variants WHERE product_id = ${productId} AND is_active = true),
            max_price_npr = (SELECT MAX(price) FROM product_variants WHERE product_id = ${productId} AND is_active = true),
            active_variant_count = (SELECT COUNT(*) FROM product_variants WHERE product_id = ${productId} AND is_active = true),
            updated_at = NOW()
          WHERE id = ${productId}`,
    );
  }

  findProductMediaByProductId(productId: string) {
    return this.db.query.productMedia.findMany({
      where: eq(schema.productMedia.productId, productId),
    });
  }

  async insertProductMedia(productId: string, dto: AddMediaDto, isPrimary: boolean, sortOrder: number) {
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
    return media;
  }

  updateProductPrimaryImage(productId: string, url: string) {
    return this.db.update(schema.products)
      .set({ primaryImageUrl: url, updatedAt: new Date() })
      .where(eq(schema.products.id, productId));
  }

  updateShopStorageUsage(shopId: string, storageMb: number) {
    return this.db.update(schema.shopResourceUsage)
      .set({ storageMbUsed: sql`storage_mb_used + ${storageMb}` })
      .where(eq(schema.shopResourceUsage.shopId, shopId));
  }

  findProductInShop(productId: string, shopId: string) {
    return this.db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)),
    });
  }

  findShopSubscription(shopId: string) {
    return this.db.query.shopSubscriptions.findFirst({
      where: eq(schema.shopSubscriptions.shopId, shopId),
    });
  }
}
