/**
 * Shared response types used across service methods.
 * Having explicit return types enforces the contract and prevents accidental data leaks.
 */

/** Standard success/deleted operation result */
export interface OperationResult {
  success: boolean;
  message?: string;
}

/** Typed user safe for returning to clients (no internal fields) */
export interface SafeUser {
  id: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  status: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Shop plan limits snapshot — used by PlanGateService */
export interface PlanLimitsSnapshot {
  maxProducts: number;
  maxVariantsPerProduct: number;
  maxImagesPerProduct: number;
  maxWarehouses: number;
  maxStaffMembers: number;
}

/** Coupon validation result */
export interface CouponValidationResult {
  couponId: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  discountAmount: number;
  finalAmount: number;
}

/** Serviceability check result */
export interface ServiceabilityResult {
  result: 'serviceable' | 'unserviceable' | 'enquiry_required';
  buyerMessage: string | null;
  availableCarriers: CarrierOption[];
  minDeliveryCostNpr: string | null;
  fastestDeliveryDays: number | null;
  fromCache: boolean;
}

export interface CarrierOption {
  name: string;
  code?: string;
  minDays: number;
  maxDays: number;
  costNpr: number;
  supportsCod: boolean;
}
