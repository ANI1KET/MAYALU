import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

export type AttributeOption = typeof schema.attributeOptions.$inferSelect;
export type Attribute = typeof schema.attributes.$inferSelect;

@Injectable()
export class AttributesRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findAllAttributes() {
    return this.db.query.attributes.findMany({
      orderBy: (a, { asc }) => [asc(a.sortOrder)],
    });
  }

  findAllOptions() {
    return this.db.query.attributeOptions.findMany({
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
    });
  }

  findAttributeByCode(code: string) {
    return this.db.query.attributes.findFirst({
      where: eq(schema.attributes.code, code),
    });
  }

  findOptionsByAttributeId(attributeId: string) {
    return this.db.query.attributeOptions.findMany({
      where: eq(schema.attributeOptions.attributeId, attributeId),
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
    });
  }

  findCategoryById(categoryId: string) {
    return this.db.query.categories.findFirst({
      where: eq(schema.categories.id, categoryId),
    });
  }

  findCategoryAttributes(categoryId: string) {
    return this.db.query.categoryAttributes.findMany({
      where: eq(schema.categoryAttributes.categoryId, categoryId),
      orderBy: (ca, { asc }) => [asc(ca.sortOrder)],
    });
  }

  findAttributesByIds(attributeIds: string[]) {
    return this.db.query.attributes.findMany({
      where: inArray(schema.attributes.id, attributeIds),
    });
  }

  findOptionsByAttributeIds(attributeIds: string[]) {
    return this.db.query.attributeOptions.findMany({
      where: inArray(schema.attributeOptions.attributeId, attributeIds),
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
    });
  }
}
