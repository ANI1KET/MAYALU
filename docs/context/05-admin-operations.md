# 05 — Admin Operations

## Daily Workflow

### Order Management
1. New orders arrive with `status=pending`, `paymentStatus=pending`.
2. For COD: confirm → pack → ship → deliver (status transitions).
3. For eSewa/Fonepay: customer shares transaction ID → admin enters in `paymentReference` and sets `paymentStatus=paid` before shipping.
4. Each status change writes to `order_status_history` (append-only audit trail).
5. On `shipped`: SMS sent automatically to customer.

### Shop Verification
1. Vendor registers shop → `verificationStatus=unverified`.
2. Admin reviews PAN number and business details.
3. Admin updates: `PATCH /admin/shops/:id/status` with `verificationStatus=verified` and `status=active`.
4. Shop is now visible to buyers.

### Review Moderation
1. Reviews are created with `status=pending` after delivery.
2. Admin views pending reviews: `GET /admin/reviews/pending`.
3. Admin approves: `PATCH /admin/reviews/:id/approve` — triggers product avgRating update.

### Coupon Management
1. Create: `POST /admin/coupons` with discount rules and date range.
2. Toggle: `PATCH /admin/coupons/:id/toggle` to activate/deactivate.
3. Usages tracked in `coupon_usages` with order reference.
