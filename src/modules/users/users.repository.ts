import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import type { UpdateProfileDto, CreateAddressDto } from './dto/users.dto';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findById(userId: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Record<string, any> = {
      ...dto,
      updatedAt: new Date(),
    };
    if (updateData.email === '') {
      updateData.email = null;
    }
    try {
      const [updated] = await this.db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, userId))
        .returning();
      return updated;
    } catch (error: any) {
      if (error?.code === '23505') {
        if (error.constraint?.includes('email') || error.detail?.includes('email')) {
          throw new ConflictException({
            code: 'EMAIL_TAKEN',
            message: 'This email address is already in use by another account.',
          });
        }
      }
      throw error;
    }
  }

  findAddressesByUserId(userId: string) {
    return this.db.query.addresses.findMany({
      where: eq(schema.addresses.userId, userId),
      orderBy: (a, { desc }) => [desc(a.isDefault)],
    });
  }

  clearDefaultAddress(userId: string) {
    return this.db.update(schema.addresses)
      .set({ isDefault: false })
      .where(eq(schema.addresses.userId, userId));
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const [address] = await this.db.insert(schema.addresses).values({
      userId, ...dto, isDefault: dto.isDefault ?? false,
    }).returning();
    return address;
  }
}
