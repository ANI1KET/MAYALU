import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import type { UpdateProfileDto, CreateAddressDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.usersRepository.updateProfile(userId, dto);
    if (!updated) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return updated;
  }

  getAddresses(userId: string) {
    return this.usersRepository.findAddressesByUserId(userId);
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.usersRepository.clearDefaultAddress(userId);
    }
    return this.usersRepository.createAddress(userId, dto);
  }
}
