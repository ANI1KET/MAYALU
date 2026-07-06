import {
  Injectable, Inject, BadRequestException,
  ConflictException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';
import { slugify } from '../../common/utils/slug.util';
import { DEFAULT_PLAN_SLUG } from '../../common/constants/index';

@Injectable()
export class ShopsService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(userId: string, dto: CreateShopDto) {
    // Phone must be verified
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user?.isPhoneVerified) {
      throw new ForbiddenException({
        code: 'PHONE_NOT_VERIFIED',
        message: 'Phone number must be verified before creating a shop.',
      });
    }

    // One shop per user
    const existing = await this.db.query.shops.findFirst({
      where: eq(schema.shops.ownerUserId, userId),
    });

    if (existing) {
      throw new ConflictException({
        code: 'SHOP_ALREADY_EXISTS',
        message: 'You already own a shop. Only one shop per user is allowed.',
      });
    }

    // Auto-generate slug from name if not provided
    const slug = dto.slug ?? slugify(dto.name);

    // Slug must be unique
    const slugTaken = await this.db.query.shops.findFirst({
      where: eq(schema.shops.slug, slug),
    });

    if (slugTaken) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: `The slug "${slug}" is already taken. Please choose another.`,
      });
    }

    // Resolve plan (always starter for new shops)
    const plan = await this.db.query.plans.findFirst({
      where: eq(schema.plans.slug, DEFAULT_PLAN_SLUG),
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: `Starter plan not found. Run: pnpm db:seed`,
      });
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);

    // Atomic: shop + subscription + member + usage
    const result = await this.db.transaction(async (tx) => {
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

      if (!shop) throw new BadRequestException('Failed to create shop');

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

    return result;
  }

  async findBySlug(slug: string) {
    const shop = await this.db.query.shops.findFirst({
      where: eq(schema.shops.slug, slug),
      with: {
        owner: { columns: { phone: true, fullName: true, avatarUrl: true } },
        resourceUsage: true,
      } as never,
    });

    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: `Shop "${slug}" not found` });
    }

    return shop;
  }

  async findById(id: string) {
    const shop = await this.db.query.shops.findFirst({
      where: eq(schema.shops.id, id),
    });

    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    return shop;
  }

  async findByOwner(userId: string) {
    return this.db.query.shops.findFirst({
      where: eq(schema.shops.ownerUserId, userId),
      with: { subscription: true, resourceUsage: true } as never,
    });
  }

  async update(shopId: string, dto: UpdateShopDto) {
    const [updated] = await this.db
      .update(schema.shops)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.shops.id, shopId))
      .returning();

    if (!updated) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }
    return updated;
  }

  async getSubscription(shopId: string) {
    const sub = await this.db.query.shopSubscriptions.findFirst({
      where: eq(schema.shopSubscriptions.shopId, shopId),
    });

    if (!sub) {
      throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found' });
    }
    return sub;
  }

  async getUsage(shopId: string) {
    const usage = await this.db.query.shopResourceUsage.findFirst({
      where: eq(schema.shopResourceUsage.shopId, shopId),
    });

    if (!usage) {
      throw new NotFoundException({ code: 'USAGE_NOT_FOUND', message: 'Resource usage not found' });
    }
    return usage;
  }

  async getMembers(shopId: string) {
    return this.db.query.shopMembers.findMany({
      where: eq(schema.shopMembers.shopId, shopId),
      with: { user: { columns: { phone: true, fullName: true, avatarUrl: true } } } as never,
    });
  }

  async getActivePlanLimits(shopId: string) {
    const sub = await this.db.query.shopSubscriptions.findFirst({
      where: eq(schema.shopSubscriptions.shopId, shopId),
    });

    if (!sub) return null;

    const snapshot = sub.planFeaturesSnapshot as Record<string, number>;
    return {
      maxProducts:            snapshot['maxProducts']            ?? 50,
      maxVariantsPerProduct:  snapshot['maxVariantsPerProduct']  ?? 10,
      maxImagesPerProduct:    snapshot['maxImagesPerProduct']    ?? 5,
      maxWarehouses:          snapshot['maxWarehouses']          ?? 1,
      maxStaffMembers:        snapshot['maxStaffMembers']        ?? 1,
    };
  }
}
