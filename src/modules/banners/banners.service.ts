import { Injectable } from '@nestjs/common';
import { BannersRepository } from './banners.repository';

@Injectable()
export class BannersService {
  constructor(private readonly bannersRepository: BannersRepository) {}

  async getActiveBanners(position?: 'hero' | 'category' | 'promo', shopId?: string) {
    const now = new Date();

    return this.bannersRepository.findActiveBanners(now, position, shopId);
  }
}
