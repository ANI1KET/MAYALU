import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import * as schema from '../../database/schema/index';
import { CartRepository } from './cart.repository';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
  ) {}

  async getOrCreate(userId: string) {
    const existing = await this.cartRepository.findCartByUserId(userId);

    if (existing) return existing;

    const cart = await this.cartRepository.insertCart(userId);
    return { ...cart, items: [] };
  }

  async addItem(userId: string, variantId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);

    // Validate variant and product
    const variant = await this.cartRepository.findVariantWithProduct(variantId);

    if (!variant) {
      throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Product variant not found' });
    }

    const vWithProduct = variant as typeof variant & { product: typeof schema.products.$inferSelect };

    if (!vWithProduct.isActive || vWithProduct.product.status !== 'active') {
      throw new BadRequestException({
        code: 'PRODUCT_UNAVAILABLE',
        message: 'This product is not available for purchase',
      });
    }

    // Check stock
    const inv = await this.cartRepository.findInventoryByVariantId(variantId);

    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
    if (available < quantity && !inv?.allowBackorder) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${available} units available`,
        details: { available, requested: quantity },
      });
    }

    // Check if item already in cart
    const existingItem = await this.cartRepository.findCartItem(cart.id, variantId);

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (available < newQty && !inv?.allowBackorder) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Only ${available} units available (${existingItem.quantity} already in cart)`,
        });
      }

      const updated = await this.cartRepository.updateCartItemQuantity(existingItem.id, newQty);

      await this.cartRepository.updateCartTimestamp(cart.id);

      return updated;
    }

    const item = await this.cartRepository.insertCartItem(cart.id, variantId, quantity, vWithProduct.price);

    await this.cartRepository.updateCartTimestamp(cart.id);

    return item;
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);

    const item = await this.cartRepository.findCartItemById(itemId, cart.id);

    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Cart item not found' });

    // Re-check stock for new quantity
    const inv = await this.cartRepository.findInventoryByVariantId(item.variantId);

    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
    if (available < quantity && !inv?.allowBackorder) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${available} units available`,
      });
    }

    const updated = await this.cartRepository.updateCartItemQuantity(itemId, quantity);

    return updated;
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreate(userId);

    await this.cartRepository.deleteCartItemById(itemId, cart.id);

    return { removed: true };
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreate(userId);

    await this.cartRepository.deleteCartItemsByCartId(cart.id);

    return { cleared: true };
  }

  async getCartWithItems(userId: string) {
    const cart = await this.cartRepository.findCartWithItemsDetailed(userId);

    if (!cart) return { id: null, items: [], total: 0 };

    const cartWithItems = cart as typeof cart & {
      items: Array<{
        id: string;
        quantity: number;
        priceSnapshot: string;
        variant: typeof schema.productVariants.$inferSelect;
      }>;
    };

    const total = cartWithItems.items.reduce(
      (sum, item) => sum + parseFloat(item.priceSnapshot) * item.quantity,
      0,
    );

    return { ...cart, total };
  }
}
