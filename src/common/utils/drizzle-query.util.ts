/**
 * Drizzle ORM relation query helpers.
 *
 * Drizzle's relational query builder uses a complex generic type for `with:` clauses
 * that is intentionally opaque at the call site. These typed helpers encapsulate
 * the common `with` shapes used across services so we avoid `as never` at every call.
 *
 * Pattern: define the `with` object as `const` and cast once here rather than
 * repeating `as never` everywhere.
 */

// ─── Product with relations ─────────────────────────────────────────────────

export const productWithVariantsAndMedia = {
  variants: {
    where: undefined as unknown,
    with: { attributeValues: true },
  },
  media: { orderBy: undefined as unknown },
  category: true,
  shop: { columns: { id: true, name: true, slug: true, logoUrl: true } },
  tags: true,
} as const;

// ─── Cart with items ────────────────────────────────────────────────────────

export const cartWithItemsAndVariants = {
  items: {
    with: {
      variant: {
        with: {
          product: {
            with: { media: { limit: 1 } },
          },
          attributeValues: {
            with: { attribute: true, attributeOption: true },
          },
        },
      },
    },
  },
} as const;

// ─── Order with items and history ───────────────────────────────────────────

export const orderWithDetails = {
  items: true,
  statusHistory: { orderBy: undefined as unknown },
} as const;

// ─── Shop with relations ─────────────────────────────────────────────────────

export const shopWithOwnerAndUsage = {
  owner: { columns: { phone: true, fullName: true, avatarUrl: true } },
  resourceUsage: true,
} as const;
