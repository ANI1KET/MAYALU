import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';

@Injectable()
export class ShopsRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findUserById(userId: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
  }

  findShopByOwnerUserId(userId: string) {
    return this.db.query.shops.findFirst({
      where: eq(schema.shops.ownerUserId, userId),
    });
  }

  findShopBySlug(slug: string) {
    return this.db.query.shops.findFirst({
      where: eq(schema.shops.slug, slug),
    });
  }

  findPlanBySlug(slug: string) {
    return this.db.query.plans.findFirst({
      where: eq(schema.plans.slug, slug),
    });
  }

  async createShopWithSubscription(params: {
    userId: string;
    dto: CreateShopDto;
    slug: string;
    plan: typeof schema.plans.$inferSelect;
    now: Date;
    periodEnd: Date;
  }) {
    const { userId, dto, slug, plan, now, periodEnd } = params;

    return this.db.transaction(async (tx) => {
      const [shop] = await tx.insert(schema.shops).values({
        ownerUserId: userId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        businessAddress: dto.businessAddress ?? null,
        businessPhone: dto.businessPhone ?? null,
        panNumber: dto.panNumber ?? null,
        status: 'pending',
        verificationStatus: 'unverified',
      }).returning();

      if (!shop) return undefined;

      const planSnapshot = {
        maxProducts: plan.maxProducts,
        maxVariantsPerProduct: plan.maxVariantsPerProduct,
        maxImagesPerProduct: plan.maxImagesPerProduct,
        maxWarehouses: plan.maxWarehouses,
        maxStaffMembers: plan.maxStaffMembers,
        storageGb: plan.storageGb,
        canUseCod: plan.canUseCod,
        canUseEsewa: plan.canUseEsewa,
        canUseDiscounts: plan.canUseDiscounts,
        canUseAnalytics: plan.canUseAnalytics,
        commissionRate: plan.commissionRate,
      };

      await tx.insert(schema.shopSubscriptions).values({
        shopId: shop.id,
        planId: plan.id,
        status: 'trialing',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        planFeaturesSnapshot: planSnapshot,
      });

      await tx.insert(schema.shopMembers).values({
        shopId: shop.id,
        userId,
        role: 'owner',
        acceptedAt: now,
      });

      await tx.insert(schema.shopResourceUsage).values({
        shopId: shop.id,
        totalProducts: 0,
        totalActiveProducts: 0,
        totalVariants: 0,
        totalStaffMembers: 1,
        storageMbUsed: '0',
      });

      return shop;
    });
  }

  findShopBySlugWithRelations(slug: string) {
    return this.db.query.shops.findFirst({
      where: eq(schema.shops.slug, slug),
      with: {
        owner: { columns: { phone: true, fullName: true, avatarUrl: true } },
        resourceUsage: true,
      } as never,
    });
  }

  findShopById(id: string) {
    return this.db.query.shops.findFirst({
      where: eq(schema.shops.id, id),
    });
  }

  findShopByOwnerUserIdWithRelations(userId: string) {
    return this.db.query.shops.findFirst({
      where: eq(schema.shops.ownerUserId, userId),
      with: { subscription: true, resourceUsage: true } as never,
    });
  }

  async updateShop(shopId: string, dto: UpdateShopDto) {
    const [updated] = await this.db
      .update(schema.shops)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.shops.id, shopId))
      .returning();

    return updated;
  }

  findSubscriptionByShopId(shopId: string) {
    return this.db.query.shopSubscriptions.findFirst({
      where: eq(schema.shopSubscriptions.shopId, shopId),
    });
  }

  findUsageByShopId(shopId: string) {
    return this.db.query.shopResourceUsage.findFirst({
      where: eq(schema.shopResourceUsage.shopId, shopId),
    });
  }

  findMembersByShopId(shopId: string) {
    return this.db.query.shopMembers.findMany({
      where: eq(schema.shopMembers.shopId, shopId),
      with: { user: { columns: { phone: true, fullName: true, avatarUrl: true } } } as never,
    });
  }
}
