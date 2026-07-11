import { Injectable, Inject } from '@nestjs/common';
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
    const [updated] = await this.db.update(schema.users)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    return updated;
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
