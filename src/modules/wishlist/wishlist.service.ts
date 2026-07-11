import { Injectable, NotFoundException } from '@nestjs/common';
import { WishlistRepository } from './wishlist.repository';

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
  ) {}

  private async getOrCreate(userId: string) {
    const existing = await this.wishlistRepository.findWishlistByUserId(userId);
    if (existing) return existing;

    return this.wishlistRepository.createWishlist(userId);
  }

  async getWishlist(userId: string) {
    const wishlist = await this.wishlistRepository.findWishlistWithItems(userId);
    if (!wishlist) return { items: [] };
    return wishlist;
  }

  async addProduct(userId: string, productId: string) {
    const product = await this.wishlistRepository.findActiveProductById(productId);
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    const wishlist = await this.getOrCreate(userId);

    await this.wishlistRepository.addItem(wishlist.id, productId);

    return { added: true, productId };
  }

  async removeProduct(userId: string, productId: string) {
    const wishlist = await this.getOrCreate(userId);
    await this.wishlistRepository.removeItem(wishlist.id, productId);
    return { removed: true, productId };
  }
}
