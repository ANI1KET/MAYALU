/**
 * Navigation Constants — Role-Based Sidebar Menu Definitions
 *
 * All menu structures are defined here as constants.
 * The NavigationService does O(1) lookup by role — zero DB reads for structure.
 * Only badge counts (pending orders, unread notifications) require DB queries.
 *
 * Icons use Lucide React icon names (consistent with most Nepal frontend stacks).
 */

export type MenuItemId = string;

export interface MenuItem {
  id: MenuItemId;
  label: string;
  icon: string;
  path: string;
  /** Permission key that must be true in the user's permission set */
  permission?: string;
  /** Plan feature that must be enabled */
  planFeature?: string;
  /** Badge config: 'pendingOrders' | 'unreadNotifications' | null */
  badge?: 'pendingOrders' | 'unreadNotifications' | null;
  children?: Omit<MenuItem, 'children'>[];
}

export interface RolePermissions {
  canViewDashboard: boolean;
  canCreateProduct: boolean;
  canEditProduct: boolean;
  canDeleteProduct: boolean;
  canPublishProduct: boolean;
  canManageInventory: boolean;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canManageCoupons: boolean;
  canViewAnalytics: boolean;
  canManageBanners: boolean;
  canManageStaff: boolean;
  canManageSettings: boolean;
  canManageShopProfile: boolean;
  canViewCustomers: boolean;
}

// ─── Role → Permission Map ─────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  owner: {
    canViewDashboard:    true,
    canCreateProduct:    true,
    canEditProduct:      true,
    canDeleteProduct:    true,
    canPublishProduct:   true,
    canManageInventory:  true,
    canViewOrders:       true,
    canUpdateOrderStatus:true,
    canManageCoupons:    true,
    canViewAnalytics:    true,
    canManageBanners:    true,
    canManageStaff:      true,
    canManageSettings:   true,
    canManageShopProfile:true,
    canViewCustomers:    true,
  },
  manager: {
    canViewDashboard:    true,
    canCreateProduct:    true,
    canEditProduct:      true,
    canDeleteProduct:    false,
    canPublishProduct:   true,
    canManageInventory:  true,
    canViewOrders:       true,
    canUpdateOrderStatus:true,
    canManageCoupons:    true,
    canViewAnalytics:    true,
    canManageBanners:    false,
    canManageStaff:      false,
    canManageSettings:   false,
    canManageShopProfile:true,
    canViewCustomers:    true,
  },
  inventory: {
    canViewDashboard:    true,
    canCreateProduct:    true,
    canEditProduct:      true,
    canDeleteProduct:    false,
    canPublishProduct:   false,
    canManageInventory:  true,
    canViewOrders:       true,
    canUpdateOrderStatus:false,
    canManageCoupons:    false,
    canViewAnalytics:    false,
    canManageBanners:    false,
    canManageStaff:      false,
    canManageSettings:   false,
    canManageShopProfile:false,
    canViewCustomers:    false,
  },
  support: {
    canViewDashboard:    true,
    canCreateProduct:    false,
    canEditProduct:      false,
    canDeleteProduct:    false,
    canPublishProduct:   false,
    canManageInventory:  false,
    canViewOrders:       true,
    canUpdateOrderStatus:true,
    canManageCoupons:    false,
    canViewAnalytics:    false,
    canManageBanners:    false,
    canManageStaff:      false,
    canManageSettings:   false,
    canManageShopProfile:false,
    canViewCustomers:    true,
  },
  analyst: {
    canViewDashboard:    true,
    canCreateProduct:    false,
    canEditProduct:      false,
    canDeleteProduct:    false,
    canPublishProduct:   false,
    canManageInventory:  false,
    canViewOrders:       true,
    canUpdateOrderStatus:false,
    canManageCoupons:    false,
    canViewAnalytics:    true,
    canManageBanners:    false,
    canManageStaff:      false,
    canManageSettings:   false,
    canManageShopProfile:false,
    canViewCustomers:    false,
  },
  customer: {
    canViewDashboard:    false,
    canCreateProduct:    false,
    canEditProduct:      false,
    canDeleteProduct:    false,
    canPublishProduct:   false,
    canManageInventory:  false,
    canViewOrders:       true,
    canUpdateOrderStatus:false,
    canManageCoupons:    false,
    canViewAnalytics:    false,
    canManageBanners:    false,
    canManageStaff:      false,
    canManageSettings:   false,
    canManageShopProfile:false,
    canViewCustomers:    false,
  },
  admin: {
    canViewDashboard:    true,
    canCreateProduct:    true,
    canEditProduct:      true,
    canDeleteProduct:    true,
    canPublishProduct:   true,
    canManageInventory:  true,
    canViewOrders:       true,
    canUpdateOrderStatus:true,
    canManageCoupons:    true,
    canViewAnalytics:    true,
    canManageBanners:    true,
    canManageStaff:      true,
    canManageSettings:   true,
    canManageShopProfile:true,
    canViewCustomers:    true,
  },
};

// ─── Menu Definitions per Role ─────────────────────────────────────────────

export const CUSTOMER_MENU: MenuItem[] = [
  { id: 'home',          label: 'Home',            icon: 'Home',           path: '/' },
  { id: 'browse',        label: 'Browse',          icon: 'Grid',           path: '/browse' },
  { id: 'cart',          label: 'My Cart',         icon: 'ShoppingCart',   path: '/cart' },
  { id: 'wishlist',      label: 'Wishlist',        icon: 'Heart',          path: '/wishlist' },
  {
    id: 'orders',
    label: 'My Orders',
    icon: 'Package',
    path: '/orders',
    permission: 'canViewOrders',
    children: [
      { id: 'orders.active',    label: 'Active',    icon: 'Clock',     path: '/orders?status=active' },
      { id: 'orders.delivered', label: 'Delivered', icon: 'CheckCircle',path: '/orders?status=delivered' },
      { id: 'orders.cancelled', label: 'Cancelled', icon: 'XCircle',   path: '/orders?status=cancelled' },
    ],
  },
  { id: 'notifications',label: 'Notifications', icon: 'Bell', path: '/notifications', badge: 'unreadNotifications' },
  { id: 'profile',      label: 'My Profile',    icon: 'User', path: '/profile' },
];

export const SHOP_STAFF_MENU: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/cms/dashboard',
    permission: 'canViewDashboard',
  },
  {
    id: 'products',
    label: 'Products',
    icon: 'Package',
    path: '/cms/products',
    permission: 'canEditProduct',
    children: [
      { id: 'products.list',    label: 'All Products', icon: 'List',     path: '/cms/products',       permission: 'canEditProduct' },
      { id: 'products.add',     label: 'Add Product',  icon: 'Plus',     path: '/cms/products/new',   permission: 'canCreateProduct' },
      { id: 'products.publish', label: 'Published',    icon: 'CheckSquare', path: '/cms/products?status=active', permission: 'canEditProduct' },
      { id: 'products.drafts',  label: 'Drafts',       icon: 'Edit',     path: '/cms/products?status=draft',  permission: 'canEditProduct' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'Warehouse',
    path: '/cms/inventory',
    permission: 'canManageInventory',
    children: [
      { id: 'inventory.stock',     label: 'Stock Levels',  icon: 'BarChart2',   path: '/cms/inventory' },
      { id: 'inventory.low',       label: 'Low Stock',     icon: 'AlertTriangle',path: '/cms/inventory/low-stock' },
      { id: 'inventory.warehouses',label: 'Warehouses',    icon: 'Building',    path: '/cms/inventory/warehouses' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: 'ShoppingBag',
    path: '/cms/orders',
    permission: 'canViewOrders',
    badge: 'pendingOrders',
    children: [
      { id: 'orders.pending',   label: 'Pending',   icon: 'Clock',      path: '/cms/orders?status=pending' },
      { id: 'orders.confirmed', label: 'Confirmed', icon: 'Check',      path: '/cms/orders?status=confirmed' },
      { id: 'orders.shipped',   label: 'Shipped',   icon: 'Truck',      path: '/cms/orders?status=shipped' },
      { id: 'orders.delivered', label: 'Delivered', icon: 'CheckCircle',path: '/cms/orders?status=delivered' },
    ],
  },
  {
    id: 'coupons',
    label: 'Coupons',
    icon: 'Tag',
    path: '/cms/coupons',
    permission: 'canManageCoupons',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'TrendingUp',
    path: '/cms/analytics',
    permission: 'canViewAnalytics',
    planFeature: 'canUseAnalytics',
    children: [
      { id: 'analytics.sales',   label: 'Sales',       icon: 'DollarSign', path: '/cms/analytics/sales' },
      { id: 'analytics.products',label: 'Products',    icon: 'Package',    path: '/cms/analytics/products' },
      { id: 'analytics.traffic', label: 'Traffic',     icon: 'Activity',   path: '/cms/analytics/traffic' },
    ],
  },
  {
    id: 'banners',
    label: 'Banners',
    icon: 'Image',
    path: '/cms/banners',
    permission: 'canManageBanners',
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'Users',
    path: '/cms/team',
    permission: 'canManageStaff',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    path: '/cms/settings',
    permission: 'canManageSettings',
    children: [
      { id: 'settings.shop',        label: 'Shop Profile',   icon: 'Store',      path: '/cms/settings/shop', permission: 'canManageShopProfile' },
      { id: 'settings.billing',     label: 'Billing & Plan', icon: 'CreditCard', path: '/cms/settings/billing', permission: 'canManageSettings' },
      { id: 'settings.delivery',    label: 'Delivery',       icon: 'Truck',      path: '/cms/settings/delivery', permission: 'canManageSettings' },
    ],
  },
];

export const ADMIN_MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/admin/dashboard' },
  {
    id: 'shops',
    label: 'Shops',
    icon: 'Store',
    path: '/admin/shops',
    children: [
      { id: 'shops.pending',  label: 'Pending Review', icon: 'Clock',     path: '/admin/shops?status=pending' },
      { id: 'shops.active',   label: 'Active',         icon: 'Check',     path: '/admin/shops?status=active' },
      { id: 'shops.suspended',label: 'Suspended',      icon: 'Ban',       path: '/admin/shops?status=suspended' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: 'ShoppingBag',
    path: '/admin/orders',
    badge: 'pendingOrders',
    children: [
      { id: 'orders.pending',  label: 'Pending',   icon: 'Clock',      path: '/admin/orders?status=pending' },
      { id: 'orders.shipped',  label: 'Shipped',   icon: 'Truck',      path: '/admin/orders?status=shipped' },
      { id: 'orders.all',      label: 'All Orders',icon: 'List',       path: '/admin/orders' },
    ],
  },
  { id: 'products',       label: 'Products',       icon: 'Package',      path: '/admin/products' },
  { id: 'users',          label: 'Users',          icon: 'Users',        path: '/admin/users' },
  { id: 'coupons',        label: 'Coupons',        icon: 'Tag',          path: '/admin/coupons' },
  { id: 'banners',        label: 'Banners',        icon: 'Image',        path: '/admin/banners' },
  { id: 'reviews',        label: 'Reviews',        icon: 'Star',         path: '/admin/reviews' },
  { id: 'delivery',       label: 'Delivery Zones', icon: 'Truck',        path: '/admin/delivery' },
  { id: 'plans',          label: 'Plans',          icon: 'CreditCard',   path: '/admin/plans' },
];

/** O(1) lookup: role → menu definition */
export const MENU_BY_ROLE: Record<string, MenuItem[]> = {
  customer: CUSTOMER_MENU,
  owner:    SHOP_STAFF_MENU,
  manager:  SHOP_STAFF_MENU,
  inventory: SHOP_STAFF_MENU,
  support:  SHOP_STAFF_MENU,
  analyst:  SHOP_STAFF_MENU,
  admin:    ADMIN_MENU,
};
