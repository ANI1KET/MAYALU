/**
 * Swagger Response Schemas
 * Typed DTOs used exclusively for @ApiResponse({ type: XxxResponseDto })
 * These define the exact shape of every API response in Swagger UI.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Shared ────────────────────────────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  timestamp?: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 120 }) total!: number;
  @ApiProperty({ example: 1 })   page!: number;
  @ApiProperty({ example: 20 })  limit!: number;
  @ApiProperty({ example: 6 })   totalPages!: number;
  @ApiProperty({ example: true }) hasNextPage!: boolean;
  @ApiProperty({ example: false }) hasPrevPage!: boolean;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export class UserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: '+9779841234567' }) phone!: string;
  @ApiPropertyOptional({ example: 'sita@example.com', nullable: true }) email!: string | null;
  @ApiPropertyOptional({ example: 'Sita Rai', nullable: true }) fullName!: string | null;
  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ example: 'active' }) status!: string;
  @ApiProperty({ example: true }) isPhoneVerified!: boolean;
  @ApiProperty({ example: false }) isEmailVerified!: boolean;
  @ApiPropertyOptional({ example: '2025-01-01T10:00:00.000Z', nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) updatedAt!: string;
}

export class OtpSentResponseDto {
  @ApiProperty({ example: 'OTP sent to +9779841234567. Valid for 5 minutes.' })
  message!: string;

  @ApiProperty({ example: 60, description: 'Seconds before another OTP can be requested' })
  cooldownSeconds!: number;
}

export class LoginResponseDto {
  @ApiProperty({ example: false, description: 'True if this is the first login ever' })
  isNewUser!: boolean;

  @ApiProperty({ type: () => UserDto })
  user!: UserDto;
}

export class RegisterResponseDto {
  @ApiProperty({ type: () => UserDto })
  user!: UserDto;
}

// ─── Shops ─────────────────────────────────────────────────────────────────

export class ShopDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Sita Fashion House' }) name!: string;
  @ApiProperty({ example: 'sita-fashion-house' }) slug!: string;
  @ApiPropertyOptional({ example: 'Authentic Nepali fashion', nullable: true }) description!: string | null;
  @ApiProperty({ example: 'active' }) status!: string;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) businessAddress!: string | null;
  @ApiPropertyOptional({ nullable: true }) businessPhone!: string | null;
  @ApiPropertyOptional({ nullable: true }) panNumber!: string | null;
  @ApiProperty({ example: '4.5' }) avgRating!: string;
  @ApiProperty({ example: 23 }) totalReviews!: number;
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) createdAt!: string;
}

export class ShopSubscriptionDto {
  @ApiProperty({ example: 'starter' }) planSlug!: string;
  @ApiProperty({ example: 'Starter' }) planName!: string;
  @ApiProperty({ example: 'active' }) status!: string;
  @ApiPropertyOptional({ nullable: true }) trialEndsAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) currentPeriodEnd!: string | null;
}

export class ShopUsageDto {
  @ApiProperty({ example: 12 }) totalProducts!: number;
  @ApiProperty({ example: 45 }) totalVariants!: number;
  @ApiProperty({ example: 2 }) totalStaffMembers!: number;
  @ApiProperty({ example: 128.5 }) storageMbUsed!: number;
}

export class ShopMemberDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) userId!: string;
  @ApiProperty({ example: 'owner' }) role!: string;
  @ApiProperty({ example: '+9779841234567' }) phone!: string;
  @ApiPropertyOptional({ nullable: true }) fullName!: string | null;
}

// ─── Categories ────────────────────────────────────────────────────────────

export class CategoryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Women' }) name!: string;
  @ApiProperty({ example: 'women' }) slug!: string;
  @ApiProperty({ example: 'women' }) path!: string;
  @ApiPropertyOptional({ nullable: true }) parentId!: string | null;
  @ApiPropertyOptional({ nullable: true }) imageUrl!: string | null;
  @ApiProperty({ example: 0 }) sortOrder!: number;
  @ApiPropertyOptional({ type: () => [CategoryDto] }) children?: CategoryDto[];
}

// ─── Attributes ────────────────────────────────────────────────────────────

export class AttributeOptionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Red' }) label!: string;
  @ApiProperty({ example: 'red' }) value!: string;
  @ApiPropertyOptional({ example: '#FF0000', nullable: true }) colorHex!: string | null;
  @ApiProperty({ example: 0 }) sortOrder!: number;
}

export class AttributeDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Color' }) name!: string;
  @ApiProperty({ example: 'color' }) code!: string;
  @ApiProperty({ example: 'swatch' }) inputType!: string;
  @ApiProperty({ type: () => [AttributeOptionDto] }) options!: AttributeOptionDto[];
}

// ─── Products ──────────────────────────────────────────────────────────────

export class ProductVariantDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'SKU-RED-L-001' }) sku!: string;
  @ApiProperty({ example: 'Red - L' }) name!: string;
  @ApiProperty({ example: '1299.00' }) price!: string;
  @ApiPropertyOptional({ example: '1500.00', nullable: true }) compareAtPrice!: string | null;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiPropertyOptional({ nullable: true }) imageUrl!: string | null;
}

export class ProductMediaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'https://res.cloudinary.com/...' }) url!: string;
  @ApiProperty({ example: 'image' }) type!: string;
  @ApiProperty({ example: true }) isPrimary!: boolean;
  @ApiProperty({ example: 0 }) sortOrder!: number;
}

export class ProductDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Nepali Silk Saree - Red' }) name!: string;
  @ApiProperty({ example: 'nepali-silk-saree-red' }) slug!: string;
  @ApiPropertyOptional({ nullable: true }) shortDescription!: string | null;
  @ApiProperty({ example: 'active' }) status!: string;
  @ApiProperty({ example: '4.30' }) avgRating!: string;
  @ApiProperty({ example: 142 }) totalSold!: number;
  @ApiProperty({ example: false }) isFeatured!: boolean;
  @ApiProperty({ example: true }) isTrending!: boolean;
  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', nullable: true }) primaryImageUrl!: string | null;
  @ApiPropertyOptional({ example: '999.00', nullable: true }) minPriceNpr!: string | null;
  @ApiPropertyOptional({ example: '2499.00', nullable: true }) maxPriceNpr!: string | null;
  @ApiProperty({ example: 3 }) activeVariantCount!: number;
}

export class ProductDetailDto extends ProductDto {
  @ApiProperty({ type: () => [ProductVariantDto] }) variants!: ProductVariantDto[];
  @ApiProperty({ type: () => [ProductMediaDto] }) media!: ProductMediaDto[];
}

export class ProductListResponseDto {
  @ApiProperty({ type: () => [ProductDto] }) data!: ProductDto[];
  @ApiProperty({ type: () => PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class PresignResponseDto {
  @ApiProperty({ example: 'https://api.cloudinary.com/v1_1/...' }) uploadUrl!: string;
  @ApiProperty({ example: 'mayalu-wears/products/abc123' }) publicId!: string;
  @ApiProperty({ example: '1234567890' }) signature!: string;
  @ApiProperty({ example: 1234567890 }) timestamp!: number;
  @ApiProperty({ example: 'my_cloud' }) cloudName!: string;
  @ApiProperty({ example: 'my_api_key' }) apiKey!: string;
}

// ─── Inventory ─────────────────────────────────────────────────────────────

export class WarehouseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Main Warehouse - Thamel' }) name!: string;
  @ApiProperty({ example: true }) isDefault!: boolean;
}

export class InventoryItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) inventory_id!: string;
  @ApiProperty({ example: 'SKU-RED-L-001' }) sku!: string;
  @ApiProperty({ example: 50 }) quantity_on_hand!: number;
  @ApiProperty({ example: 3 }) quantity_reserved!: number;
  @ApiProperty({ example: 47 }) quantity_available!: number;
  @ApiProperty({ example: 5 }) low_stock_threshold!: number;
}

// ─── Delivery ──────────────────────────────────────────────────────────────

export class DeliveryZoneDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'KTM' }) code!: string;
  @ApiProperty({ example: 'Kathmandu Valley' }) name!: string;
  @ApiProperty({ example: 'inside_valley' }) type!: string;
}

export class CarrierOptionDto {
  @ApiProperty({ example: 'Pathao Courier' }) name!: string;
  @ApiPropertyOptional({ example: 'PATHAO' }) code?: string;
  @ApiProperty({ example: 1 }) minDays!: number;
  @ApiProperty({ example: 2 }) maxDays!: number;
  @ApiProperty({ example: 0 }) costNpr!: number;
  @ApiProperty({ example: true }) supportsCod!: boolean;
}

export class ServiceabilityResponseDto {
  @ApiProperty({ enum: ['serviceable', 'unserviceable', 'enquiry_required'] })
  result!: string;

  @ApiPropertyOptional({ example: 'Delivery in 1-2 business days', nullable: true })
  buyerMessage!: string | null;

  @ApiProperty({ type: () => [CarrierOptionDto] })
  availableCarriers!: CarrierOptionDto[];

  @ApiPropertyOptional({ example: '0', nullable: true })
  minDeliveryCostNpr!: string | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  fastestDeliveryDays!: number | null;

  @ApiProperty({ example: false })
  fromCache!: boolean;
}

// ─── Cart ──────────────────────────────────────────────────────────────────

export class CartItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) variantId!: string;
  @ApiProperty({ example: 'Red - L' }) variantName!: string;
  @ApiProperty({ example: 'SKU-RED-L-001' }) sku!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: '1299.00' }) priceSnapshot!: string;
  @ApiProperty({ example: '2598.00' }) lineTotal!: string;
  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', nullable: true }) imageUrl!: string | null;
}

export class CartResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ type: () => [CartItemDto] }) items!: CartItemDto[];
  @ApiProperty({ example: 2 }) itemCount!: number;
  @ApiProperty({ example: '2598.00' }) subtotal!: string;
}

// ─── Orders ────────────────────────────────────────────────────────────────

export class AddressSnapshotDto {
  @ApiProperty({ example: 'Sita Rai' }) fullName!: string;
  @ApiProperty({ example: '+9779841234567' }) phone!: string;
  @ApiProperty({ example: 'Thamel, Kathmandu' }) addressLine!: string;
  @ApiProperty({ example: 'Kathmandu' }) city!: string;
  @ApiProperty({ example: 'Bagmati' }) district!: string;
  @ApiProperty({ example: 'inside_valley' }) zone!: string;
}

export class OrderItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Nepali Silk Saree - Red' }) productNameSnap!: string;
  @ApiProperty({ example: 'Red - L' }) variantNameSnap!: string;
  @ApiProperty({ example: 'SKU-RED-L-001' }) skuSnap!: string;
  @ApiPropertyOptional({ nullable: true }) imageUrlSnap!: string | null;
  @ApiProperty({ example: '1299.00' }) priceSnap!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: '2598.00' }) totalPrice!: string;
}

export class OrderStatusHistoryDto {
  @ApiProperty({ example: 'shipped' }) toStatus!: string;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiProperty({ example: '2025-01-02T10:00:00.000Z' }) changedAt!: string;
}

export class OrderDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'MW-2025-123456' }) orderNumber!: string;
  @ApiProperty({ example: 'pending' }) status!: string;
  @ApiProperty({ example: 'cod' }) paymentMethod!: string;
  @ApiProperty({ example: 'pending' }) paymentStatus!: string;
  @ApiProperty({ example: '2598.00' }) subtotalAmount!: string;
  @ApiProperty({ example: '100.00' }) deliveryCharge!: string;
  @ApiProperty({ example: '0.00' }) discountAmount!: string;
  @ApiProperty({ example: '2698.00' }) totalAmount!: string;
  @ApiProperty({ type: () => AddressSnapshotDto }) deliveryAddress!: AddressSnapshotDto;
  @ApiProperty({ type: () => [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty({ type: () => [OrderStatusHistoryDto] }) statusHistory!: OrderStatusHistoryDto[];
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) createdAt!: string;
}

export class PlaceOrderResponseDto {
  @ApiProperty({ type: () => OrderDto }) order!: OrderDto;
  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['"Red - L": price changed from NPR 1299 → NPR 1349'],
    description: 'Non-null when product prices changed since items were added to cart',
  })
  stalePriceWarnings?: string[];
}

export class OrderListResponseDto {
  @ApiProperty({ type: () => [OrderDto] }) data!: OrderDto[];
  @ApiProperty({ type: () => PaginationMetaDto }) meta!: PaginationMetaDto;
}

// ─── Coupons ───────────────────────────────────────────────────────────────

export class CouponValidationResponseDto {
  @ApiProperty({ example: 'SAVE10' }) code!: string;
  @ApiProperty({ example: 'percentage' }) discountType!: string;
  @ApiProperty({ example: '10.00' }) discountValue!: string;
  @ApiProperty({ example: 259.8, description: 'NPR amount to be deducted' }) discountAmount!: number;
  @ApiProperty({ example: 2438.2, description: 'Final payable amount after discount' }) finalAmount!: number;
}

// ─── Reviews ───────────────────────────────────────────────────────────────

export class ReviewDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 5 }) rating!: number;
  @ApiPropertyOptional({ example: 'Great quality fabric!', nullable: true }) comment!: string | null;
  @ApiProperty({ example: 'approved' }) status!: string;
  @ApiProperty({ example: { fullName: 'Sita Rai', avatarUrl: null } }) user!: Record<string, unknown>;
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) createdAt!: string;
}

// ─── Navigation ────────────────────────────────────────────────────────────

export class MenuItemDto {
  @ApiProperty({ example: 'orders' }) id!: string;
  @ApiProperty({ example: 'Orders' }) label!: string;
  @ApiProperty({ example: 'ShoppingBag' }) icon!: string;
  @ApiProperty({ example: '/cms/orders' }) path!: string;
  @ApiPropertyOptional({ example: 5, description: 'Live badge count from DB' }) badgeCount?: number;
  @ApiPropertyOptional({ type: () => [MenuItemDto] }) children?: MenuItemDto[];
}

export class PermissionsDto {
  @ApiProperty({ example: true }) canViewDashboard!: boolean;
  @ApiProperty({ example: true }) canCreateProduct!: boolean;
  @ApiProperty({ example: true }) canEditProduct!: boolean;
  @ApiProperty({ example: false }) canDeleteProduct!: boolean;
  @ApiProperty({ example: true }) canManageInventory!: boolean;
  @ApiProperty({ example: true }) canViewOrders!: boolean;
  @ApiProperty({ example: true }) canUpdateOrderStatus!: boolean;
  @ApiProperty({ example: false }) canManageCoupons!: boolean;
  @ApiProperty({ example: false }) canViewAnalytics!: boolean;
  @ApiProperty({ example: false }) canManageBanners!: boolean;
  @ApiProperty({ example: false }) canManageStaff!: boolean;
  @ApiProperty({ example: false }) canManageSettings!: boolean;
}

export class PlanFeaturesDto {
  @ApiProperty({ example: false }) canUseAnalytics!: boolean;
  @ApiProperty({ example: true }) canUseDiscounts!: boolean;
  @ApiProperty({ example: false }) canUseEsewa!: boolean;
  @ApiProperty({ example: false }) canUseBulkImport!: boolean;
  @ApiProperty({ example: false }) canUseSeoTools!: boolean;
}

export class NavigationBadgesDto {
  @ApiProperty({ example: 3 }) pendingOrders!: number;
  @ApiProperty({ example: 7 }) unreadNotifications!: number;
}

export class NavigationResponseDto {
  @ApiProperty({ example: 'owner', enum: ['customer', 'owner', 'manager', 'inventory', 'support', 'analyst', 'admin'] })
  role!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  shopId!: string | null;

  @ApiProperty({ type: () => PermissionsDto }) permissions!: PermissionsDto;
  @ApiProperty({ type: () => PlanFeaturesDto }) planFeatures!: PlanFeaturesDto;
  @ApiProperty({ type: () => [MenuItemDto] }) menu!: MenuItemDto[];
  @ApiProperty({ type: () => NavigationBadgesDto }) badges!: NavigationBadgesDto;
}

// ─── Banners ───────────────────────────────────────────────────────────────

export class BannerDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'Dashain Sale' }) title!: string;
  @ApiPropertyOptional({ nullable: true }) subtitle!: string | null;
  @ApiProperty({ example: 'https://res.cloudinary.com/...' }) imageUrl!: string;
  @ApiPropertyOptional({ nullable: true }) linkUrl!: string | null;
  @ApiProperty({ example: 'hero' }) position!: string;
  @ApiProperty({ example: 0 }) sortOrder!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
}

// ─── Notifications ─────────────────────────────────────────────────────────

export class NotificationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'order_status' }) type!: string;
  @ApiProperty({ example: 'Your order MW-2025-001 has been shipped!' }) message!: string;
  @ApiProperty({ example: false }) isRead!: boolean;
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' }) sentAt!: string;
}

// ─── Users / Addresses ─────────────────────────────────────────────────────

export class AddressDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id!: string;
  @ApiProperty({ example: 'home' }) type!: string;
  @ApiProperty({ example: 'Sita Rai' }) fullName!: string;
  @ApiProperty({ example: '+9779841234567' }) phone!: string;
  @ApiProperty({ example: 'Thamel, House 23' }) addressLine!: string;
  @ApiPropertyOptional({ nullable: true }) landmark!: string | null;
  @ApiProperty({ example: 'Kathmandu' }) city!: string;
  @ApiProperty({ example: 'Bagmati' }) district!: string;
  @ApiPropertyOptional({ nullable: true }) pincode!: string | null;
  @ApiProperty({ example: 'inside_valley' }) zone!: string;
  @ApiProperty({ example: true }) isDefault!: boolean;
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export class AdminDashboardDto {
  @ApiProperty({ example: 1240 }) totalUsers!: number;
  @ApiProperty({ example: 45 }) totalShops!: number;
  @ApiProperty({ example: 3820 }) totalOrders!: number;
  @ApiProperty({ example: 890 }) totalActiveProducts!: number;
  @ApiProperty({ example: 12 }) pendingOrders!: number;
  @ApiProperty({ example: 485200.5 }) totalRevenuePaid!: number;
  @ApiProperty({ example: 'User/shop/order counts are approximate.' }) note!: string;
}
