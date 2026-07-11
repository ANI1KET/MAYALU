import {
  Injectable, BadRequestException,
  ConflictException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { ShopsRepository } from './shops.repository';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';
import { slugify } from '../../common/utils/slug.util';
import { DEFAULT_PLAN_SLUG } from '../../common/constants/index';

@Injectable()
export class ShopsService {
  constructor(private readonly shopsRepository: ShopsRepository) {}

  async create(userId: string, dto: CreateShopDto) {
    // Phone must be verified
    const user = await this.shopsRepository.findUserById(userId);

    if (!user?.isPhoneVerified) {
      throw new ForbiddenException({
        code: 'PHONE_NOT_VERIFIED',
        message: 'Phone number must be verified before creating a shop.',
      });
    }

    // One shop per user
    const existing = await this.shopsRepository.findShopByOwnerUserId(userId);

    if (existing) {
      throw new ConflictException({
        code: 'SHOP_ALREADY_EXISTS',
        message: 'You already own a shop. Only one shop per user is allowed.',
      });
    }

    // Auto-generate slug from name if not provided
    const slug = dto.slug ?? slugify(dto.name);

    // Slug must be unique
    const slugTaken = await this.shopsRepository.findShopBySlug(slug);

    if (slugTaken) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: `The slug "${slug}" is already taken. Please choose another.`,
      });
    }

    // Resolve plan (always starter for new shops)
    const plan = await this.shopsRepository.findPlanBySlug(DEFAULT_PLAN_SLUG);

    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: `Starter plan not found. Run: pnpm db:seed`,
      });
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);

    // Atomic: shop + subscription + member + usage
    const result = await this.shopsRepository.createShopWithSubscription({
      userId, dto, slug, plan, now, periodEnd,
    });

    if (!result) throw new BadRequestException('Failed to create shop');

    return result;
  }

  async findBySlug(slug: string) {
    const shop = await this.shopsRepository.findShopBySlugWithRelations(slug);

    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: `Shop "${slug}" not found` });
    }

    return shop;
  }

  async findById(id: string) {
    const shop = await this.shopsRepository.findShopById(id);

    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    return shop;
  }

  async findByOwner(userId: string) {
    return this.shopsRepository.findShopByOwnerUserIdWithRelations(userId);
  }

  async update(shopId: string, dto: UpdateShopDto) {
    const updated = await this.shopsRepository.updateShop(shopId, dto);

    if (!updated) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }
    return updated;
  }

  async getSubscription(shopId: string) {
    const sub = await this.shopsRepository.findSubscriptionByShopId(shopId);

    if (!sub) {
      throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found' });
    }
    return sub;
  }

  async getUsage(shopId: string) {
    const usage = await this.shopsRepository.findUsageByShopId(shopId);

    if (!usage) {
      throw new NotFoundException({ code: 'USAGE_NOT_FOUND', message: 'Resource usage not found' });
    }
    return usage;
  }

  async getMembers(shopId: string) {
    return this.shopsRepository.findMembersByShopId(shopId);
  }

  async getActivePlanLimits(shopId: string) {
    const sub = await this.shopsRepository.findSubscriptionByShopId(shopId);

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
