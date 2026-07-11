import { Injectable, Logger } from '@nestjs/common';
import { getConfig } from '../../config/app.config';
import {
  MENU_BY_ROLE,
  ROLE_PERMISSIONS,
  type MenuItem,
  type RolePermissions,
} from '../../common/constants/navigation.constants';
import { NavigationRepository } from './navigation.repository';
import type {
  NavBadges,
  PlanFeatureFlags,
  NavigationResponse,
} from './dto/navigation.dto';

export type { NavigationResponse } from './dto/navigation.dto';

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);
  private readonly adminUserIds: Set<string>;

  constructor(
    private readonly navigationRepository: NavigationRepository,
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
      this.navigationRepository.findShopMembership(userId),
      this.navigationRepository.countUnreadNotifications(userId),
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
      const r = await this.navigationRepository.countAllPendingOrders();
      return parseInt(r.rows[0]?.count ?? '0', 10);
    }

    if (shopId && ['owner', 'manager', 'support'].includes(role)) {
      const r = await this.navigationRepository.countShopPendingOrders(shopId);
      return parseInt(r.rows[0]?.count ?? '0', 10);
    }

    if (role === 'customer') {
      const r = await this.navigationRepository.countCustomerPendingOrders(userId);
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
