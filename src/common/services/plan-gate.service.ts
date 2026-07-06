import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

export type ResourceKey = 'products' | 'variants' | 'staff' | 'warehouses';

export interface PlanLimits {
  maxProducts: number;
  maxVariantsPerProduct: number;
  maxWarehouses: number;
  maxStaffMembers: number;
}

@Injectable()
export class PlanGateService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async assertLimit(shopId: string, resource: ResourceKey, limits: PlanLimits): Promise<void> {
    const max = this.getMax(resource, limits);
    if (max === -1) return; // unlimited — never touch DB

    const usage = await this.db.query.shopResourceUsage.findFirst({
      where: eq(schema.shopResourceUsage.shopId, shopId),
    });

    const current = this.getCurrent(resource, usage);

    if (current >= max) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        message: `${this.getLabel(resource)} limit reached (${current}/${max}). Upgrade your plan.`,
        details: { current, max, resource },
      });
    }
  }

  async incrementUsage(shopId: string, resource: ResourceKey): Promise<void> {
    const patch = this.buildIncrement(resource);
    if (!patch) return;
    await this.db
      .update(schema.shopResourceUsage)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.shopResourceUsage.shopId, shopId));
  }

  async decrementUsage(shopId: string, resource: ResourceKey): Promise<void> {
    const patch = this.buildDecrement(resource);
    if (!patch) return;
    await this.db
      .update(schema.shopResourceUsage)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.shopResourceUsage.shopId, shopId));
  }

  private getMax(resource: ResourceKey, limits: PlanLimits): number {
    switch (resource) {
      case 'products':   return limits.maxProducts;
      case 'variants':   return limits.maxVariantsPerProduct;
      case 'warehouses': return limits.maxWarehouses;
      case 'staff':      return limits.maxStaffMembers;
    }
  }

  private getCurrent(
    resource: ResourceKey,
    usage: typeof schema.shopResourceUsage.$inferSelect | undefined,
  ): number {
    if (!usage) return 0;
    switch (resource) {
      case 'products':   return usage.totalProducts;
      case 'variants':   return usage.totalVariants;
      case 'warehouses': return 0;
      case 'staff':      return usage.totalStaffMembers;
    }
  }

  private getLabel(resource: ResourceKey): string {
    const labels: Record<ResourceKey, string> = {
      products: 'Product', variants: 'Variant',
      warehouses: 'Warehouse', staff: 'Staff member',
    };
    return labels[resource];
  }

  private buildIncrement(resource: ResourceKey): Record<string, ReturnType<typeof sql>> | null {
    switch (resource) {
      case 'products':
        return { totalProducts: sql`total_products + 1` };
      case 'variants':
        return { totalVariants: sql`total_variants + 1` };
      case 'staff':
        return { totalStaffMembers: sql`total_staff_members + 1` };
      default:
        return null;
    }
  }

  private buildDecrement(resource: ResourceKey): Record<string, ReturnType<typeof sql>> | null {
    switch (resource) {
      case 'products':
        return { totalProducts: sql`GREATEST(total_products - 1, 0)` };
      case 'variants':
        return { totalVariants: sql`GREATEST(total_variants - 1, 0)` };
      case 'staff':
        return { totalStaffMembers: sql`GREATEST(total_staff_members - 1, 0)` };
      default:
        return null;
    }
  }
}
