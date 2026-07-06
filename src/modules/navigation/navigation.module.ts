import {
  Injectable, Inject, Controller, Get, UseGuards, Module, Logger,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth,
  ApiOkResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NavigationResponseDto, ErrorResponseDto } from '../../common/swagger/response.dto';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';
import { getConfig } from '../../config/app.config';
import {
  MENU_BY_ROLE,
  ROLE_PERMISSIONS,
  type MenuItem,
  type RolePermissions,
} from '../../common/constants/navigation.constants';

// ── Types ────────────────────────────────────────────────────────────────────

interface NavBadges {
  pendingOrders: number;
  unreadNotifications: number;
}

interface PlanFeatureFlags {
  canUseAnalytics:  boolean;
  canUseDiscounts:  boolean;
  canUseEsewa:      boolean;
  canUseBulkImport: boolean;
  canUseSeoTools:   boolean;
}

export interface NavigationResponse {
  role: string;
  shopId: string | null;
  permissions: RolePermissions;
  planFeatures: PlanFeatureFlags;
  menu: MenuItem[];
  badges: NavBadges;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);
  private readonly adminUserIds: Set<string>;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {
    const cfg = getConfig();
    // Admin IDs from env — avoids a DB admin_users table for v1
    this.adminUserIds = new Set(
      cfg.ADMIN_USER_IDS.split(',').map((s) => s.trim()).filter(Boolean),
    );
  }

  /**
   * Build sidebar navigation for a user.
   *
   * Time complexity:
   *   O(1) — 3 parallel DB queries max regardless of data size:
   *     1. shop_members  (single row, indexed on userId)
   *     2. notifications (partial index: user_id, is_read WHERE false)
   *     3. pending orders badge (indexed on status + user_id/shop_id)
   *   Menu structure: O(1) — constant map lookup
   *   Permission filter: O(m) — m ≤ 25 menu items (bounded constant)
   */
  async getNavigation(userId: string): Promise<NavigationResponse> {
    // ── 1. Parallel: membership + unread count ──────────────────────
    const [shopMembership, unreadResult] = await Promise.all([
      this.db.query.shopMembers.findFirst({
        where: and(
          eq(schema.shopMembers.userId, userId),
          isNull(schema.shopMembers.revokedAt),
        ),
        with: {
          shop: { with: { subscription: true } as never },
        } as never,
      }),
      this.db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM notifications
            WHERE user_id = ${userId} AND is_read = false`,
      ),
    ]);

    // ── 2. Resolve role — O(1) ──────────────────────────────────────
    const isAdmin = this.adminUserIds.has(userId);
    let role = 'customer';
    let shopId: string | null = null;
    let planFeatures = this.defaultPlanFeatures();

    if (isAdmin) {
      role = 'admin';
    } else if (shopMembership) {
      role = shopMembership.role;
      shopId = shopMembership.shopId;

      // Plan features from JSONB snapshot — no extra JOIN to plans table
      const m = shopMembership as typeof shopMembership & {
        shop: { subscription: { planFeaturesSnapshot: Record<string, boolean> } | null };
      };
      const snap = m.shop?.subscription?.planFeaturesSnapshot;
      if (snap) {
        planFeatures = {
          canUseAnalytics:  snap['canUseAnalytics']  ?? false,
          canUseDiscounts:  snap['canUseDiscounts']  ?? false,
          canUseEsewa:      snap['canUseEsewa']      ?? false,
          canUseBulkImport: snap['canUseBulkImport'] ?? false,
          canUseSeoTools:   snap['canUseSeoTools']   ?? false,
        };
      }
    }

    // ── 3. Permissions: O(1) constant lookup ────────────────────────
    const permissions: RolePermissions =
      ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['customer']!;

    // ── 4. Badge counts — single indexed query ──────────────────────
    const [pendingOrders] = await Promise.all([
      this.resolvePendingOrders(role, userId, shopId),
    ]);

    const badges: NavBadges = {
      pendingOrders,
      unreadNotifications: parseInt(unreadResult.rows[0]?.count ?? '0', 10),
    };

    // ── 5. Filter menu — O(m), m ≤ 25 ──────────────────────────────
    const rawMenu: MenuItem[] = MENU_BY_ROLE[role] ?? MENU_BY_ROLE['customer']!;
    const menu = this.filterMenu(rawMenu, permissions, planFeatures, badges);

    return { role, shopId, permissions, planFeatures, menu, badges };
  }

  private filterMenu(
    items: MenuItem[],
    perms: RolePermissions,
    plan: PlanFeatureFlags,
    badges: NavBadges,
  ): MenuItem[] {
    const result: MenuItem[] = [];

    for (const item of items) {
      // Permission gate
      if (item.permission) {
        const key = item.permission as keyof RolePermissions;
        if (!perms[key]) continue;
      }
      // Plan feature gate
      if (item.planFeature) {
        const key = item.planFeature as keyof PlanFeatureFlags;
        if (!plan[key]) continue;
      }

      const badgeCount = item.badge ? badges[item.badge] : undefined;
      const children = item.children
        ? this.filterMenu(item.children as MenuItem[], perms, plan, badges)
        : undefined;

      result.push({
        ...item,
        badge: undefined,
        ...(badgeCount !== undefined && badgeCount > 0
          ? { badgeCount }
          : {}),
        ...(children && children.length > 0 ? { children } : { children: undefined }),
      } as MenuItem);
    }

    return result;
  }

  private async resolvePendingOrders(
    role: string,
    userId: string,
    shopId: string | null,
  ): Promise<number> {
    if (role === 'admin') {
      const r = await this.db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM orders WHERE status = 'pending'`,
      );
      return parseInt(r.rows[0]?.count ?? '0', 10);
    }

    if (shopId && ['owner', 'manager', 'support'].includes(role)) {
      const r = await this.db.execute<{ count: string }>(
        sql`SELECT COUNT(DISTINCT o.id)::text AS count
            FROM orders o
            INNER JOIN order_items oi ON oi.order_id = o.id
            WHERE o.status = 'pending' AND oi.shop_id = ${shopId}`,
      );
      return parseInt(r.rows[0]?.count ?? '0', 10);
    }

    if (role === 'customer') {
      const r = await this.db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM orders WHERE user_id = ${userId} AND status IN ('pending','confirmed','packed','shipped')`,
      );
      return parseInt(r.rows[0]?.count ?? '0', 10);
    }

    return 0;
  }

  private defaultPlanFeatures(): PlanFeatureFlags {
    return {
      canUseAnalytics:  false,
      canUseDiscounts:  false,
      canUseEsewa:      false,
      canUseBulkImport: false,
      canUseSeoTools:   false,
    };
  }
}

// ── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Navigation')
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get sidebar navigation for current user',
    description:
      'Returns role-based menu, permissions, plan features, and badge counts. ' +
      '**Roles**: customer | owner | manager | inventory | support | analyst | admin. ' +
      '**O(1) complexity**: menu structure from constants (no DB query), ' +
      'plan features from JSONB snapshot (no JOIN to plans table), ' +
      'badge counts from indexed partial queries. ' +
      '3 parallel DB calls maximum.',
  })
  @ApiOkResponse({ type: NavigationResponseDto, description: 'Role-based navigation with live badge counts' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'MISSING_ACCESS_TOKEN' })
  getNavigation(@CurrentUser() user: { sub: string }): Promise<NavigationResponse> {
    return this.navigationService.getNavigation(user.sub);
  }
}

// ── Module ───────────────────────────────────────────────────────────────────

@Module({
  controllers: [NavigationController],
  providers: [NavigationService, JwtService],
  exports: [NavigationService],
})
export class NavigationModule {}
