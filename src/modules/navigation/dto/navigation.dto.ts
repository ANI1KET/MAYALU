import type {
  MenuItem,
  RolePermissions,
} from '../../../common/constants/navigation.constants';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NavBadges {
  pendingOrders: number;
  unreadNotifications: number;
}

export interface PlanFeatureFlags {
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
